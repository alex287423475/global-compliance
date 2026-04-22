import argparse
import datetime as dt
import hashlib
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
import ssl
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, TypedDict


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
PROGRESS_PREFIX = "[LOCAL_BRAIN_PROGRESS] "

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
    "clinically proven": "evidence-documented",
    "disease prevention": "routine support",
    "pain relief": "comfort-oriented use context",
    "anti anxiety": "calming routine support",
    "anonymous payment": "privacy-aware payment",
    "instant customs clearance": "customs documentation readiness",
}

ARTICLE_STYLE_REPLACEMENTS = {
    "architecture": "consideration",
    "architectures": "considerations",
    "framework": "consideration",
    "frameworks": "considerations",
    "checklist": "essential",
    "checklists": "essentials",
    "brief": "analysis",
    "briefs": "analyses",
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


def emit_progress(seed: str, agent: str, status: str, message_code: str, data: Optional[Dict[str, Any]] = None) -> None:
    if os.environ.get("LOCAL_BRAIN_PROGRESS") != "1":
        return
    event = {
        "seed": seed,
        "agent": agent,
        "status": status,
        "message_code": message_code,
        "data": data or {},
        "time": dt.datetime.now().strftime("%H:%M:%S"),
    }
    print(PROGRESS_PREFIX + json.dumps(event, ensure_ascii=True), flush=True)


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


def articleize_text(text: str) -> str:
    cleaned = text
    for source, target in ARTICLE_STYLE_REPLACEMENTS.items():
        cleaned = re.sub(r"\b%s\b" % re.escape(source), target, cleaned, flags=re.IGNORECASE)
    return cleaned


def paragraphize(text: str, fallback_second: str = "") -> str:
    cleaned = articleize_text(first_string(text)).strip()
    if not cleaned:
        cleaned = fallback_second.strip()
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", cleaned) if part.strip()]
    if not paragraphs and cleaned:
        paragraphs = [cleaned]
    if len(paragraphs) == 1 and fallback_second.strip():
        if len(paragraphs[0]) < 380:
            paragraphs.append(fallback_second.strip())
    return "\n\n".join(paragraphs[:2]).strip()


def build_toc_from_markdown(markdown: str) -> List[Dict[str, Any]]:
    toc: List[Dict[str, Any]] = []
    for raw_line in first_string(markdown).splitlines():
        line = raw_line.strip()
        match = re.match(r"^(##|###)\s+(.+)$", line)
        if not match:
            continue
        marks, label = match.groups()
        toc.append(
            {
                "id": slugify(label),
                "label": label.strip(),
                "zhLabel": label.strip(),
                "level": 2 if marks == "##" else 3,
            }
        )
    return toc


def section_markdown(heading: str, body: str) -> str:
    return "## %s\n\n%s" % (heading.strip(), body.strip())


def build_markdown_article(
    article: Dict[str, Any],
    state: WorkflowState,
    locale: str = "en",
) -> str:
    title = first_string(article.get("title" if locale == "en" else "zhTitle"))
    dek = first_string(article.get("dek" if locale == "en" else "zhDek"))
    introduction = first_string(article.get("introduction" if locale == "en" else "zhIntroduction"))
    conclusion = first_string(article.get("conclusion" if locale == "en" else "zhConclusion"))
    takeaways = article.get("keyTakeaways" if locale == "en" else "zhKeyTakeaways", [])
    if not isinstance(takeaways, list):
        takeaways = []
    sections = article.get("sections", [])
    if not isinstance(sections, list):
        sections = []
    faq = article.get("faq", [])
    if not isinstance(faq, list):
        faq = []

    parts: List[str] = []
    if dek:
        parts.append("> %s" % dek)
    if introduction:
        parts.append(introduction.strip())
    if takeaways:
        parts.append("## Key Takeaways\n\n" + "\n".join("- %s" % first_string(item) for item in takeaways[:5] if first_string(item)))
    for section in sections:
        heading = first_string(section.get("heading" if locale == "en" else "zhHeading"))
        body = first_string(section.get("body" if locale == "en" else "zhBody"))
        if heading and body:
            parts.append(section_markdown(heading, body))
    if faq:
        faq_parts = ["## FAQ"]
        for item in faq[:5]:
            question = first_string(item.get("question" if locale == "en" else "zhQuestion"))
            answer = first_string(item.get("answer" if locale == "en" else "zhAnswer"))
            if question and answer:
                faq_parts.append("### %s\n\n%s" % (question, answer))
        parts.append("\n\n".join(faq_parts))
    if conclusion:
        parts.append("## Conclusion\n\n%s" % conclusion.strip())

    markdown = "\n\n".join(part.strip() for part in parts if part.strip())
    warning_terms = article.get("redlineTerms", [])
    if isinstance(warning_terms, list) and warning_terms:
        warning_block = "\n".join("- %s" % first_string(term) for term in warning_terms[:6] if first_string(term))
        if warning_block:
            markdown += "\n\n## Redline Watchlist\n\n" + warning_block
    if locale == "en":
        cta = "If your team needs this risk mapped against its own checkout, policy stack, or evidence files, request a private diagnostic review before scaling traffic."
    else:
        cta = "If your team needs this risk mapped against its own materials, request a private diagnostic review before scaling traffic."
    markdown += "\n\n> %s" % cta
    return markdown.strip()


def sanitize_article_claims(value: Any) -> Any:
    if isinstance(value, str):
        return sanitize_claim_text(value)
    if isinstance(value, list):
        return [sanitize_article_claims(item) for item in value]
    if isinstance(value, dict):
        sanitized: Dict[str, Any] = {}
        for key, item in value.items():
            sanitized[key] = item if key == "redlineTerms" else sanitize_article_claims(item)
        return sanitized
    return value


def first_string(value: Any, fallback: str = "") -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item.strip():
                return item
    if value is None:
        return fallback
    return str(value)


def normalize_article(article: Dict[str, Any], state: WorkflowState) -> Dict[str, Any]:
    normalized = dict(article)
    profile = state.get("profile", {})
    seed = state.get("seed", "compliance asset")

    normalized["slug"] = slugify(first_string(normalized.get("slug")) or seed + " compliance article")
    normalized["title"] = articleize_text(
        first_string(normalized.get("title"), "%s cross-border compliance article" % title_case_seed(seed))
    )
    normalized["zhTitle"] = first_string(normalized.get("zhTitle"), normalized["title"])
    normalized["category"] = first_string(normalized.get("category"), profile.get("category", "Payment Risk"))
    if normalized["category"] not in ALLOWED_CATEGORIES:
        normalized["category"] = profile.get("category", "Payment Risk")
    normalized["market"] = first_string(normalized.get("market"), profile.get("market", "North America"))
    normalized["riskLevel"] = first_string(normalized.get("riskLevel"), profile.get("risk_level", "High"))
    if normalized["riskLevel"] not in ALLOWED_RISK_LEVELS:
        normalized["riskLevel"] = profile.get("risk_level", "High")
    normalized["updatedAt"] = dt.date.today().isoformat()

    normalized["metaTitle"] = first_string(normalized.get("metaTitle"), normalized["title"])[:80]
    normalized["metaDescription"] = articleize_text(
        first_string(
            normalized.get("metaDescription"),
            "Operational guidance for cross-border teams that need safer claims, clearer policy language, and stronger evidence files before payment review, disputes, or platform scrutiny.",
        )
    )[:180]
    normalized["summary"] = articleize_text(
        first_string(
            normalized.get("summary"),
            "A publishable compliance analysis for teams preparing SEO wording, policy pages, evidence files, and review-ready explanations.",
        )
    )
    normalized["zhSummary"] = first_string(normalized.get("zhSummary"), normalized["summary"])
    normalized["dek"] = articleize_text(
        first_string(
            normalized.get("dek"),
            "What cross-border sellers need to fix in product language, policy pages, and support records before this category attracts avoidable scrutiny.",
        )
    )
    normalized["zhDek"] = first_string(normalized.get("zhDek"), normalized["dek"])
    normalized["introduction"] = paragraphize(
        first_string(
            normalized.get("introduction"),
            "Most compliance problems in this category do not start with a single forbidden phrase. They build up when product copy, payment language, refund expectations, and support records describe different realities.\n\nA useful article should help an operator see where scrutiny begins, which public-facing claims create friction, and which documents need to exist before a dispute, payment review, or platform check arrives.",
        ),
        "Instead of treating compliance as a final proofreading step, the better approach is to use the article itself as an operating map: what language belongs on the page, what claims must stay internal, and what evidence needs to exist before sales volume increases.",
    )
    normalized["zhIntroduction"] = first_string(normalized.get("zhIntroduction"), normalized["introduction"])

    state_redlines = [first_string(item) for item in state.get("redline_terms", []) if first_string(item)]
    redlines = normalized.get("redlineTerms", [])
    if not isinstance(redlines, list):
        redlines = [first_string(redlines)]
    normalized["redlineTerms"] = [first_string(item) for item in redlines if first_string(item)]
    if state_redlines:
        normalized["redlineTerms"] = list(dict.fromkeys(state_redlines[:8] + normalized["redlineTerms"]))[:8]
    if len(normalized["redlineTerms"]) < 4:
        normalized["redlineTerms"] = list(
            dict.fromkeys(
                normalized["redlineTerms"]
                + [
                    "guaranteed approval",
                    "risk-free return",
                    "anonymous payment",
                    "medical grade",
                ]
            )
        )[:8]

    takeaways = normalized.get("keyTakeaways", [])
    if not isinstance(takeaways, list):
        takeaways = []
    normalized["keyTakeaways"] = [articleize_text(first_string(item)) for item in takeaways if first_string(item)]
    if len(normalized["keyTakeaways"]) < 3:
        normalized["keyTakeaways"] = [
            "Public-facing copy should describe operations and limits, not guaranteed outcomes.",
            "Policy pages need to match actual refund handling, evidence requests, and support windows.",
            "A category becomes easier to defend when screenshots, logs, and order records already exist before review starts.",
        ]
    zh_takeaways = normalized.get("zhKeyTakeaways", [])
    if not isinstance(zh_takeaways, list):
        zh_takeaways = []
    normalized["zhKeyTakeaways"] = [first_string(item) for item in zh_takeaways if first_string(item)]
    if len(normalized["zhKeyTakeaways"]) < 3:
        normalized["zhKeyTakeaways"] = list(normalized["keyTakeaways"])

    sections = normalized.get("sections", [])
    if not isinstance(sections, list):
        sections = []
    cleaned_sections = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        heading = articleize_text(first_string(section.get("heading"), "What compliant operating language looks like"))
        body = paragraphize(
            first_string(
                section.get("body"),
                "Keep claims tied to observable operations, policies, support records, and fulfillment evidence.",
            ),
            "When a section cannot name the operational boundary, the proof source, and the customer-facing implication, it still reads like an internal note rather than a publishable article.",
        )
        cleaned_sections.append(
            {
                "heading": heading,
                "zhHeading": first_string(section.get("zhHeading"), heading),
                "body": body,
                "zhBody": first_string(section.get("zhBody"), body),
            }
        )
    if len(cleaned_sections) < 4:
        fallback = build_fallback_article(state, seed, state.get("revision_count", 0))
        cleaned_sections = fallback["sections"]
    normalized["sections"] = cleaned_sections

    normalized["conclusion"] = paragraphize(
        first_string(
            normalized.get("conclusion"),
            "For cross-border sellers, the goal is not to sound more aggressive than the market. The goal is to make every public claim easy to explain, easy to evidence, and easy to defend when a payment team, marketplace reviewer, or customer dispute asks for proof.\n\nOnce product copy, policy language, and support records describe the same operating reality, this category becomes far easier to sell without inviting unnecessary compliance friction.",
        ),
        "That is the standard a publishable insight article should meet: not louder language, but tighter alignment between what the market reads, what support can prove, and what the business is actually prepared to deliver.",
    )
    normalized["zhConclusion"] = first_string(normalized.get("zhConclusion"), normalized["conclusion"])

    related_keywords = normalized.get("relatedKeywords", [])
    if not isinstance(related_keywords, list):
        related_keywords = []
    normalized["relatedKeywords"] = [first_string(item) for item in related_keywords if first_string(item)]
    if len(normalized["relatedKeywords"]) < 6:
        normalized["relatedKeywords"] = list(
            dict.fromkeys(
                normalized["relatedKeywords"]
                + [seed, normalized["category"], normalized["market"]]
                + state.get("safe_terms", [])[:6]
            )
        )[:8]

    faq = normalized.get("faq", [])
    if not isinstance(faq, list):
        faq = []
    cleaned_faq = []
    for item in faq:
        if not isinstance(item, dict):
            continue
        question = first_string(item.get("question"))
        answer = paragraphize(first_string(item.get("answer")))
        if question and answer:
            cleaned_faq.append(
                {
                    "question": question,
                    "answer": answer,
                    "zhQuestion": first_string(item.get("zhQuestion"), question),
                    "zhAnswer": first_string(item.get("zhAnswer"), answer),
                }
            )
    if len(cleaned_faq) < 3:
        cleaned_faq = [
            {
                "question": "What usually triggers extra scrutiny in this category?",
                "answer": "Scrutiny usually builds when product claims, policy wording, and support messages describe different realities. The risk is not a single phrase by itself, but the pattern of promises the business cannot fully evidence once a payment review, platform escalation, or customer dispute arrives.",
                "zhQuestion": "What usually triggers extra scrutiny in this category?",
                "zhAnswer": "Scrutiny usually builds when product claims, policy wording, and support messages describe different realities. The risk is not a single phrase by itself, but the pattern of promises the business cannot fully evidence once a payment review, platform escalation, or customer dispute arrives.",
            },
            {
                "question": "What should a compliant article help the operator prepare?",
                "answer": "It should help the operator align SEO copy, policy pages, refund handling language, support windows, and evidence files. A useful article is not only readable; it also maps directly to the records and workflows the team will rely on during review.",
                "zhQuestion": "What should a compliant article help the operator prepare?",
                "zhAnswer": "It should help the operator align SEO copy, policy pages, refund handling language, support windows, and evidence files. A useful article is not only readable; it also maps directly to the records and workflows the team will rely on during review.",
            },
            {
                "question": "Why is evidence preparation part of SEO content quality here?",
                "answer": "Because the page will eventually be tested by reality. If the article implies a cleaner process or a broader claim than the business can prove, the content may attract traffic but it also raises dispute and review risk. Evidence keeps the article commercially usable.",
                "zhQuestion": "Why is evidence preparation part of SEO content quality here?",
                "zhAnswer": "Because the page will eventually be tested by reality. If the article implies a cleaner process or a broader claim than the business can prove, the content may attract traffic but it also raises dispute and review risk. Evidence keeps the article commercially usable.",
            },
        ]
    normalized["faq"] = cleaned_faq

    normalized["bodyMarkdown"] = first_string(normalized.get("bodyMarkdown"))
    if not normalized["bodyMarkdown"]:
        normalized["bodyMarkdown"] = build_markdown_article(normalized, state, "en")
    normalized["zhBodyMarkdown"] = first_string(normalized.get("zhBodyMarkdown"))
    if not normalized["zhBodyMarkdown"]:
        normalized["zhBodyMarkdown"] = build_markdown_article(normalized, state, "zh")

    toc = normalized.get("toc", [])
    if not isinstance(toc, list):
        toc = []
    normalized["toc"] = []
    for item in toc:
        if not isinstance(item, dict):
            continue
        label = first_string(item.get("label"))
        if not label:
            continue
        normalized["toc"].append(
            {
                "id": slugify(first_string(item.get("id"), label)),
                "label": label,
                "zhLabel": first_string(item.get("zhLabel"), label),
                "level": 3 if item.get("level") == 3 else 2,
            }
        )
    if len(normalized["toc"]) < 5:
        normalized["toc"] = build_toc_from_markdown(normalized["bodyMarkdown"])
        if len(normalized["toc"]) < 5:
            normalized["toc"] = build_toc_from_markdown(build_markdown_article(normalized, state, "en"))

    return sanitize_article_claims(normalized)


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
        transient_errors = []
        for attempt in range(1, 4):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    raw = response.read().decode("utf-8")
                break
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                raise PipelineError("LLM request failed: HTTP %s %s" % (exc.code, body[:800]))
            except (TimeoutError, socket.timeout, ssl.SSLError, urllib.error.URLError, ConnectionResetError, OSError) as exc:
                reason = getattr(exc, "reason", exc)
                transient_errors.append(str(reason))
                if attempt >= 3:
                    raise PipelineError(
                        "LLM network request failed after 3 attempts. Check API Base URL, proxy/VPN, and provider endpoint. Details: %s"
                        % " | ".join(transient_errors[-3:])
                    )
                time.sleep(1.5 * attempt)

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
    emit_progress(seed, "Researcher Agent", "running", "researcher_started")
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

    emit_progress(
        seed,
        "Researcher Agent",
        "completed",
        "researcher_completed",
        {
            "profile": profile_key,
            "source_count": len(source_snippets),
            "review_count": len(review_snippets),
            "redline_count": len(redline_terms),
        },
    )
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
    slug = slugify(safe_seed + " compliance guide")
    evidence_items = state.get("evidence", [])[:5]
    evidence_text = ", ".join(evidence_items) if evidence_items else "policy screenshots, support logs, fulfillment records, and order tracking evidence"
    safe_terms = state.get("safe_terms", [])[:6]
    safe_terms_text = ", ".join(safe_terms) if safe_terms else "documented specifications, operational limits, support process, and evidence-backed language"
    rewrite_note = " after reviewer revision" if revision_count > 0 else ""
    return {
        "slug": slug,
        "title": "What cross-border sellers should fix before scaling %s%s" % (seed_title, rewrite_note),
        "zhTitle": "%s compliance article" % safe_seed,
        "category": profile.get("category", "Payment Risk"),
        "market": market,
        "riskLevel": profile.get("risk_level", "High"),
        "updatedAt": dt.date.today().isoformat(),
        "metaTitle": "What cross-border sellers should fix before scaling %s" % seed_title,
        "metaDescription": "A long-form compliance article on safer claims, policy wording, support boundaries, and evidence files for %s sellers in %s." % (seed_title, market),
        "dek": "A publishable intelligence article on the claims, policy wording, support boundaries, and evidence files that matter before this category attracts avoidable review.",
        "zhDek": "An article introduction for %s covering product claims, policy wording, and evidence preparation." % safe_seed,
        "summary": "A publishable compliance article for teams selling %s into %s. It explains how to write readable public copy, align policy pages with real operations, and prepare the evidence package needed before disputes, payment review, or platform checks arrive." % (seed_title, market),
        "zhSummary": "A publishable long-form article for %s that explains how page copy, policy pages, support language, and evidence files should stay aligned." % safe_seed,
        "introduction": (
            "Many operators treat category compliance as a last-minute editing problem. In practice, review pressure builds much earlier: "
            "the article headline promises too much, the policy page suggests a cleaner process than the team can prove, and support "
            "messages quietly introduce a third version of the truth.\n\n"
            "A real publishable article should do more than list red flags. It should explain where scrutiny starts, how demand-capture "
            "language can stay commercially useful without drifting into prohibited claims, and what documents must already exist before "
            "the first dispute lands."
        ),
        "zhIntroduction": (
            "This article should open by explaining how scrutiny begins: not with one phrase alone, but when page claims, policy wording, "
            "and support language describe different realities.\n\n"
            "It should then explain which commercially useful expressions can stay public, which phrases must stay internal, and what "
            "documents need to exist before the first dispute or review arrives."
        ),
        "keyTakeaways": [
            "Use the article to clarify operating boundaries, not just to replace a few risky adjectives.",
            "Align product copy, FAQ answers, refund policy, and support responses so they describe the same reality.",
            "Keep redline phrases in an internal warning list and keep public-facing copy tied to verifiable operations.",
            "Build the evidence package before scale so the article can support SEO, customer service, and review defense at the same time.",
        ],
        "zhKeyTakeaways": [
            "Use the article to define operating boundaries instead of just swapping risky adjectives.",
            "Product copy, FAQ answers, refund policy, and support responses should describe the same reality.",
            "Keep redline phrases inside an internal warning list and keep public copy tied to verifiable operations.",
            "Prepare evidence before scale so the article can support SEO, support handling, and review defense together.",
        ],
        "redlineTerms": state.get("redline_terms", [])[:8],
        "relatedKeywords": list(dict.fromkeys([safe_seed, seed_title, market] + safe_terms + evidence_items))[:8],
        "sections": [
            {
                "heading": "Why %s starts drawing review before the seller notices" % seed_title,
                "zhHeading": "Why %s enters review before the seller notices" % safe_seed,
                "body": (
                    "For %s, the real risk rarely starts with one forbidden word alone. Review pressure usually comes from the combination "
                    "of product claims, refund expectations, delivery promises, and how clearly the seller explains operational limits. "
                    "A publishable article should show that scrutiny begins when these layers contradict each other, not only when a single "
                    "phrase looks aggressive.\n\n"
                    "That is why article structure matters. The headline should frame the business problem, the introduction should explain "
                    "the review context, and the body should move from claim risk to policy risk to evidence risk. If the copy reads like "
                    "a memo, it stays internal. If it reads like an article with a clear argument, it becomes useful on-site intelligence."
                ) % seed_title,
                "zhBody": (
                    "This section should explain why review pressure starts early: product promises, refund expectations, delivery language, "
                    "and operational boundaries begin to conflict.\n\n"
                    "It should also explain why article structure matters. A real article frames the business problem, explains the review "
                    "context, and then develops the argument through claims, policy language, and evidence."
                ),
            },
            {
                "heading": "Which claims should stay out of the article, not just out of the ad copy",
                "zhHeading": "Which claims should stay out of the article, not just out of ads",
                "body": (
                    "High-intent keywords still matter, but they must not force the page into prohibited or unverifiable claims. Build article "
                    "sections around safer demand-capture phrases such as %s, then explain what each phrase can and cannot imply in public-facing "
                    "copy.\n\n"
                    "The important distinction is editorial. A good article can name the redline problem, explain why it is risky, and then pivot "
                    "into safer wording without sounding evasive. Keep the truly sensitive wording in an internal warning list instead of surfacing "
                    "it in titles, checkout copy, return policies, or ad language."
                ) % safe_terms_text,
                "zhBody": (
                    "This section should show that commercial intent and compliant language can coexist when the article is built around safer "
                    "phrases and clear boundaries.\n\n"
                    "It should explain that the article may discuss redline problems, but it should not repeat those phrases as if they belong in "
                    "titles, policy pages, or checkout copy."
                ),
            },
            {
                "heading": "What a readable article reveals about the real support stack",
                "zhHeading": "What a readable article reveals about the real support stack",
                "body": (
                    "A stronger page does not just rewrite adjectives. It aligns product copy, FAQ answers, refund language, fulfillment notes, "
                    "and support replies so they all describe the same operating reality. The article becomes persuasive when readers leave with "
                    "a clear picture of what the product does, what it does not do, how support responds, and which promises the seller is willing "
                    "to stand behind in writing.\n\n"
                    "This is also where many generated drafts fail. They sound polished, but they do not translate into customer-service behavior. "
                    "A publishable article has to bridge that gap by showing what the operator will actually document, how evidence will be collected, "
                    "and where the support boundary sits when a claim is challenged."
                ),
                "zhBody": (
                    "This section should translate polished wording into real support behavior: what the product does, what it does not do, how the "
                    "team responds, and which promises the business is willing to stand behind.\n\n"
                    "That is the difference between a decorative AI draft and an article that can actually support operations."
                ),
            },
            {
                "heading": "Which evidence files turn the article into an operating asset",
                "zhHeading": "Which evidence files turn the article into an operating asset",
                "body": (
                    "The article only becomes operationally useful when it is backed by documents. For this category, the minimum evidence set should "
                    "include %s. Without that layer, even well-written copy remains a content exercise rather than a defensible commercial asset.\n\n"
                    "Once those files exist, the article can support SEO work, payment review, customer-service handling, and internal training at the "
                    "same time. That is the standard worth aiming for: not a decorative article, but one that still makes sense when a dispute, review, "
                    "or audit asks for proof."
                ) % evidence_text,
                "zhBody": (
                    "This section should identify the evidence package that makes the article operationally useful instead of merely readable.\n\n"
                    "Once those files exist, the same article can support SEO, support handling, payment review, and internal training without losing coherence."
                ),
            },
        ],
        "conclusion": (
            "A real article in this library should leave the reader with a practical standard: every public claim should map to an operating fact, "
            "every policy promise should map to a support process, and every sensitive category should map to an evidence file. That is how a compliance "
            "article becomes commercially useful.\n\n"
            "For teams scaling cross-border traffic, the goal is not simply to sound safer. The goal is to publish a piece that can survive contact with "
            "buyers, support tickets, payment reviewers, and internal training without collapsing into contradiction."
        ),
        "zhConclusion": (
            "The conclusion should leave the reader with one standard: every public claim maps to an operating fact, every policy promise maps to a "
            "support process, and every sensitive category maps to an evidence file.\n\n"
            "That is what turns an article from a thin briefing note into an asset that still holds up when buyers, payment teams, or internal reviewers ask for proof."
        ),
        "faq": [
            {
                "question": "What usually triggers extra scrutiny in this category?",
                "answer": "Extra scrutiny usually comes from conflicting signals across product copy, policy language, support messages, and checkout promises. Reviewers and customers compare those layers against each other, so inconsistency is often a bigger risk than any one phrase alone.",
                "zhQuestion": "What usually triggers extra scrutiny in this category?",
                "zhAnswer": "Extra scrutiny usually comes from conflicting signals across product copy, policy language, support messages, and checkout promises. Reviewers and customers compare those layers against each other, so inconsistency is often a bigger risk than any one phrase alone.",
            },
            {
                "question": "How should the article handle high-intent commercial keywords?",
                "answer": "It should keep commercial relevance while tightening the implied promise. The article can discuss what buyers search for, but it should reframe those terms through operational wording, documented limits, and evidence-backed explanations.",
                "zhQuestion": "How should the article handle high-intent commercial keywords?",
                "zhAnswer": "It should keep commercial relevance while tightening the implied promise. The article can discuss what buyers search for, but it should reframe those terms through operational wording, documented limits, and evidence-backed explanations.",
            },
            {
                "question": "What evidence should exist before traffic scales?",
                "answer": "The minimum evidence package should cover policy screenshots, support logs, fulfillment records, and order-tracking or product-performance proof relevant to the category. Those files let the article remain defensible when disputes, reviews, or audits arrive.",
                "zhQuestion": "What evidence should exist before traffic scales?",
                "zhAnswer": "The minimum evidence package should cover policy screenshots, support logs, fulfillment records, and order-tracking or product-performance proof relevant to the category. Those files let the article remain defensible when disputes, reviews, or audits arrive.",
            },
        ],
        "bodyMarkdown": "",
        "zhBodyMarkdown": "",
        "toc": [],
    }


def writer_agent(state: WorkflowState) -> Dict[str, Any]:
    revision_count = state.get("revision_count", 0)
    seed = state["seed"]
    emit_progress(
        seed,
        "Writer Agent",
        "running",
        "writer_started" if revision_count == 0 else "writer_rewrite_started",
        {"revision": revision_count},
    )
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
                "metaTitle": "SEO title under 80 chars",
                "metaDescription": "SEO meta description under 180 chars",
                "dek": "English deck under headline",
                "zhDek": "Chinese deck under headline",
                "summary": "English summary",
                "zhSummary": "Chinese summary",
                "introduction": "Two-paragraph English introduction",
                "zhIntroduction": "Two-paragraph Chinese introduction",
                "keyTakeaways": ["3-5 English bullets"],
                "zhKeyTakeaways": ["3-5 Chinese bullets"],
                "bodyMarkdown": "Long-form markdown article with 5-8 H2/H3 headings, at least 900 English words, lists, and embedded CTA",
                "zhBodyMarkdown": "Localized markdown article",
                "toc": [{"id": "heading-id", "label": "English heading", "zhLabel": "Chinese heading", "level": 2}],
                "faq": [{"question": "", "answer": "", "zhQuestion": "", "zhAnswer": ""}],
                "relatedKeywords": ["keyword variants"],
                "redlineTerms": ["terms"],
                "sections": [{"heading": "", "zhHeading": "", "body": "", "zhBody": ""}],
                "conclusion": "Two-paragraph English conclusion",
                "zhConclusion": "Two-paragraph Chinese conclusion",
            },
        }
        article = llm.chat_json(
            "You are writing a publishable SEO intelligence article for a cross-border compliance insights library. Do not write an internal framework, architecture note, brief, memo, or checklist. Write a polished long-form article in a restrained, authoritative consulting tone. The output must read like a real website article a buyer would read end to end: headline, SEO metadata, deck, introduction, key takeaways, 5-8 developed H2/H3 sections, FAQ, and conclusion. bodyMarkdown is the primary article body and must be a real long-form markdown article, not section fragments pasted together. Each major section should have 2-4 developed paragraphs. Include one bullet list, one short warning or quote block, and one embedded CTA sentence about diagnostic review. redlineTerms must list forbidden phrases that should stay out of public-facing copy; do not rewrite those warning phrases into euphemisms. Avoid every red line term exactly and semantically in the title, meta description, deck, summary, introduction, markdown body, FAQ answers, and conclusion. For pet devices, do not use medical, veterinary, disease, treatment, cure, anxiety-treatment, prevention, pain-relief, or clinically-proven claims. Use only operational wording such as feeding schedule, portion control, routine support, setup, support logs, policies, and evidence files. Return only JSON matching the required schema.",
            json.dumps(payload, ensure_ascii=False),
            temperature=0.35,
        )
    article = normalize_article(article, state)

    emit_progress(
        seed,
        "Writer Agent",
        "completed",
        "writer_completed" if revision_count == 0 else "writer_rewrite_completed",
        {"revision": revision_count, "slug": article.get("slug"), "title": article.get("title")},
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
    parts = [
        article.get("title", ""),
        article.get("metaTitle", ""),
        article.get("metaDescription", ""),
        article.get("dek", ""),
        article.get("summary", ""),
        article.get("introduction", ""),
        article.get("bodyMarkdown", ""),
        article.get("conclusion", ""),
        article.get("zhTitle", ""),
        article.get("zhDek", ""),
        article.get("zhSummary", ""),
        article.get("zhIntroduction", ""),
        article.get("zhBodyMarkdown", ""),
        article.get("zhConclusion", ""),
    ]
    parts.extend(article.get("keyTakeaways", []))
    parts.extend(article.get("zhKeyTakeaways", []))
    parts.extend(article.get("relatedKeywords", []))
    for section in article.get("sections", []):
        parts.extend([section.get("heading", ""), section.get("zhHeading", ""), section.get("body", ""), section.get("zhBody", "")])
    for item in article.get("faq", []):
        if isinstance(item, dict):
            parts.extend([item.get("question", ""), item.get("answer", ""), item.get("zhQuestion", ""), item.get("zhAnswer", "")])
    return "\n".join(parts)


def deterministic_review(state: WorkflowState) -> Tuple[bool, List[str], str]:
    article = state["article"]
    findings = contains_any(publishable_text(article), state.get("strict_terms", []))
    article_voice_text = "\n".join(
        [article.get("title", ""), article.get("summary", "")]
        + [section.get("heading", "") for section in article.get("sections", [])]
    ).lower()
    if any(term in article_voice_text for term in ["architecture", "architectures", "framework", "frameworks", "checklist", "checklists", "brief", "briefs"]):
        findings.append("internal-document wording in article copy")
    if not article.get("dek"):
        findings.append("missing deck")
    if not article.get("introduction"):
        findings.append("missing introduction")
    if len(article.get("keyTakeaways", [])) < 3:
        findings.append("missing key takeaways")
    if not article.get("conclusion"):
        findings.append("missing conclusion")
    if not article.get("bodyMarkdown"):
        findings.append("missing body markdown")
    if not article.get("faq") or len(article.get("faq", [])) < 3:
        findings.append("missing faq")
    if not article.get("toc") or len(article.get("toc", [])) < 5:
        findings.append("missing toc")
    if len(article.get("sections", [])) < 4:
        findings.append("too few sections")
    if len(article.get("bodyMarkdown", "")) < 4000:
        findings.append("markdown article too short")
    if len(publishable_text(article)) < 6000:
        findings.append("article is too thin")
    for idx, section in enumerate(article.get("sections", []), start=1):
        if len(first_string(section.get("body"))) < 280:
            findings.append("section %s body too short" % idx)
        if "\n\n" not in first_string(section.get("body")):
            findings.append("section %s lacks developed paragraphs" % idx)
    markdown_headings = re.findall(r"^##+\s+.+$", first_string(article.get("bodyMarkdown")), flags=re.MULTILINE)
    if len(markdown_headings) < 5:
        findings.append("not enough markdown headings")
    if any(term in publishable_text(article).lower() for term in ["best ever", "miracle", "easy money", "100 percent"]):
        findings.append("overpromising marketing tone")
    feedback = "Remove forbidden or overpromising language and rewrite with evidence-bounded claims: %s" % ", ".join(findings)
    return len(findings) == 0, findings, feedback


def reviewer_agent(state: WorkflowState) -> Dict[str, Any]:
    seed = state["seed"]
    emit_progress(
        seed,
        "Reviewer Agent",
        "running",
        "reviewer_started",
        {"revision": state.get("revision_count", 0)},
    )
    passed, findings, feedback = deterministic_review(state)
    llm = state.get("llm")
    reviewer_warning = ""
    if state.get("use_llm") and llm and llm.available and passed:
        try:
            result = llm.chat_json(
                "You are a cold compliance officer. Review the draft against red_lines, medical implications, payment overpromises, and AI-like generic marketing. redlineTerms is a warning list and may contain prohibited phrases by design; do not reject the draft solely because the warning list names those phrases. Reject only when forbidden language or equivalent promises appear in the title, summary, or section bodies as public-facing copy. Return JSON: {\"status\":\"PASS|REJECT\",\"findings\":[...],\"feedback\":\"...\"}.",
                json.dumps({"red_lines": state.get("redline_terms", []), "draft": state.get("article", {})}, ensure_ascii=False),
                temperature=0.0,
            )
            if str(result.get("status", "")).upper() == "REJECT":
                passed = False
                findings = list(result.get("findings", [])) or ["llm reviewer rejected draft"]
                feedback = str(result.get("feedback", "Rewrite with tighter compliance language."))
        except PipelineError as exc:
            reviewer_warning = "Remote reviewer unavailable; kept deterministic review result: %s" % exc
            print(reviewer_warning)

    revision_count = state.get("revision_count", 0)
    blocked = (not passed) and revision_count >= MAX_REVISIONS
    if passed:
        emit_progress(seed, "Reviewer Agent", "completed", "reviewer_completed", {"revision": revision_count})
    elif blocked:
        emit_progress(seed, "Reviewer Agent", "blocked", "reviewer_blocked", {"revision": revision_count, "findings": findings})
    else:
        emit_progress(seed, "Reviewer Agent", "rejected", "reviewer_rejected", {"revision": revision_count, "findings": findings})
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
            {
                "passed": passed,
                "revision": revision_count,
                "findings": findings,
                "blocked": blocked,
                "feedback": "" if passed else feedback,
                "warning": reviewer_warning,
            },
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
    required = [
        "slug",
        "title",
        "zhTitle",
        "category",
        "market",
        "riskLevel",
        "updatedAt",
        "metaTitle",
        "metaDescription",
        "dek",
        "zhDek",
        "summary",
        "zhSummary",
        "introduction",
        "zhIntroduction",
        "keyTakeaways",
        "zhKeyTakeaways",
        "bodyMarkdown",
        "zhBodyMarkdown",
        "toc",
        "faq",
        "relatedKeywords",
        "redlineTerms",
        "sections",
        "conclusion",
        "zhConclusion",
    ]
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
    if not isinstance(article.get("redlineTerms"), list) or len(article.get("redlineTerms", [])) < 4:
        errors.append("redlineTerms must contain at least four terms")
    if not isinstance(article.get("keyTakeaways"), list) or len(article.get("keyTakeaways", [])) < 3:
        errors.append("keyTakeaways must contain at least three bullets")
    if not isinstance(article.get("zhKeyTakeaways"), list) or len(article.get("zhKeyTakeaways", [])) < 3:
        errors.append("zhKeyTakeaways must contain at least three bullets")
    if not isinstance(article.get("relatedKeywords"), list) or len(article.get("relatedKeywords", [])) < 6:
        errors.append("relatedKeywords must contain at least six keyword variants")
    if not isinstance(article.get("faq"), list) or len(article.get("faq", [])) < 3:
        errors.append("faq must contain at least three entries")
    else:
        for index, item in enumerate(article.get("faq", [])):
            for field in ["question", "answer", "zhQuestion", "zhAnswer"]:
                if not first_string(item.get(field)):
                    errors.append("faq[%d] missing field: %s" % (index, field))
    if not isinstance(article.get("toc"), list) or len(article.get("toc", [])) < 5:
        errors.append("toc must contain at least five entries")
    if len(first_string(article.get("bodyMarkdown"))) < 4000:
        errors.append("bodyMarkdown is too short for a publishable article")
    if len(first_string(article.get("zhBodyMarkdown"))) < 2000:
        errors.append("zhBodyMarkdown is too short for a localized article")
    sections = article.get("sections", [])
    if not isinstance(sections, list) or len(sections) < 4:
        errors.append("sections must contain at least four sections")
    for index, section in enumerate(sections):
        for field in ["heading", "zhHeading", "body", "zhBody"]:
            if not section.get(field):
                errors.append("sections[%d] missing field: %s" % (index, field))
        if len(first_string(section.get("body"))) < 280:
            errors.append("sections[%d].body is too short for a publishable article" % index)
        if "\n\n" not in first_string(section.get("body")):
            errors.append("sections[%d].body should contain at least two paragraphs" % index)
    markdown_headings = re.findall(r"^##+\s+.+$", first_string(article.get("bodyMarkdown")), flags=re.MULTILINE)
    if len(markdown_headings) < 5:
        errors.append("bodyMarkdown should contain at least five H2/H3 headings")
    if len(publishable_text(article)) < 6000:
        errors.append("article is too thin for publication")
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

    emit_progress(args.seed, "Pipeline", "running", "pipeline_started")
    state = run_workflow(args.seed, notes, profiles, forbidden_terms, args.source_dir, args.reviews_dir)
    if state.get("blocked"):
        raise PipelineError("Reviewer blocked the article after %s revision(s): %s" % (state.get("revision_count", 0), ", ".join(state.get("review_findings", []))))
    emit_progress(args.seed, "Fail-Safe", "running", "failsafe_started")
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
    emit_progress(args.seed, "Fail-Safe", "completed", "failsafe_completed", {"output": str(output_path), "audit": str(audit_path)})
    emit_progress(args.seed, "Pipeline", "completed", "pipeline_completed", {"output": str(output_path)})
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
