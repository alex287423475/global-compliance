import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple, TypedDict


try:
    from langgraph.graph import END, START, StateGraph

    LANGGRAPH_AVAILABLE = True
except Exception:
    END = "__end__"
    START = "__start__"
    StateGraph = None
    LANGGRAPH_AVAILABLE = False


ALLOWED_CATEGORIES = {
    "Payment Risk",
    "Marketplace Appeal",
    "Market Entry",
    "Supply Chain",
    "IP Defense",
    "Crisis PR",
    "Capital Documents",
    "B2B Contracts",
    "Tax & Audit",
    "Data Privacy",
}

ALLOWED_RISK_LEVELS = {"Critical", "High", "Medium"}
MAX_REVISIONS = 3

FORBIDDEN_REPLACEMENTS = {
    "100% safe": "evidence-backed",
    "guaranteed approval": "review-ready",
    "guaranteed": "documented",
    "risk-free": "controlled-risk",
    "cure separation anxiety": "support feeding routines",
    "separation anxiety cure": "pet routine support",
    "cure": "support",
    "treat": "address",
    "heal": "support recovery context for",
    "medical grade": "documented specification",
    "anonymous payment": "privacy-aware payment",
    "instant customs clearance": "customs documentation readiness",
}


class PipelineError(Exception):
    pass


class WorkflowState(TypedDict, total=False):
    seed: str
    notes: str
    profiles: Dict[str, Any]
    forbidden_terms: Dict[str, Any]
    source_dir: str
    reviews_dir: str
    use_llm: bool
    llm: Any
    profile_key: str
    profile: Dict[str, Any]
    source_snippets: List[Dict[str, str]]
    review_snippets: List[Dict[str, str]]
    research_data: str
    pain_points: List[str]
    safe_terms: List[str]
    evidence: List[str]
    redline_terms: List[str]
    strict_terms: List[str]
    review_feedback: str
    article: Dict[str, Any]
    review_passed: bool
    review_findings: List[str]
    revision_count: int
    blocked: bool
    trace: List[Dict[str, Any]]


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_local_brain_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise PipelineError("Invalid local brain config JSON: %s" % exc)


def append_trace(state: WorkflowState, agent: str, action: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    return state.get("trace", []) + [{"agent": agent, "action": action, "data": data}]


def slugify(text: str) -> str:
    normalized = text.lower()
    replacements = {
        "智能宠物喂食器": "smart-pet-feeder",
        "宠物喂食器": "pet-feeder",
        "拒付": "chargeback",
        "冻结": "account-hold",
        "封号": "account-suspension",
        "申诉": "appeal",
        "供应链": "supply-chain",
        "溯源": "traceability",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source.lower(), target)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    if normalized:
        return normalized[:72].strip("-")
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    return "compliance-brief-" + digest


def contains_any(text: str, terms: List[str]) -> List[str]:
    lowered = text.lower()
    return [term for term in terms if term.lower() in lowered]


def sanitize_claim_text(text: str) -> str:
    cleaned = text
    for source, target in sorted(FORBIDDEN_REPLACEMENTS.items(), key=lambda item: len(item[0]), reverse=True):
        cleaned = re.sub(re.escape(source), target, cleaned, flags=re.IGNORECASE)
    return cleaned


def title_case_seed(seed: str) -> str:
    if re.search(r"[A-Za-z]", seed):
        return " ".join(part.capitalize() if part.islower() else part for part in seed.split())
    return seed


def parse_json_object(text: str) -> Dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start >= 0 and end > start:
            return json.loads(stripped[start : end + 1])
        raise


class OpenAICompatibleClient:
    def __init__(self) -> None:
        load_env_file(Path(".env.local"))
        load_env_file(Path(".env"))
        config = load_local_brain_config(Path("local-brain/config.json"))
        provider = (config.get("provider") or os.environ.get("LOCAL_BRAIN_PROVIDER") or "openai").lower()
        provider_defaults = {
            "openai": {
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key_env": "OPENAI_API_KEY",
            },
            "claude": {
                "base_url": "https://api.anthropic.com/v1/",
                "model": "claude-sonnet-4-5-20250929",
                "api_key_env": "ANTHROPIC_API_KEY",
            },
            "gemini": {
                "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
                "model": "gemini-2.5-flash",
                "api_key_env": "GEMINI_API_KEY",
            },
            "deepseek": {
                "base_url": "https://api.deepseek.com",
                "model": "deepseek-chat",
                "api_key_env": "DEEPSEEK_API_KEY",
            },
        }
        if provider not in provider_defaults:
            provider = "openai"
        defaults = provider_defaults[provider]
        self.provider = provider
        self.api_key = (
            config.get("api_key")
            or os.environ.get("LOCAL_BRAIN_API_KEY")
            or os.environ.get("LOCAL_BRAIN_OPENAI_API_KEY")
            or os.environ.get(defaults["api_key_env"])
            or os.environ.get("OPENAI_API_KEY")
        )
        self.base_url = (
            config.get("base_url")
            or os.environ.get("LOCAL_BRAIN_BASE_URL")
            or os.environ.get("LOCAL_BRAIN_OPENAI_BASE_URL")
            or os.environ.get("OPENAI_BASE_URL")
            or defaults["base_url"]
        ).rstrip("/")
        self.model = (
            config.get("model")
            or os.environ.get("LOCAL_BRAIN_MODEL")
            or os.environ.get("LOCAL_BRAIN_OPENAI_MODEL")
            or os.environ.get("OPENAI_MODEL")
            or defaults["model"]
        )

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def chat_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        if not self.available:
            raise PipelineError("LLM is not configured. Set it in local-brain/config.json or LOCAL_BRAIN_API_KEY.")

        payload = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=data,
            headers={
                "Authorization": "Bearer " + self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise PipelineError("LLM request failed: HTTP %s %s" % (exc.code, body[:800]))
        except urllib.error.URLError as exc:
            raise PipelineError("LLM request failed: %s" % exc)

        response_data = json.loads(raw)
        content = response_data["choices"][0]["message"]["content"]
        return parse_json_object(content)


def select_profile(seed: str, profiles: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    lowered = seed.lower()
    best_key = None
    best_score = -1
    for key, profile in profiles.items():
        score = 0
        for term in profile.get("match_terms", []):
            if term.lower() in lowered:
                score += 1
        if score > best_score:
            best_key = key
            best_score = score
    if best_score <= 0:
        best_key = "payment-gateway-review"
    return best_key, profiles[best_key]


def tokenize(text: str) -> List[str]:
    return [part.lower() for part in re.split(r"[^A-Za-z0-9\u4e00-\u9fff]+", text) if len(part.strip()) >= 2]


def read_textish_file(path: Path) -> str:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return json.dumps(data, ensure_ascii=False, indent=2)
    return path.read_text(encoding="utf-8", errors="ignore")


def retrieve_snippets(seed: str, directory: Path, limit: int = 5) -> List[Dict[str, str]]:
    if not directory.exists():
        return []
    seed_terms = set(tokenize(seed))
    scored = []
    for path in directory.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt", ".json", ".csv"}:
            continue
        try:
            text = read_textish_file(path)
        except Exception:
            continue
        score = sum(1 for term in seed_terms if term in text.lower())
        if score == 0:
            profile_terms = {"payment", "stripe", "paypal", "amazon", "fda", "refund", "chargeback", "合规", "风险"}
            score = sum(1 for term in profile_terms if term in text.lower())
        if score > 0:
            snippet = re.sub(r"\s+", " ", text).strip()[:1400]
            scored.append((score, path, snippet))
    scored.sort(key=lambda item: (item[0], item[1].stat().st_mtime), reverse=True)
    return [{"file": str(item[1]), "snippet": item[2]} for item in scored[:limit]]


def fallback_research(state: WorkflowState) -> Dict[str, Any]:
    profile = state["profile"]
    seed = state["seed"]
    source_summary = " ".join(item["snippet"][:240] for item in state.get("source_snippets", [])[:3])
    review_summary = " ".join(item["snippet"][:240] for item in state.get("review_snippets", [])[:3])
    safe_terms = profile.get("safe_terms", [])
    evidence = profile.get("evidence", [])
    return {
        "research_data": (
            "Seed: %s. Profile: %s. Key operating risks include payment review, policy wording, "
            "evidence completeness, and unverifiable claim exposure. Local sources: %s Reviews: %s"
            % (seed, state.get("profile_key"), source_summary or "none", review_summary or "none")
        ),
        "pain_points": [
            "policy wording may overpromise outcomes",
            "evidence package may be incomplete during review",
            "customer disputes may expose fulfillment gaps",
        ],
        "safe_terms": safe_terms,
        "evidence": evidence,
    }


def researcher_agent(state: WorkflowState) -> Dict[str, Any]:
    profiles = state["profiles"]
    forbidden_terms = state["forbidden_terms"]
    seed = state["seed"]
    profile_key, profile = select_profile(seed, profiles)
    strict_terms = (
        forbidden_terms.get("global", [])
        + forbidden_terms.get("medical_claims", [])
        + forbidden_terms.get("payment_claims", [])
        + forbidden_terms.get("customs_claims", [])
    )
    source_snippets = retrieve_snippets(seed, Path(state.get("source_dir", "local-brain/knowledge")))
    review_snippets = retrieve_snippets(seed, Path(state.get("reviews_dir", "local-brain/reviews")))
    notes_hits = contains_any(state.get("notes", ""), strict_terms)
    redline_terms = list(dict.fromkeys(profile.get("redline_terms", []) + notes_hits))

    base_state: WorkflowState = dict(
        state,
        profile_key=profile_key,
        profile=profile,
        source_snippets=source_snippets,
        review_snippets=review_snippets,
        redline_terms=redline_terms,
        strict_terms=strict_terms,
    )

    research = fallback_research(base_state)
    llm = state.get("llm")
    if state.get("use_llm") and llm and llm.available:
        prompt = {
            "seed_keyword": seed,
            "profile": profile,
            "existing_red_lines": redline_terms,
            "local_sources": source_snippets,
            "review_voc": review_snippets,
            "operator_notes": state.get("notes", ""),
        }
        result = llm.chat_json(
            "You are a cross-border trade risk intelligence analyst. Return only JSON with keys: research_data, pain_points, red_lines, safe_terms, evidence. Extract risks from local RAG notes and review VOC. Do not write an article.",
            json.dumps(prompt, ensure_ascii=False),
            temperature=0.1,
        )
        research = {
            "research_data": str(result.get("research_data", research["research_data"])),
            "pain_points": list(result.get("pain_points", research["pain_points"]))[:8],
            "safe_terms": list(result.get("safe_terms", research["safe_terms"]))[:12],
            "evidence": list(result.get("evidence", research["evidence"]))[:12],
        }
        redline_terms = list(dict.fromkeys(redline_terms + list(result.get("red_lines", []))))

    return {
        "profile_key": profile_key,
        "profile": profile,
        "source_snippets": source_snippets,
        "review_snippets": review_snippets,
        "research_data": research["research_data"],
        "pain_points": research["pain_points"],
        "safe_terms": research["safe_terms"],
        "evidence": research["evidence"],
        "redline_terms": redline_terms,
        "strict_terms": strict_terms,
        "trace": append_trace(
            state,
            "Researcher Agent",
            "retrieved local RAG/VOC and extracted red lines",
            {
                "profile": profile_key,
                "source_count": len(source_snippets),
                "review_count": len(review_snippets),
                "redline_terms": redline_terms,
                "llm": bool(state.get("use_llm") and llm and llm.available),
            },
        ),
    }


def build_fallback_article(state: WorkflowState, safe_seed: str, revision_count: int) -> Dict[str, Any]:
    profile = state["profile"]
    market = profile.get("market", "North America")
    seed_title = title_case_seed(safe_seed)
    slug = slugify(safe_seed + " compliance checklist")
    evidence_text = ", ".join(state.get("evidence", [])[:5])
    safe_terms_text = ", ".join(state.get("safe_terms", [])[:6])
    rewrite_note = " after reviewer revision" if revision_count > 0 else ""
    return {
        "slug": slug,
        "title": "%s compliance keyword and evidence checklist%s" % (seed_title, rewrite_note),
        "zhTitle": "%s合规关键词与证据清单" % safe_seed,
        "category": profile.get("category", "Payment Risk"),
        "market": market,
        "riskLevel": profile.get("risk_level", "High"),
        "updatedAt": dt.date.today().isoformat(),
        "summary": "A structured compliance intelligence brief for teams preparing SEO wording, policy pages, evidence files, and review-ready explanations around %s in %s." % (seed_title, market),
        "zhSummary": "面向%s场景的合规情报简报，用于整理 SEO 表达、政策页面、证据文件和可审阅的业务说明。" % safe_seed,
        "redlineTerms": state.get("redline_terms", [])[:8],
        "sections": [
            {
                "heading": "Commercial wording must stay inside the evidence boundary",
                "zhHeading": "商业表达必须停留在证据边界内",
                "body": "For %s, the safest content strategy is to describe observable product facts, operating procedures, refund handling, fulfillment limits, and support channels. Avoid broad outcome promises. The page should make a reviewer understand what is sold, how it is delivered, how disputes are handled, and what evidence supports each claim." % seed_title,
                "zhBody": "针对%s，稳妥的内容策略是描述可验证的产品事实、运营流程、退款处理、履约边界和客服通道。不要使用宽泛的结果承诺。页面应让审核方清楚知道卖的是什么、如何交付、争议如何处理，以及每个说法由什么证据支撑。" % safe_seed,
            },
            {
                "heading": "Keyword assets should separate demand capture from risk claims",
                "zhHeading": "关键词资产要把需求捕获与风险承诺分开",
                "body": "High-intent keywords can be useful, but they should not force the page into prohibited or unverifiable claims. Build the keyword bank around safer phrases such as %s. Keep sensitive phrases in a redline list for internal review rather than placing them in titles, checkout copy, policy pages, or advertising claims." % safe_terms_text,
                "zhBody": "高意向关键词有价值，但不能把页面推向禁止性或不可验证的承诺。关键词库应围绕更安全的表达构建，例如：%s。敏感词应进入内部红线清单，而不是出现在标题、结账文案、政策页面或广告承诺中。" % safe_terms_text,
            },
            {
                "heading": "Evidence files make the asset reusable",
                "zhHeading": "证据文件决定资产能否复用",
                "body": "A reusable compliance asset should include the keyword list, safer alternatives, platform-specific policy notes, and an evidence checklist. For this category, the minimum evidence set should include: %s. This keeps the asset useful for SEO, payment review, customer support, and internal training." % evidence_text,
                "zhBody": "可复用的合规资产应包含关键词列表、安全替代表达、平台政策说明和证据清单。该类目最低证据集应包括：%s。这样它才能同时服务于 SEO、支付审核、客服回应和内部培训。" % evidence_text,
            },
        ],
    }


def writer_agent(state: WorkflowState) -> Dict[str, Any]:
    revision_count = state.get("revision_count", 0)
    seed = state["seed"]
    safe_seed = sanitize_claim_text(seed) if revision_count > 0 else seed
    article = build_fallback_article(state, safe_seed=safe_seed, revision_count=revision_count)
    llm = state.get("llm")

    if state.get("use_llm") and llm and llm.available:
        payload = {
            "seed_keyword": safe_seed,
            "research_data": state.get("research_data", ""),
            "pain_points": state.get("pain_points", []),
            "red_lines": state.get("redline_terms", []),
            "safe_terms": state.get("safe_terms", []),
            "evidence": state.get("evidence", []),
            "review_feedback": state.get("review_feedback", ""),
            "required_schema": {
                "slug": "lowercase-ascii-hyphen-slug",
                "title": "English title",
                "zhTitle": "Chinese title",
                "category": list(ALLOWED_CATEGORIES),
                "market": "target market",
                "riskLevel": list(ALLOWED_RISK_LEVELS),
                "updatedAt": "YYYY-MM-DD",
                "summary": "English summary",
                "zhSummary": "Chinese summary",
                "redlineTerms": ["terms"],
                "sections": [{"heading": "", "zhHeading": "", "body": "", "zhBody": ""}],
            },
        }
        article = llm.chat_json(
            "You are a senior cross-border compliance architect. Write a high-conversion SEO compliance asset in a restrained, authoritative consulting tone. Avoid every red line term. Return only JSON matching the required schema.",
            json.dumps(payload, ensure_ascii=False),
            temperature=0.35,
        )

    return {
        "article": article,
        "trace": append_trace(
            state,
            "Writer Agent",
            "drafted article" if revision_count == 0 else "rewrote article after reviewer rejection",
            {"revision": revision_count, "slug": article.get("slug"), "title": article.get("title"), "llm": bool(state.get("use_llm") and llm and llm.available)},
        ),
    }


def publishable_text(article: Dict[str, Any]) -> str:
    parts = [article.get("title", ""), article.get("summary", ""), article.get("zhTitle", ""), article.get("zhSummary", "")]
    for section in article.get("sections", []):
        parts.extend([section.get("heading", ""), section.get("zhHeading", ""), section.get("body", ""), section.get("zhBody", "")])
    return "\n".join(parts)


def deterministic_review(state: WorkflowState) -> Tuple[bool, List[str], str]:
    article = state["article"]
    findings = contains_any(publishable_text(article), state.get("strict_terms", []))
    if len(article.get("sections", [])) < 2:
        findings.append("too few sections")
    if any(term in publishable_text(article).lower() for term in ["best ever", "miracle", "easy money", "100 percent"]):
        findings.append("overpromising marketing tone")
    feedback = "Remove forbidden or overpromising language and rewrite with evidence-bounded claims: %s" % ", ".join(findings)
    return len(findings) == 0, findings, feedback


def reviewer_agent(state: WorkflowState) -> Dict[str, Any]:
    passed, findings, feedback = deterministic_review(state)
    llm = state.get("llm")
    if state.get("use_llm") and llm and llm.available and passed:
        result = llm.chat_json(
            "You are a cold compliance officer. Review the draft against red_lines, medical implications, payment overpromises, and AI-like generic marketing. Return JSON: {\"status\":\"PASS|REJECT\",\"findings\":[...],\"feedback\":\"...\"}.",
            json.dumps({"red_lines": state.get("redline_terms", []), "draft": state.get("article", {})}, ensure_ascii=False),
            temperature=0.0,
        )
        if str(result.get("status", "")).upper() == "REJECT":
            passed = False
            findings = list(result.get("findings", [])) or ["llm reviewer rejected draft"]
            feedback = str(result.get("feedback", "Rewrite with tighter compliance language."))

    revision_count = state.get("revision_count", 0)
    blocked = (not passed) and revision_count >= MAX_REVISIONS
    return {
        "review_passed": passed,
        "review_findings": findings,
        "review_feedback": "" if passed else feedback,
        "revision_count": revision_count if passed else revision_count + 1,
        "blocked": blocked,
        "trace": append_trace(
            state,
            "Reviewer Agent",
            "approved article" if passed else "rejected article and requested rewrite",
            {"passed": passed, "revision": revision_count, "findings": findings, "blocked": blocked, "feedback": "" if passed else feedback},
        ),
    }


def route_after_review(state: WorkflowState) -> str:
    if state.get("review_passed"):
        return "final"
    if state.get("blocked"):
        return "blocked"
    return "rewrite"


def validate_article(article: Dict[str, Any], strict_terms: List[str]) -> Dict[str, Any]:
    errors = []
    required = ["slug", "title", "zhTitle", "category", "market", "riskLevel", "updatedAt", "summary", "zhSummary", "redlineTerms", "sections"]
    for field in required:
        if field not in article or article[field] in (None, ""):
            errors.append("missing required field: %s" % field)
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", article.get("slug", "")):
        errors.append("slug must be lowercase ASCII words separated by hyphens")
    if article.get("category") not in ALLOWED_CATEGORIES:
        errors.append("category is not allowed: %s" % article.get("category"))
    if article.get("riskLevel") not in ALLOWED_RISK_LEVELS:
        errors.append("riskLevel must be Critical, High, or Medium")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", article.get("updatedAt", "")):
        errors.append("updatedAt must use YYYY-MM-DD")
    if not isinstance(article.get("redlineTerms"), list) or len(article.get("redlineTerms", [])) < 2:
        errors.append("redlineTerms must contain at least two terms")
    sections = article.get("sections", [])
    if not isinstance(sections, list) or len(sections) < 2:
        errors.append("sections must contain at least two sections")
    for index, section in enumerate(sections):
        for field in ["heading", "zhHeading", "body", "zhBody"]:
            if not section.get(field):
                errors.append("sections[%d] missing field: %s" % (index, field))
    hits = contains_any(publishable_text(article), strict_terms)
    if hits:
        errors.append("Fail-Safe blocked forbidden claim(s) in publishable text: %s" % ", ".join(hits))
    if errors:
        raise PipelineError("\n".join(errors))
    return article


def build_langgraph_app():
    if not LANGGRAPH_AVAILABLE:
        return None
    graph = StateGraph(WorkflowState)
    graph.add_node("researcher", researcher_agent)
    graph.add_node("writer", writer_agent)
    graph.add_node("reviewer", reviewer_agent)
    graph.add_edge(START, "researcher")
    graph.add_edge("researcher", "writer")
    graph.add_edge("writer", "reviewer")
    graph.add_conditional_edges("reviewer", route_after_review, {"rewrite": "writer", "final": END, "blocked": END})
    return graph.compile()


def run_fallback_state_machine(initial_state: WorkflowState) -> WorkflowState:
    state = dict(initial_state)
    state.update(researcher_agent(state))
    while True:
        state.update(writer_agent(state))
        state.update(reviewer_agent(state))
        if route_after_review(state) in {"final", "blocked"}:
            return state


def run_workflow(seed: str, notes: str, profiles: Dict[str, Any], forbidden_terms: Dict[str, Any], source_dir: str, reviews_dir: str) -> WorkflowState:
    llm = OpenAICompatibleClient()
    if not llm.available:
        raise PipelineError("LLM is required. Configure API Key in Streamlit 5. 配置 or local-brain/config.json before generating articles.")
    initial_state: WorkflowState = {
        "seed": seed,
        "notes": notes.strip(),
        "revision_count": 0,
        "trace": [],
        "profiles": profiles,
        "forbidden_terms": forbidden_terms,
        "source_dir": source_dir,
        "reviews_dir": reviews_dir,
        "use_llm": True,
        "llm": llm,
    }
    app = build_langgraph_app()
    if app is None:
        state = run_fallback_state_machine(initial_state)
        state["llm_provider"] = llm.provider if initial_state["use_llm"] else "rules"
        state["llm_model"] = llm.model if initial_state["use_llm"] else "rules"
        state["trace"] = append_trace(state, "Runtime", "used compatibility fallback because LangGraph is not installed", {"python": sys.version.split()[0], "llm": initial_state["use_llm"]})
        return state
    state = app.invoke(initial_state)
    state["llm_provider"] = llm.provider if initial_state["use_llm"] else "rules"
    state["llm_model"] = llm.model if initial_state["use_llm"] else "rules"
    state["trace"] = append_trace(
        state,
        "Runtime",
        "executed with LangGraph StateGraph",
        {
            "python": sys.version.split()[0],
            "llm": initial_state["use_llm"],
            "provider": state["llm_provider"],
            "model": state["llm_model"],
        },
    )
    return state


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a compliance insight draft with a real multi-agent LangGraph workflow.")
    parser.add_argument("--seed", required=True, help="Seed keyword or category, for example: 智能宠物喂食器")
    parser.add_argument("--notes-file", default="", help="Optional local notes file to enrich the intelligence brief.")
    parser.add_argument("--source-dir", default="local-brain/knowledge", help="Local RAG source directory.")
    parser.add_argument("--reviews-dir", default="local-brain/reviews", help="Local VOC/review directory.")
    parser.add_argument("--draft-dir", default="local-brain/drafts", help="Output directory for generated JSON drafts.")
    parser.add_argument("--audit-dir", default="local-brain/audits", help="Output directory for workflow audit traces.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite an existing draft with the same slug.")
    parser.add_argument("--no-llm", action="store_true", help="Deprecated. This pipeline requires LLM and will fail if this flag is used.")
    return parser.parse_args()


def main():
    args = parse_args()
    root = Path.cwd()
    rules_dir = root / "local-brain" / "rules"
    profiles = load_json(rules_dir / "category-profiles.json")
    forbidden_terms = load_json(rules_dir / "forbidden-terms.json")
    notes = ""
    if args.notes_file:
        notes_path = root / args.notes_file
        if not notes_path.exists():
            raise PipelineError("notes file does not exist: %s" % args.notes_file)
        notes = notes_path.read_text(encoding="utf-8")
    if args.no_llm:
        raise PipelineError("--no-llm is forbidden. This production line requires LLM-based Researcher / Writer / Reviewer execution.")

    state = run_workflow(args.seed, notes, profiles, forbidden_terms, args.source_dir, args.reviews_dir)
    if state.get("blocked"):
        raise PipelineError("Reviewer blocked the article after %s revision(s): %s" % (state.get("revision_count", 0), ", ".join(state.get("review_findings", []))))
    article = validate_article(state["article"], state.get("strict_terms", []))
    draft_dir = root / args.draft_dir
    audit_dir = root / args.audit_dir
    draft_dir.mkdir(parents=True, exist_ok=True)
    audit_dir.mkdir(parents=True, exist_ok=True)
    output_path = draft_dir / ("%s.json" % article["slug"])
    audit_path = audit_dir / ("%s.audit.json" % article["slug"])
    if output_path.exists() and not args.overwrite:
        raise PipelineError("draft already exists: %s (use --overwrite to replace it)" % output_path)
    output_path.write_text(json.dumps(article, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(
        json.dumps(
            {
                "seed": args.seed,
                "runtime": "langgraph" if LANGGRAPH_AVAILABLE else "fallback",
                "llm_enabled": bool(state.get("use_llm")),
                "llm_provider": state.get("llm_provider", "rules"),
                "llm_model": state.get("llm_model", "rules"),
                "profile": state.get("profile_key"),
                "review_passed": state.get("review_passed"),
                "review_findings": state.get("review_findings", []),
                "revision_count": state.get("revision_count", 0),
                "source_snippets": state.get("source_snippets", []),
                "review_snippets": state.get("review_snippets", []),
                "draft": str(output_path),
                "trace": state.get("trace", []),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("Local Brain draft generated:")
    print("  runtime: %s" % ("LangGraph StateGraph" if LANGGRAPH_AVAILABLE else "compatibility fallback"))
    print("  llm: %s" % ("enabled" if state.get("use_llm") else "disabled"))
    print("  seed: %s" % args.seed)
    print("  profile: %s" % state.get("profile_key"))
    print("  category: %s" % article["category"])
    print("  risk: %s" % article["riskLevel"])
    print("  revisions: %s" % state.get("revision_count", 0))
    print("  output: %s" % output_path)
    print("  audit: %s" % audit_path)


if __name__ == "__main__":
    try:
        main()
    except PipelineError as exc:
        print("Pipeline blocked:")
        print(exc)
        sys.exit(1)
