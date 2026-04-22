import argparse
import datetime as dt
import hashlib
import json
import re
import sys
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
MAX_REVISIONS = 2

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
    profile_key: str
    profile: Dict[str, Any]
    safe_terms: List[str]
    evidence: List[str]
    redline_terms: List[str]
    strict_terms: List[str]
    article: Dict[str, Any]
    review_passed: bool
    review_findings: List[str]
    revision_count: int
    blocked: bool
    trace: List[Dict[str, Any]]


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


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
    notes_hits = contains_any(state.get("notes", ""), strict_terms)
    redline_terms = list(dict.fromkeys(profile.get("redline_terms", []) + notes_hits))

    return {
        "profile_key": profile_key,
        "profile": profile,
        "safe_terms": profile.get("safe_terms", []),
        "evidence": profile.get("evidence", []),
        "redline_terms": redline_terms,
        "strict_terms": strict_terms,
        "trace": append_trace(
            state,
            "Researcher Agent",
            "selected profile and redline terms",
            {
                "profile": profile_key,
                "category": profile.get("category"),
                "risk_level": profile.get("risk_level"),
                "redline_terms": redline_terms,
            },
        ),
    }


def build_article(state: WorkflowState, safe_seed: str, revision_count: int) -> Dict[str, Any]:
    profile = state["profile"]
    category = profile.get("category", "Payment Risk")
    risk_level = profile.get("risk_level", "High")
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
        "category": category,
        "market": market,
        "riskLevel": risk_level,
        "updatedAt": dt.date.today().isoformat(),
        "summary": (
            "A structured compliance intelligence brief for teams preparing SEO wording, "
            "policy pages, evidence files, and review-ready explanations around %s in %s."
            % (seed_title, market)
        ),
        "zhSummary": (
            "面向%s场景的合规情报简报，用于整理 SEO 表达、政策页面、证据文件和可审阅的业务说明。"
            % safe_seed
        ),
        "redlineTerms": state.get("redline_terms", [])[:8],
        "sections": [
            {
                "heading": "Commercial wording must stay inside the evidence boundary",
                "zhHeading": "商业表达必须停留在证据边界内",
                "body": (
                    "For %s, the safest content strategy is to describe observable product facts, "
                    "operating procedures, refund handling, fulfillment limits, and support channels. "
                    "Avoid broad outcome promises. The page should make a reviewer understand what is sold, "
                    "how it is delivered, how disputes are handled, and what evidence supports each claim."
                    % seed_title
                ),
                "zhBody": (
                    "针对%s，稳妥的内容策略是描述可验证的产品事实、运营流程、退款处理、履约边界和客服通道。"
                    "不要使用宽泛的结果承诺。页面应让审核方清楚知道卖的是什么、如何交付、争议如何处理，以及每个说法由什么证据支撑。"
                    % safe_seed
                ),
            },
            {
                "heading": "Keyword assets should separate demand capture from risk claims",
                "zhHeading": "关键词资产要把需求捕获与风险承诺分开",
                "body": (
                    "High-intent keywords can be useful, but they should not force the page into prohibited or "
                    "unverifiable claims. Build the keyword bank around safer phrases such as %s. "
                    "Keep sensitive phrases in a redline list for internal review rather than placing them in titles, "
                    "checkout copy, policy pages, or advertising claims."
                    % safe_terms_text
                ),
                "zhBody": (
                    "高意向关键词有价值，但不能把页面推向禁止性或不可验证的承诺。关键词库应围绕更安全的表达构建，例如：%s。"
                    "敏感词应进入内部红线清单，而不是出现在标题、结账文案、政策页面或广告承诺中。"
                    % safe_terms_text
                ),
            },
            {
                "heading": "Evidence files make the asset reusable",
                "zhHeading": "证据文件决定资产能否复用",
                "body": (
                    "A reusable compliance asset should include the keyword list, safer alternatives, platform-specific "
                    "policy notes, and an evidence checklist. For this category, the minimum evidence set should include: "
                    "%s. This keeps the asset useful for SEO, payment review, customer support, and internal training."
                    % evidence_text
                ),
                "zhBody": (
                    "可复用的合规资产应包含关键词列表、安全替代表达、平台政策说明和证据清单。该类目最低证据集应包括：%s。"
                    "这样它才能同时服务于 SEO、支付审核、客服回应和内部培训。"
                    % evidence_text
                ),
            },
        ],
    }


def writer_agent(state: WorkflowState) -> Dict[str, Any]:
    revision_count = state.get("revision_count", 0)
    seed = state["seed"]
    safe_seed = sanitize_claim_text(seed) if revision_count > 0 else seed
    article = build_article(state, safe_seed=safe_seed, revision_count=revision_count)

    return {
        "article": article,
        "trace": append_trace(
            state,
            "Writer Agent",
            "drafted article" if revision_count == 0 else "rewrote article after reviewer rejection",
            {
                "revision": revision_count,
                "slug": article["slug"],
                "title": article["title"],
            },
        ),
    }


def publishable_text(article: Dict[str, Any]) -> str:
    parts = [
        article.get("title", ""),
        article.get("summary", ""),
        article.get("zhTitle", ""),
        article.get("zhSummary", ""),
    ]
    for section in article.get("sections", []):
        parts.extend(
            [
                section.get("heading", ""),
                section.get("zhHeading", ""),
                section.get("body", ""),
                section.get("zhBody", ""),
            ]
        )
    return "\n".join(parts)


def reviewer_agent(state: WorkflowState) -> Dict[str, Any]:
    article = state["article"]
    hits = contains_any(publishable_text(article), state.get("strict_terms", []))
    revision_count = state.get("revision_count", 0)
    passed = len(hits) == 0
    blocked = (not passed) and revision_count >= MAX_REVISIONS

    return {
        "review_passed": passed,
        "review_findings": hits,
        "revision_count": revision_count if passed else revision_count + 1,
        "blocked": blocked,
        "trace": append_trace(
            state,
            "Reviewer Agent",
            "approved article" if passed else "rejected article and requested rewrite",
            {
                "passed": passed,
                "revision": revision_count,
                "findings": hits,
                "blocked": blocked,
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
        "summary",
        "zhSummary",
        "redlineTerms",
        "sections",
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
    graph.add_conditional_edges(
        "reviewer",
        route_after_review,
        {
            "rewrite": "writer",
            "final": END,
            "blocked": END,
        },
    )
    return graph.compile()


def run_fallback_state_machine(initial_state: WorkflowState) -> WorkflowState:
    state = dict(initial_state)
    state.update(researcher_agent(state))

    while True:
        state.update(writer_agent(state))
        state.update(reviewer_agent(state))
        route = route_after_review(state)
        if route in {"final", "blocked"}:
            return state


def run_workflow(seed: str, notes: str, profiles: Dict[str, Any], forbidden_terms: Dict[str, Any]) -> WorkflowState:
    initial_state: WorkflowState = {
        "seed": seed,
        "notes": notes.strip(),
        "revision_count": 0,
        "trace": [],
        "profiles": profiles,
        "forbidden_terms": forbidden_terms,
    }

    app = build_langgraph_app()
    if app is None:
        state = run_fallback_state_machine(initial_state)
        state["trace"] = append_trace(
            state,
            "Runtime",
            "used compatibility fallback because LangGraph is not installed",
            {"python": sys.version.split()[0]},
        )
        return state

    state = app.invoke(initial_state)
    state["trace"] = append_trace(
        state,
        "Runtime",
        "executed with LangGraph StateGraph",
        {"python": sys.version.split()[0]},
    )
    return state


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a compliance insight draft with a multi-agent LangGraph workflow.")
    parser.add_argument("--seed", required=True, help="Seed keyword or category, for example: 智能宠物喂食器")
    parser.add_argument("--notes-file", default="", help="Optional local notes file to enrich the intelligence brief.")
    parser.add_argument("--draft-dir", default="local-brain/drafts", help="Output directory for generated JSON drafts.")
    parser.add_argument("--audit-dir", default="local-brain/audits", help="Output directory for workflow audit traces.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite an existing draft with the same slug.")
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

    state = run_workflow(args.seed, notes, profiles, forbidden_terms)

    if state.get("blocked"):
        raise PipelineError("Reviewer blocked the article after %s revision(s): %s" % (
            state.get("revision_count", 0),
            ", ".join(state.get("review_findings", [])),
        ))

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
                "profile": state.get("profile_key"),
                "review_passed": state.get("review_passed"),
                "review_findings": state.get("review_findings", []),
                "revision_count": state.get("revision_count", 0),
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
