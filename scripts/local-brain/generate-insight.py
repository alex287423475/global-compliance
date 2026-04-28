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


ROOT = Path.cwd()
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

CATEGORY_ALIASES = {
    "支付风控": "Payment Risk",
    "支付网关": "Payment Risk",
    "拒付": "Payment Risk",
    "冻结": "Payment Risk",
    "平台申诉": "Marketplace Appeal",
    "亚马逊申诉": "Marketplace Appeal",
    "poa": "Marketplace Appeal",
    "市场准入": "Market Entry",
    "fda": "Market Entry",
    "ce": "Market Entry",
    "供应链合规": "Supply Chain",
    "供应链": "Supply Chain",
    "溯源": "Supply Chain",
    "知识产权攻防": "IP Defense",
    "知识产权": "IP Defense",
    "版权": "IP Defense",
    "危机公关": "Crisis PR",
    "舆情": "Crisis PR",
    "资本运作": "Capital Documents",
    "融资": "Capital Documents",
    "ipo": "Capital Documents",
    "b2b 合规": "B2B Contracts",
    "合同": "B2B Contracts",
    "税务": "Tax & Audit",
    "审计": "Tax & Audit",
    "隐私与数据合规": "Data Privacy",
    "隐私": "Data Privacy",
    "数据合规": "Data Privacy",
    "seo 资产": "Payment Risk",
}

CATEGORY_PROFILE_HINTS = {
    "Payment Risk": "payment-gateway-review",
    "Marketplace Appeal": "amazon-marketplace",
    "Market Entry": "payment-gateway-review",
    "Supply Chain": "supply-chain",
    "IP Defense": "amazon-marketplace",
    "Crisis PR": "payment-gateway-review",
    "Capital Documents": "payment-gateway-review",
    "B2B Contracts": "supply-chain",
    "Tax & Audit": "payment-gateway-review",
    "Data Privacy": "payment-gateway-review",
}

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
    slug_override: str
    content_mode: str
    locale: str
    keyword_category: str
    keyword_intent: str
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


def read_prompt_file(file_name: str, fallback: str) -> str:
    path = ROOT / "local-brain" / "prompts" / file_name
    if not path.exists():
        return fallback
    text = path.read_text(encoding="utf-8").strip()
    return text or fallback


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


def fact_source_blocks(article: Dict[str, Any], state: WorkflowState, locale: str) -> str:
    if article.get("contentMode") != "fact-source":
        return ""
    evidence_items = [first_string(item) for item in state.get("evidence", [])[:6] if first_string(item)]
    if not evidence_items:
        evidence_items = ["platform notice", "source file", "order record", "support log", "policy screenshot"]
    redlines = [first_string(item) for item in article.get("redlineTerms", [])[:4] if first_string(item)]
    if not redlines:
        redlines = ["guaranteed approval", "we did nothing wrong", "no chargeback risk"]

    if locale == "zh":
        rows = [
            "## 核心结论",
            "",
            "这是一篇事实源型文章。它必须先回答搜索意图，再把判断边界、证据资料包和人工确认点拆开，避免把未经确认的事实写成确定性结论。",
            "",
            "## 适用场景 / 不适用场景",
            "",
            "| 场景 | 是否适用 | 判断标准 |",
            "| --- | --- | --- |",
            "| 已收到平台通知、支付审核或客户争议 | 适用 | 可以围绕通知、订单、截图和沟通记录重构证据语境 |",
            "| 只是想写泛营销介绍页 | 不适用 | 应改用 standard 模式，避免把事实源文章写成泛营销页 |",
            "| 需要提交正式申诉或政策解释 | 适用 | 必须由人工确认事实时间线和材料真实性 |",
            "",
            "## 修正前后对照表",
            "",
            "| 高风险表达 | 可能被如何理解 | 建议替代表达 |",
            "| --- | --- | --- |",
        ]
        for term in redlines[:3]:
            rows.append("| %s | 缺少证据边界，或带有不可控结果承诺 | 改写为已确认事实、流程改进和证据资料说明 |" % term)
        rows.extend(
            [
                "",
                "## 证据资料包",
                "",
                "\n".join("- %s" % item for item in evidence_items),
                "",
                "## 人工确认边界",
                "",
                "涉及具体账号通知、订单事实、供应商材料、客户沟通记录和最终提交版本时，必须由人工复核。系统可以辅助重构表达，但不能替代事实确认。",
            ]
        )
        return "\n".join(rows)

    if locale == "zh":
        scenario = [
            "## 核心结论",
            "",
            "这是一篇事实源型文章。它应当先回答搜索意图，再把判断边界、证据资料包和人工确认点拆开，避免把未经确认的事实写成确定性结论。",
            "",
            "## 适用场景 / 不适用场景",
            "",
            "| 场景 | 是否适用 | 判断标准 |",
            "| --- | --- | --- |",
            "| 已收到平台通知、支付审核或客户争议 | 适用 | 可以围绕通知、订单、截图和沟通记录重构证据语境 |",
            "| 只是想写营销型介绍页 | 不适用 | 应改用 standard 模式，避免把事实源文章写成泛营销页 |",
            "| 需要提交正式申诉或政策解释 | 适用 | 必须由人工确认事实时间线和材料真实性 |",
            "",
            "## Before / After 修正表",
            "",
            "| 高风险表达 | 可能被如何理解 | 建议替代表达 |",
            "| --- | --- | --- |",
        ]
        for term in redlines[:3]:
            scenario.append("| %s | 缺乏证据边界或带有不可控结果承诺 | 以已确认事实、流程改进和证据资料说明替代 |" % term)
        scenario.extend(
            [
                "",
                "## 证据资料包",
                "",
                "\n".join("- %s" % item for item in evidence_items),
                "",
                "## 人工确认边界",
                "",
                "涉及具体账号通知、订单事实、供应商材料、客户沟通记录和最终提交版本时，必须由人工复核。系统可以辅助重构表达，但不能替代事实确认。",
            ]
        )
        return "\n".join(scenario)

    scenario = [
        "## Core Conclusion",
        "",
        "This is a fact-source article. It should answer the search intent first, then separate the scenario boundary, evidence package, and human-confirmation boundary so unverified facts do not become public claims.",
        "",
        "## Applicable / Not Applicable Scenarios",
        "",
        "| Scenario | Fit | Decision Standard |",
        "| --- | --- | --- |",
        "| A platform notice, payment review, or customer dispute already exists | Applicable | The article can rebuild the evidence context around notices, orders, screenshots, and communication records |",
        "| The page is only a broad marketing introduction | Not applicable | Use standard mode instead of treating a fact-source page as a generic sales page |",
        "| A formal appeal or policy explanation will be submitted | Applicable | The factual timeline and material authenticity must be manually confirmed |",
        "",
        "## Before / After Correction Table",
        "",
        "| Risky Expression | Possible Reviewer Reading | Safer Replacement |",
        "| --- | --- | --- |",
    ]
    for term in redlines[:3]:
        scenario.append("| %s | The statement may imply an uncontrolled outcome or unsupported certainty | Replace it with confirmed facts, process changes, and evidence-backed language |" % term)
    scenario.extend(
        [
            "",
            "## Evidence Package",
            "",
            "\n".join("- %s" % item for item in evidence_items),
            "",
            "## Human Confirmation Boundary",
            "",
            "Account-specific notices, order facts, supplier records, customer communications, and final submission wording require human confirmation. The system can help structure language, but it cannot verify facts that are not present in the source files.",
        ]
    )
    return "\n".join(scenario)


def count_markdown_tables(markdown: str) -> int:
    return len(re.findall(r"(?:^\|.+\|\s*$\n?)+", first_string(markdown), flags=re.MULTILINE))


def needs_fact_source_blocks(markdown: str) -> bool:
    body = first_string(markdown)
    return (
        count_markdown_tables(body) < 2
        or not re.search(r"core conclusion|核心结论|结论", body, flags=re.IGNORECASE)
        or not re.search(r"evidence|证据|资料包|source file", body, flags=re.IGNORECASE)
        or not re.search(r"human|人工|manual confirmation|人工确认", body, flags=re.IGNORECASE)
    )


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
        takeaways_title = "## Key Takeaways" if locale == "en" else "## 核心要点"
        parts.append(takeaways_title + "\n\n" + "\n".join("- %s" % first_string(item) for item in takeaways[:5] if first_string(item)))
    fact_blocks = fact_source_blocks(article, state, locale)
    if fact_blocks:
        parts.append(fact_blocks)
    cards = article.get("intelligenceCards", [])
    if isinstance(cards, list) and cards:
        if locale == "en":
            table_lines = [
                "## Intelligence Card Summary",
                "",
                "| Signal | Evidence | Operational Response |",
                "| --- | --- | --- |",
            ]
            for card in cards[:4]:
                if isinstance(card, dict):
                    table_lines.append(
                        "| %s | %s | %s |"
                        % (
                            first_string(card.get("finding")).replace("|", "/"),
                            first_string(card.get("evidence")).replace("|", "/"),
                            first_string(card.get("action")).replace("|", "/"),
                        )
                    )
        else:
            table_lines = [
                "## 情报卡摘要",
                "",
                "| 风险信号 | 证据依据 | 操作响应 |",
                "| --- | --- | --- |",
            ]
            for card in cards[:4]:
                if isinstance(card, dict):
                    table_lines.append(
                        "| %s | %s | %s |"
                        % (
                            first_string(card.get("zhFinding"), first_string(card.get("finding"))).replace("|", "/"),
                            first_string(card.get("zhEvidence"), first_string(card.get("evidence"))).replace("|", "/"),
                            first_string(card.get("zhAction"), first_string(card.get("action"))).replace("|", "/"),
                        )
                    )
        parts.append("\n".join(table_lines))
    for section in sections:
        heading = first_string(section.get("heading" if locale == "en" else "zhHeading"))
        body = first_string(section.get("body" if locale == "en" else "zhBody"))
        if heading and body:
            parts.append(section_markdown(heading, body))
    if faq:
        faq_parts = ["## FAQ" if locale == "en" else "## 常见问题"]
        for item in faq[:5]:
            question = first_string(item.get("question" if locale == "en" else "zhQuestion"))
            answer = first_string(item.get("answer" if locale == "en" else "zhAnswer"))
            if question and answer:
                faq_parts.append("### %s\n\n%s" % (question, answer))
        parts.append("\n\n".join(faq_parts))
    if conclusion:
        conclusion_title = "## Conclusion" if locale == "en" else "## 结论"
        parts.append("%s\n\n%s" % (conclusion_title, conclusion.strip()))

    markdown = "\n\n".join(part.strip() for part in parts if part.strip())
    warning_terms = article.get("redlineTerms", [])
    if isinstance(warning_terms, list) and warning_terms:
        warning_block = "\n".join("- %s" % first_string(term) for term in warning_terms[:6] if first_string(term))
        if warning_block:
            warning_title = "## Redline Watchlist" if locale == "en" else "## 红线观察清单"
            markdown += "\n\n%s\n\n%s" % (warning_title, warning_block)
    if locale == "en":
        cta = "If your team needs this risk mapped against its own checkout, policy stack, or evidence files, request a private diagnostic review before scaling traffic."
    else:
        cta = "如果你的团队需要把这些风险映射到自己的政策页面、证据资料或申诉材料中，请在放大流量前预约一次私密诊断。"
    markdown += "\n\n> %s" % cta
    return markdown.strip()


def strip_warning_sections(text: str) -> str:
    cleaned = first_string(text)
    cleaned = re.sub(
        r"\n##\s*(Redline Watchlist|红线词|红线清单|警戒词)[\s\S]*?(?=\n##\s+|\Z)",
        "\n",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned


def public_facing_text(article: Dict[str, Any]) -> str:
    clone = dict(article)
    clone["bodyMarkdown"] = strip_warning_sections(first_string(article.get("bodyMarkdown")))
    clone["zhBodyMarkdown"] = strip_warning_sections(first_string(article.get("zhBodyMarkdown")))
    clone["relatedKeywords"] = []
    return publishable_text(clone)


def public_strict_terms(article: Dict[str, Any], strict_terms: List[str]) -> List[str]:
    redlines = {
        first_string(item).strip().lower()
        for item in article.get("redlineTerms", [])
        if first_string(item).strip()
    }
    return [term for term in strict_terms if first_string(term).strip().lower() not in redlines]


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


def cjk_count(value: Any) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", first_string(value)))


def latin_word_count(value: Any) -> int:
    return len(re.findall(r"\b[A-Za-z][A-Za-z'-]{2,}\b", first_string(value)))


def looks_english_dominant(value: Any) -> bool:
    text = first_string(value)
    if not text.strip():
        return False
    latin_words = latin_word_count(text)
    cjk_chars = cjk_count(text)
    return latin_words >= 12 and latin_words > max(8, cjk_chars // 2)


def zh_or(value: Any, fallback: str) -> str:
    text = first_string(value).strip()
    if not text or looks_english_dominant(text):
        return fallback
    return text


def evidence_text_zh(items: List[str]) -> str:
    return "、".join(first_string(item) for item in items if first_string(item)) or "政策截图、客服记录、履约记录和订单追踪证据"


def zh_long(value: Any, fallback: str) -> str:
    text = first_string(value).strip()
    if not text or looks_english_dominant(text):
        return fallback
    return paragraphize(text, fallback)


def normalize_keyword_category(value: Any, fallback: str = "Payment Risk") -> str:
    raw = first_string(value).strip()
    if raw in ALLOWED_CATEGORIES:
        return raw
    parts = [part.strip() for part in re.split(r"[、,，;；|/]+", raw) if part.strip()]
    for part in parts or [raw]:
        if part in ALLOWED_CATEGORIES:
            return part
        lowered = part.lower()
        for source, target in CATEGORY_ALIASES.items():
            if source.lower() in lowered:
                return target
    return fallback if fallback in ALLOWED_CATEGORIES else "Payment Risk"


def mode_contract(content_mode: str) -> Dict[str, Any]:
    if content_mode == "fact-source":
        return {
            "mode": "fact-source",
            "purpose": "evidence-backed fact-source article for disputes, policies, appeals, and high-risk compliance topics",
            "must_include": [
                "core conclusion near the opening",
                "applicable / not applicable scenario boundary",
                "Before / After correction table",
                "evidence package or source-file checklist",
                "human confirmation boundary",
                "at least two markdown tables",
            ],
            "must_not_do": [
                "invent legal clauses, statistics, platform policy dates, or regulator details",
                "claim that source files prove facts not present in the provided material",
            ],
        }
    return {
        "mode": "standard",
        "purpose": "evergreen SEO long-form article with embedded intelligence-card structure",
        "must_include": [
            "direct answer to search intent",
            "risk explanation tied to operations and evidence",
            "one markdown table",
            "FAQ",
            "natural diagnostic-review CTA",
        ],
        "must_not_do": ["write a thin checklist, internal memo, or generic marketing page"],
    }


def normalize_article(article: Dict[str, Any], state: WorkflowState) -> Dict[str, Any]:
    normalized = dict(article)
    profile = state.get("profile", {})
    seed = state.get("seed", "compliance asset")
    content_mode = "fact-source" if state.get("content_mode") == "fact-source" else "standard"
    slug_override = first_string(state.get("slug_override"))

    normalized["slug"] = slugify(slug_override or first_string(normalized.get("slug")) or seed + " compliance article")
    normalized["title"] = articleize_text(
        first_string(normalized.get("title"), "%s cross-border compliance article" % title_case_seed(seed))
    )
    normalized["zhTitle"] = first_string(normalized.get("zhTitle"), normalized["title"])
    normalized["category"] = normalize_keyword_category(
        state.get("keyword_category") or normalized.get("category"),
        profile.get("category", "Payment Risk"),
    )
    normalized["market"] = first_string(normalized.get("market"), profile.get("market", "North America"))
    normalized["riskLevel"] = first_string(normalized.get("riskLevel"), profile.get("risk_level", "High"))
    if normalized["riskLevel"] not in ALLOWED_RISK_LEVELS:
        normalized["riskLevel"] = profile.get("risk_level", "High")
    normalized["updatedAt"] = dt.date.today().isoformat()
    normalized["contentMode"] = content_mode

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
    normalized["zhSummary"] = zh_or(
        normalized.get("zhSummary"),
        "面向出海团队的合规情报文章，用于梳理页面措辞、政策页面、证据文件和审核说明之间的风险边界。",
    )
    normalized["dek"] = articleize_text(
        first_string(
            normalized.get("dek"),
            "What cross-border sellers need to fix in product language, policy pages, and support records before this category attracts avoidable scrutiny.",
        )
    )
    normalized["zhDek"] = zh_or(
        normalized.get("zhDek"),
        "在该类目引发平台审核、支付审查或客户争议之前，出海团队需要先校准产品表达、政策页面、客服记录和证据资料。",
    )
    normalized["introduction"] = paragraphize(
        first_string(
            normalized.get("introduction"),
            "Most compliance problems in this category do not start with a single forbidden phrase. They build up when product copy, payment language, refund expectations, and support records describe different realities.\n\nA useful article should help an operator see where scrutiny begins, which public-facing claims create friction, and which documents need to exist before a dispute, payment review, or platform check arrives.",
        ),
        "Instead of treating compliance as a final proofreading step, the better approach is to use the article itself as an operating map: what language belongs on the page, what claims must stay internal, and what evidence needs to exist before sales volume increases.",
    )
    normalized["zhIntroduction"] = zh_long(
        normalized.get("zhIntroduction"),
        "很多合规风险并不是从某一个禁用词开始，而是从页面承诺、支付措辞、退款预期和客服记录之间的不一致开始累积。\n\n一篇可发布的合规文章应当帮助运营者看清审核从哪里开始、哪些公开表达会制造摩擦，以及在争议、支付审核或平台检查到来之前，哪些证据资料必须已经存在。",
    )

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
        normalized["zhKeyTakeaways"] = [
            "公开页面应描述可验证的运营边界，而不是承诺不可控结果。",
            "政策页面必须与真实退款处理、证据要求和客服响应窗口保持一致。",
            "只有截图、日志和订单记录提前存在，类目页面才更容易在审核和争议中自洽。",
        ]

    cards = normalized.get("intelligenceCards", [])
    if not isinstance(cards, list):
        cards = []
    cleaned_cards = []
    for item in cards:
        if not isinstance(item, dict):
            continue
        finding = articleize_text(first_string(item.get("finding")))
        evidence = articleize_text(first_string(item.get("evidence")))
        action = articleize_text(first_string(item.get("action")))
        if finding and evidence and action:
            severity = first_string(item.get("severity"), normalized["riskLevel"])
            if severity not in {"Critical", "High", "Medium", "Watch"}:
                severity = normalized["riskLevel"] if normalized["riskLevel"] in {"Critical", "High", "Medium"} else "Watch"
            if len(finding) < 60:
                finding = "%s This signal should be interpreted against the actual notice, policy page, order record, and support history before publication." % finding
            if len(evidence) < 40:
                evidence = "%s; confirm the source file, screenshot, timestamp, and operator record before use." % evidence
            if len(action) < 40:
                action = "%s; convert the finding into a documented wording change, evidence checklist, and human review item." % action
            zh_finding = first_string(item.get("zhFinding"), finding)
            zh_evidence = first_string(item.get("zhEvidence"), evidence)
            zh_action = first_string(item.get("zhAction"), action)
            if len(zh_finding) < 30:
                zh_finding = "%s。发布前应结合具体通知、政策页面、订单记录和客服记录确认。" % zh_finding
            if len(zh_evidence) < 20:
                zh_evidence = "%s；需核对源文件、截图、时间戳和运营记录。" % zh_evidence
            if len(zh_action) < 20:
                zh_action = "%s；应转化为措辞修正、证据清单和人工复核项。" % zh_action
            cleaned_cards.append(
                {
                    "label": first_string(item.get("label"), "Risk Signal"),
                    "zhLabel": first_string(item.get("zhLabel"), first_string(item.get("label"), "Risk Signal")),
                    "finding": finding,
                    "zhFinding": zh_finding,
                    "evidence": evidence,
                    "zhEvidence": zh_evidence,
                    "action": action,
                    "zhAction": zh_action,
                    "severity": severity,
                }
            )
    if len(cleaned_cards) < 3:
        evidence_files = state.get("evidence", [])[:3]
        if not evidence_files:
            evidence_files = ["policy screenshots", "support logs", "checkout captures"]
        cleaned_cards = [
            {
                "label": "Claim Boundary",
                "zhLabel": "Claim Boundary",
                "finding": "The safest public copy describes documented operations and customer limits instead of implying guaranteed outcomes or invisible review friction.",
                "zhFinding": "The safest public copy describes documented operations and customer limits instead of implying guaranteed outcomes or invisible review friction.",
                "evidence": "Compare product pages, policy pages, checkout captures, and support replies for consistency before scale.",
                "zhEvidence": "Compare product pages, policy pages, checkout captures, and support replies for consistency before scale.",
                "action": "Rewrite the public page around verifiable process language and move sensitive phrases into the internal redline list.",
                "zhAction": "Rewrite the public page around verifiable process language and move sensitive phrases into the internal redline list.",
                "severity": normalized["riskLevel"] if normalized["riskLevel"] in {"Critical", "High", "Medium"} else "High",
            },
            {
                "label": "Evidence Gap",
                "zhLabel": "Evidence Gap",
                "finding": "The article becomes commercially useful only when its claims can be backed by evidence files that already exist before review pressure appears.",
                "zhFinding": "The article becomes commercially useful only when its claims can be backed by evidence files that already exist before review pressure appears.",
                "evidence": "Minimum files include %s." % ", ".join(evidence_files),
                "zhEvidence": "Minimum files include %s." % ", ".join(evidence_files),
                "action": "Create a versioned evidence folder before publishing or scaling traffic to the category page.",
                "zhAction": "Create a versioned evidence folder before publishing or scaling traffic to the category page.",
                "severity": "High",
            },
            {
                "label": "Support Alignment",
                "zhLabel": "Support Alignment",
                "finding": "Refund, delivery, and support language should describe the same operating reality across the article, policy pages, and customer-service replies.",
                "zhFinding": "Refund, delivery, and support language should describe the same operating reality across the article, policy pages, and customer-service replies.",
                "evidence": "Review support tickets, refund templates, shipping policy text, and checkout promises for conflicting timelines or outcomes.",
                "zhEvidence": "Review support tickets, refund templates, shipping policy text, and checkout promises for conflicting timelines or outcomes.",
                "action": "Use one controlled wording set for SEO pages, policy pages, and support templates so review teams see a coherent record.",
                "zhAction": "Use one controlled wording set for SEO pages, policy pages, and support templates so review teams see a coherent record.",
                "severity": "Medium",
            },
        ]
    for index, card in enumerate(cleaned_cards):
        if looks_english_dominant(card.get("zhLabel")):
            card["zhLabel"] = ["主张边界", "证据缺口", "客服一致性", "风险信号", "操作边界", "复核节点"][min(index, 5)]
        if looks_english_dominant(card.get("zhFinding")):
            card["zhFinding"] = "该风险信号需要结合具体通知、政策页面、订单记录和客服历史确认，不能直接按英文结论发布。"
        if looks_english_dominant(card.get("zhEvidence")):
            card["zhEvidence"] = "发布前应核对源文件、截图、时间戳和运营记录，确保判断有证据支撑。"
        if looks_english_dominant(card.get("zhAction")):
            card["zhAction"] = "将该发现转化为页面措辞修正、证据清单和人工复核事项。"
    normalized["intelligenceCards"] = cleaned_cards[:6]

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
    else:
        fallback_sections = build_fallback_article(state, seed, state.get("revision_count", 0))["sections"]
        for index, section in enumerate(cleaned_sections):
            body = first_string(section.get("body"))
            if len(body) < 280 or "\n\n" not in body:
                fallback_body = first_string(fallback_sections[min(index, len(fallback_sections) - 1)].get("body"))
                section["body"] = paragraphize("%s\n\n%s" % (body, fallback_body))
            zh_body = first_string(section.get("zhBody"))
            if len(zh_body) < 140 or "\n\n" not in zh_body:
                fallback_zh_body = first_string(fallback_sections[min(index, len(fallback_sections) - 1)].get("zhBody"))
                section["zhBody"] = paragraphize("%s\n\n%s" % (zh_body, fallback_zh_body))
    zh_section_headings = [
        "为什么审核压力通常早于卖家察觉",
        "哪些主张不应该出现在公开文章中",
        "一篇可读文章会暴露怎样的真实客服体系",
        "哪些证据文件能把文章变成运营资产",
        "如何在搜索意图和合规边界之间保持平衡",
        "发布前必须人工确认哪些事实",
    ]
    zh_section_bodies = [
        "真正的风险往往不是某一个词，而是产品承诺、退款预期、交付说明和运营边界之间逐渐发生冲突。文章需要解释这种冲突如何被平台审核、支付审查或客户争议放大。\n\n因此，中文正文必须像一篇可阅读的专业文章，而不是英文内部提示词的翻译残留。它应当先说明业务问题，再把主张风险、政策风险和证据风险逐层展开。",
        "高意图关键词仍然重要，但它不能把页面推向不可验证的承诺。文章可以解释红线问题，也可以说明为什么某些表达危险，但不能把这些词当作标题、政策页或结账文案中的可用措辞。\n\n更稳妥的写法，是用可验证的流程、支持窗口、退款边界和资料清单来承接商业意图，让内容既能获取搜索流量，也不会制造新的审核风险。",
        "一篇强文章不只是改几个形容词。它要让产品页、FAQ、退款政策、履约说明和客服回复描述同一个运营现实。读者读完后，应能理解产品能做什么、不能做什么、团队如何响应，以及哪些承诺可以被书面记录支撑。\n\n这也是许多生成稿失败的地方：文字看似流畅，却无法落到客服行为和证据资料上。可发布文章必须补上这个缺口。",
        "文章只有被证据资料支撑时，才会从内容练习变成运营资产。最低资料集通常包括政策截图、客服记录、履约记录、订单追踪证据和平台通知。\n\n当这些文件存在后，同一篇文章才能同时服务 SEO、支付审核、客服处理和内部培训，而不是在争议或复核到来时变成无法解释的营销文本。",
    ]
    for index, section in enumerate(cleaned_sections):
        if looks_english_dominant(section.get("zhHeading")):
            section["zhHeading"] = zh_section_headings[min(index, len(zh_section_headings) - 1)]
        if looks_english_dominant(section.get("zhBody")):
            section["zhBody"] = zh_section_bodies[min(index, len(zh_section_bodies) - 1)]
    normalized["sections"] = cleaned_sections

    normalized["conclusion"] = paragraphize(
        first_string(
            normalized.get("conclusion"),
            "For cross-border sellers, the goal is not to sound more aggressive than the market. The goal is to make every public claim easy to explain, easy to evidence, and easy to defend when a payment team, marketplace reviewer, or customer dispute asks for proof.\n\nOnce product copy, policy language, and support records describe the same operating reality, this category becomes far easier to sell without inviting unnecessary compliance friction.",
        ),
        "That is the standard a publishable insight article should meet: not louder language, but tighter alignment between what the market reads, what support can prove, and what the business is actually prepared to deliver.",
    )
    normalized["zhConclusion"] = zh_long(
        normalized.get("zhConclusion"),
        "对出海团队来说，目标不是让表达听起来更激进，而是让每一个公开主张都容易解释、容易举证，并且在支付团队、平台审核或客户争议要求证明时仍然站得住。\n\n当产品文案、政策语言和客服记录描述同一个运营现实时，这个类目才更容易在不制造额外合规摩擦的前提下获得增长。",
    )

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
                    "zhQuestion": zh_or(item.get("zhQuestion"), "这个类目通常为什么会触发额外审核？"),
                    "zhAnswer": zh_long(item.get("zhAnswer"), "额外审核通常来自产品文案、政策语言、客服消息和结账承诺之间的冲突。风险不只是某一个词，而是业务无法用证据完整解释的一组承诺。"),
                }
            )
    if len(cleaned_faq) < 3:
        cleaned_faq = [
            {
                "question": "What usually triggers extra scrutiny in this category?",
                "answer": "Scrutiny usually builds when product claims, policy wording, and support messages describe different realities. The risk is not a single phrase by itself, but the pattern of promises the business cannot fully evidence once a payment review, platform escalation, or customer dispute arrives.",
                "zhQuestion": "这个类目通常为什么会触发额外审核？",
                "zhAnswer": "额外审核通常来自产品文案、政策语言和客服消息描述了不同的运营现实。风险不只是某一个词，而是当支付审核、平台升级或客户争议出现时，企业无法完整举证的一组承诺。",
            },
            {
                "question": "What should a compliant article help the operator prepare?",
                "answer": "It should help the operator align SEO copy, policy pages, refund handling language, support windows, and evidence files. A useful article is not only readable; it also maps directly to the records and workflows the team will rely on during review.",
                "zhQuestion": "一篇合规文章应该帮助运营者准备什么？",
                "zhAnswer": "它应帮助运营者校准 SEO 文案、政策页面、退款处理语言、客服窗口和证据文件。真正有用的文章不只是可读，还能映射到团队在审核中会依赖的记录和流程。",
            },
            {
                "question": "Why is evidence preparation part of SEO content quality here?",
                "answer": "Because the page will eventually be tested by reality. If the article implies a cleaner process or a broader claim than the business can prove, the content may attract traffic but it also raises dispute and review risk. Evidence keeps the article commercially usable.",
                "zhQuestion": "为什么证据准备也是 SEO 内容质量的一部分？",
                "zhAnswer": "因为页面最终会被真实运营检验。如果文章暗示的流程比企业能证明的更干净，或主张比证据更宽，内容可能带来流量，也会提高争议和审核风险。证据让文章保持商业可用。",
            },
        ]
    english_faq_fallbacks = [
        {
            "question": "What usually triggers extra scrutiny in this category?",
            "answer": "Extra scrutiny usually comes from conflicting signals across product copy, policy language, support messages, and checkout promises. Reviewers and customers compare those layers against each other, so inconsistency is often a bigger risk than any one phrase alone.",
            "zhQuestion": "这个类目通常为什么会触发额外审核？",
            "zhAnswer": "额外审核通常来自产品文案、政策语言、客服消息和结账承诺之间的冲突信号。审核人员和客户会把这些层次互相对照，因此不一致往往比某一个词本身更危险。",
        },
        {
            "question": "How should the article handle high-intent commercial keywords?",
            "answer": "It should keep commercial relevance while tightening the implied promise. The article can discuss buyer search behavior, but it should reframe those phrases through operational wording, documented limits, and evidence-backed explanations.",
            "zhQuestion": "文章应该如何处理高意图商业关键词？",
            "zhAnswer": "文章应保留商业相关性，同时收紧关键词背后的隐含承诺。它可以讨论买家实际搜索的内容，但必须通过运营措辞、记录边界和证据说明重新框定这些词。",
        },
        {
            "question": "What evidence should exist before traffic scales?",
            "answer": "The minimum evidence package should cover policy screenshots, support logs, fulfillment records, and order-tracking or product-performance proof relevant to the category. Those files let the article remain defensible when disputes, reviews, or audits arrive.",
            "zhQuestion": "放大流量前应该准备哪些证据？",
            "zhAnswer": "最低证据包应覆盖政策截图、客服日志、履约记录，以及与该类目相关的订单追踪或产品表现证明。当争议、审核或审计到来时，这些文件能让文章保持可辩护。",
        },
        {
            "question": "When should a human review the article before publication?",
            "answer": "Human review is required whenever the draft references account-specific notices, customer communications, supplier records, or appeal wording that could be submitted to a platform, payment provider, or regulator.",
            "zhQuestion": "什么时候必须在发布前人工复核？",
            "zhAnswer": "只要草稿涉及具体账号通知、客户沟通、供应商记录，或可能提交给平台、支付机构、监管方的申诉措辞，就必须由人工复核。",
        },
    ]
    for index, item in enumerate(cleaned_faq):
        fallback = english_faq_fallbacks[min(index, len(english_faq_fallbacks) - 1)]
        if cjk_count(item.get("question")) > 8 or cjk_count(item.get("answer")) > 40:
            item["question"] = fallback["question"]
            item["answer"] = fallback["answer"]
        if looks_english_dominant(item.get("zhQuestion")):
            item["zhQuestion"] = fallback["zhQuestion"]
        if looks_english_dominant(item.get("zhAnswer")):
            item["zhAnswer"] = fallback["zhAnswer"]
    normalized["faq"] = cleaned_faq

    normalized["bodyMarkdown"] = first_string(normalized.get("bodyMarkdown"))
    min_markdown_length = 5200 if content_mode == "fact-source" else 4200
    if not normalized["bodyMarkdown"]:
        normalized["bodyMarkdown"] = build_markdown_article(normalized, state, "en")
    elif len(normalized["bodyMarkdown"]) < min_markdown_length:
        supplement = build_markdown_article(build_fallback_article(state, seed, state.get("revision_count", 0)), state, "en")
        normalized["bodyMarkdown"] = (normalized["bodyMarkdown"].strip() + "\n\n---\n\n" + supplement).strip()
    if content_mode == "fact-source" and needs_fact_source_blocks(normalized["bodyMarkdown"]):
        normalized["bodyMarkdown"] = (fact_source_blocks(normalized, state, "en") + "\n\n---\n\n" + normalized["bodyMarkdown"].strip()).strip()
    if cjk_count(normalized["bodyMarkdown"]) > 120:
        normalized["bodyMarkdown"] = build_markdown_article(normalized, state, "en")
    normalized["zhBodyMarkdown"] = first_string(normalized.get("zhBodyMarkdown"))
    min_zh_markdown_length = 2600 if content_mode == "fact-source" else 2200
    if not normalized["zhBodyMarkdown"]:
        normalized["zhBodyMarkdown"] = build_markdown_article(normalized, state, "zh")
    elif len(normalized["zhBodyMarkdown"]) < min_zh_markdown_length:
        supplement = build_markdown_article(build_fallback_article(state, seed, state.get("revision_count", 0)), state, "zh")
        normalized["zhBodyMarkdown"] = (normalized["zhBodyMarkdown"].strip() + "\n\n---\n\n" + supplement).strip()
    if content_mode == "fact-source" and needs_fact_source_blocks(normalized["zhBodyMarkdown"]):
        normalized["zhBodyMarkdown"] = (fact_source_blocks(normalized, state, "zh") + "\n\n---\n\n" + normalized["zhBodyMarkdown"].strip()).strip()
    if looks_english_dominant(normalized["zhBodyMarkdown"]) or cjk_count(normalized["zhBodyMarkdown"]) < 500:
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
            "max_tokens": 4096,
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


def select_profile(seed: str, profiles: Dict[str, Any], category_hint: str = "") -> Tuple[str, Dict[str, Any]]:
    lowered = seed.lower()
    canonical_category = normalize_keyword_category(category_hint, "")
    preferred_profile = CATEGORY_PROFILE_HINTS.get(canonical_category, "")
    best_key = None
    best_score = -1
    for key, profile in profiles.items():
        score = 0
        if preferred_profile and key == preferred_profile:
            score += 4
        if canonical_category and profile.get("category") == canonical_category:
            score += 3
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
    raw = path.read_bytes()
    for encoding in ("utf-8", "utf-8-sig", "gb18030", "gbk"):
        try:
            decoded = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            decoded = ""
    if not decoded:
        decoded = raw.decode("utf-8", errors="ignore")
    if path.suffix.lower() == ".json":
        data = json.loads(decoded)
        return json.dumps(data, ensure_ascii=False, indent=2)
    return decoded


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
    profile_key, profile = select_profile(seed, profiles, first_string(state.get("keyword_category")))
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
        research_system_prompt = read_prompt_file(
            "research-system.md",
            "You are a cross-border trade risk intelligence analyst. Return only JSON with keys: research_data, pain_points, red_lines, safe_terms, evidence. Extract risks from local RAG notes and review VOC. Do not write an article.",
        )
        result = llm.chat_json(
            research_system_prompt,
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
        "contentMode": state.get("content_mode", "standard"),
        "title": "What cross-border sellers should fix before scaling %s%s" % (seed_title, rewrite_note),
        "zhTitle": "%s合规风险与证据准备指南" % safe_seed,
        "category": profile.get("category", "Payment Risk"),
        "market": market,
        "riskLevel": profile.get("risk_level", "High"),
        "updatedAt": dt.date.today().isoformat(),
        "metaTitle": "What cross-border sellers should fix before scaling %s" % seed_title,
        "metaDescription": "A long-form compliance article on safer claims, policy wording, support boundaries, and evidence files for %s sellers in %s." % (seed_title, market),
        "dek": "A publishable intelligence article on the claims, policy wording, support boundaries, and evidence files that matter before this category attracts avoidable review.",
        "zhDek": "围绕%s的公开主张、政策措辞、客服边界和证据资料，建立可发布的合规内容框架。" % safe_seed,
        "summary": "A publishable compliance article for teams selling %s into %s. It explains how to write readable public copy, align policy pages with real operations, and prepare the evidence package needed before disputes, payment review, or platform checks arrive." % (seed_title, market),
        "zhSummary": "一篇面向%s的可发布长文，说明页面文案、政策页面、客服语言和证据文件如何保持一致。" % safe_seed,
        "introduction": (
            "Many operators treat category compliance as a last-minute editing problem. In practice, review pressure builds much earlier: "
            "the article headline promises too much, the policy page suggests a cleaner process than the team can prove, and support "
            "messages quietly introduce a third version of the truth.\n\n"
            "A real publishable article should do more than list red flags. It should explain where scrutiny starts, how demand-capture "
            "language can stay commercially useful without drifting into prohibited claims, and what documents must already exist before "
            "the first dispute lands."
        ),
        "zhIntroduction": (
            "这篇文章应先说明审核压力如何出现：它通常不是由某一个词单独触发，而是页面主张、政策措辞和客服语言描述了不同的运营现实。\n\n"
            "随后，文章需要解释哪些商业表达可以保留在公开页面，哪些高风险措辞必须留在内部红线清单，以及在第一次争议或审核到来之前，哪些文件必须已经准备好。"
        ),
        "keyTakeaways": [
            "Use the article to clarify operating boundaries, not just to replace a few risky adjectives.",
            "Align product copy, FAQ answers, refund policy, and support responses so they describe the same reality.",
            "Keep redline phrases in an internal warning list and keep public-facing copy tied to verifiable operations.",
            "Build the evidence package before scale so the article can support SEO, customer service, and review defense at the same time.",
        ],
        "zhKeyTakeaways": [
            "用文章定义运营边界，而不是只替换几个高风险形容词。",
            "产品文案、FAQ、退款政策和客服回复必须描述同一个运营现实。",
            "把红线表达留在内部警戒清单中，让公开文案绑定可验证的运营事实。",
            "在放大流量前准备证据资料，让文章同时支持 SEO、客服处理和审核应对。",
        ],
        "redlineTerms": state.get("redline_terms", [])[:8],
        "relatedKeywords": list(dict.fromkeys([safe_seed, seed_title, market] + safe_terms + evidence_items))[:8],
        "intelligenceCards": [
            {
                "label": "Claim Boundary",
                "zhLabel": "主张边界",
                "finding": "Public copy for %s should explain documented operating boundaries rather than compressing customer uncertainty into absolute outcomes." % seed_title,
                "zhFinding": "%s的公开文案应解释有记录的运营边界，而不是把客户不确定性压缩成绝对结果承诺。" % safe_seed,
                "evidence": "Compare product descriptions, checkout language, refund policy screenshots, and support replies for the same operating reality.",
                "zhEvidence": "对照产品描述、结账语言、退款政策截图和客服回复，确认它们是否描述同一个运营现实。",
                "action": "Rewrite high-intent page language around verifiable operations and keep sensitive phrases in the internal redline watchlist.",
                "zhAction": "围绕可验证的运营事实重写高意图页面语言，并把敏感表达放入内部红线观察清单。",
                "severity": profile.get("risk_level", "High"),
            },
            {
                "label": "Evidence File",
                "zhLabel": "证据文件",
                "finding": "The article becomes defensible only when the page claims can be traced to evidence files before a payment review, dispute, or platform check appears.",
                "zhFinding": "只有当页面主张能在支付审核、争议或平台检查出现前追溯到证据文件时，文章才具备可辩护性。",
                "evidence": "Minimum file set: %s." % evidence_text,
                "zhEvidence": "最低资料集包括：%s。" % evidence_text_zh(evidence_items),
                "action": "Create a versioned evidence folder and reference that file set when updating SEO pages, policy pages, and support templates.",
                "zhAction": "建立带版本记录的证据文件夹，并在更新 SEO 页面、政策页面和客服模板时引用这套资料。",
                "severity": "High",
            },
            {
                "label": "Support Reality",
                "zhLabel": "客服现实",
                "finding": "Support replies, refund handling, and delivery explanations can quietly contradict the public article even when the article itself sounds controlled.",
                "zhFinding": "即使文章本身听起来克制，客服回复、退款处理和交付解释也可能悄悄与公开内容发生冲突。",
                "evidence": "Use support logs, refund decisions, and delivery timelines to test whether the article describes the same reality customers experience.",
                "zhEvidence": "使用客服日志、退款决策和交付时间线，检查文章是否描述了客户实际经历的同一个现实。",
                "action": "Align customer-service templates with the article before scaling traffic or launching paid acquisition into the page.",
                "zhAction": "在放大流量或投放付费获客之前，让客服模板与文章内容保持一致。",
                "severity": "Medium",
            },
        ],
        "sections": [
            {
                "heading": "Why %s starts drawing review before the seller notices" % seed_title,
                "zhHeading": "%s为什么会在卖家察觉前进入审核压力区" % safe_seed,
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
                    "%s的真实风险很少只来自一个禁用词。审核压力通常来自产品承诺、退款预期、交付语言和运营边界之间的组合冲突。文章应说明这些层次何时开始互相矛盾，而不是只盯着某个激进短语。\n\n"
                    "这也是文章结构重要的原因。标题要框定商业问题，导语要解释审核语境，正文要从主张风险推进到政策风险和证据风险。只有这样，文章才像站内情报，而不是内部备忘录。"
                ) % safe_seed,
            },
            {
                "heading": "Which claims should stay out of the article, not just out of the ad copy",
                "zhHeading": "哪些主张不应出现在文章中，而不只是广告中",
                "body": (
                    "High-intent keywords still matter, but they must not force the page into prohibited or unverifiable claims. Build article "
                    "sections around safer demand-capture phrases such as %s, then explain what each phrase can and cannot imply in public-facing "
                    "copy.\n\n"
                    "The important distinction is editorial. A good article can name the redline problem, explain why it is risky, and then pivot "
                    "into safer wording without sounding evasive. Keep the truly sensitive wording in an internal warning list instead of surfacing "
                    "it in titles, checkout copy, return policies, or ad language."
                ) % safe_terms_text,
                "zhBody": (
                    "高意图关键词仍然重要，但它不能把页面推向被禁止或无法验证的主张。文章可以围绕更安全的需求表达展开，并解释每一种表达在公开页面中能暗示什么、不能暗示什么。\n\n"
                    "关键区别在于编辑边界。好文章可以点出红线问题，解释为什么危险，再转向更安全的措辞；真正敏感的表达应留在内部警戒清单，而不是出现在标题、政策页或结账文案中。"
                ),
            },
            {
                "heading": "What a readable article reveals about the real support stack",
                "zhHeading": "一篇可读文章会暴露怎样的真实客服体系",
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
                    "更强的页面不只是改写形容词。它会让产品文案、FAQ、退款语言、履约说明和客服回复描述同一个运营现实。读者离开页面时，应清楚知道产品能做什么、不能做什么、团队如何响应，以及哪些承诺可以被书面记录支撑。\n\n"
                    "许多生成稿失败就在这里：文字看起来顺滑，却无法转化为客服行为。可发布文章必须说明运营者实际会记录什么、如何收集证据，以及当主张被挑战时支持边界在哪里。"
                ),
            },
            {
                "heading": "Which evidence files turn the article into an operating asset",
                "zhHeading": "哪些证据文件能把文章变成运营资产",
                "body": (
                    "The article only becomes operationally useful when it is backed by documents. For this category, the minimum evidence set should "
                    "include %s. Without that layer, even well-written copy remains a content exercise rather than a defensible commercial asset.\n\n"
                    "Once those files exist, the article can support SEO work, payment review, customer-service handling, and internal training at the "
                    "same time. That is the standard worth aiming for: not a decorative article, but one that still makes sense when a dispute, review, "
                    "or audit asks for proof."
                ) % evidence_text,
                "zhBody": (
                    "文章只有被文件支撑时，才会具备运营价值。对这个类目来说，最低证据集通常包括%s。没有这层资料，即使文字写得很好，也仍然只是内容练习，而不是可辩护的商业资产。\n\n"
                    "一旦这些文件存在，同一篇文章就可以同时支持 SEO、支付审核、客服处理和内部培训。这才是值得追求的标准：不是装饰性文章，而是在争议、审核或审计要求举证时仍然讲得通。"
                ) % evidence_text_zh(evidence_items),
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
            "这篇文章最后应留下一个清晰标准：每一个公开主张都要对应一个运营事实，每一个政策承诺都要对应一个客服流程，每一个敏感类目都要对应一份证据文件。\n\n"
            "这才会让文章从单薄说明变成真正的资产：当买家、支付团队或内部复核人员要求证明时，它仍然能够成立。"
        ),
        "faq": [
            {
                "question": "What usually triggers extra scrutiny in this category?",
                "answer": "Extra scrutiny usually comes from conflicting signals across product copy, policy language, support messages, and checkout promises. Reviewers and customers compare those layers against each other, so inconsistency is often a bigger risk than any one phrase alone.",
                "zhQuestion": "这个类目通常为什么会触发额外审核？",
                "zhAnswer": "额外审核通常来自产品文案、政策语言、客服消息和结账承诺之间的冲突信号。审核人员和客户会把这些层次互相对照，因此不一致往往比某一个词本身更危险。",
            },
            {
                "question": "How should the article handle high-intent commercial keywords?",
                "answer": "It should keep commercial relevance while tightening the implied promise. The article can discuss what buyers search for, but it should reframe those terms through operational wording, documented limits, and evidence-backed explanations.",
                "zhQuestion": "文章应该如何处理高意图商业关键词？",
                "zhAnswer": "文章应保留商业相关性，同时收紧关键词背后的隐含承诺。它可以讨论买家实际搜索的内容，但必须通过运营措辞、记录边界和证据说明重新框定这些词。",
            },
            {
                "question": "What evidence should exist before traffic scales?",
                "answer": "The minimum evidence package should cover policy screenshots, support logs, fulfillment records, and order-tracking or product-performance proof relevant to the category. Those files let the article remain defensible when disputes, reviews, or audits arrive.",
                "zhQuestion": "放大流量前应该准备哪些证据？",
                "zhAnswer": "最低证据包应覆盖政策截图、客服日志、履约记录，以及与该类目相关的订单追踪或产品表现证明。当争议、审核或审计到来时，这些文件能让文章保持可辩护。",
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
            "content_mode": state.get("content_mode", "standard"),
            "mode_contract": mode_contract(state.get("content_mode", "standard")),
            "keyword_locale": state.get("locale", "zh"),
            "keyword_category": state.get("keyword_category", ""),
            "canonical_category": normalize_keyword_category(state.get("keyword_category"), state.get("profile", {}).get("category", "Payment Risk")),
            "keyword_intent": state.get("keyword_intent", ""),
            "research_data": state.get("research_data", ""),
            "pain_points": state.get("pain_points", []),
            "red_lines": state.get("redline_terms", []),
            "safe_terms": state.get("safe_terms", []),
            "evidence": state.get("evidence", []),
            "review_feedback": state.get("review_feedback", ""),
            "required_schema": {
                "slug": "lowercase-ascii-hyphen-slug",
                "contentMode": "standard|fact-source",
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
                "bodyMarkdown": "Optional. Prefer an empty string; the local renderer will assemble the final long-form markdown from sections, cards, FAQ, and conclusion.",
                "zhBodyMarkdown": "Optional. Prefer an empty string; the local renderer will assemble the final localized markdown.",
                "toc": [{"id": "heading-id", "label": "English heading", "zhLabel": "Chinese heading", "level": 2}],
                "intelligenceCards": [
                    {
                        "label": "short card label",
                        "zhLabel": "Chinese label",
                        "finding": "extractable finding tied to the category and market",
                        "zhFinding": "Chinese finding",
                        "evidence": "supporting evidence or file class",
                        "zhEvidence": "Chinese evidence",
                        "action": "recommended operational response",
                        "zhAction": "Chinese action",
                        "severity": "Critical|High|Medium|Watch",
                    }
                ],
                "faq": [{"question": "", "answer": "", "zhQuestion": "", "zhAnswer": ""}],
                "relatedKeywords": ["keyword variants"],
                "redlineTerms": ["terms"],
                "sections": [{"heading": "", "zhHeading": "", "body": "", "zhBody": ""}],
                "conclusion": "Two-paragraph English conclusion",
                "zhConclusion": "Two-paragraph Chinese conclusion",
            },
        }
        writer_prompt_file = "rewrite-system.md" if revision_count > 0 else "insight-agent-prompt.md"
        writer_system_prompt = read_prompt_file(
            writer_prompt_file,
            "You are writing a publishable SEO intelligence article for a cross-border compliance insights library. Do not write an internal framework, architecture note, brief, memo, or checklist. Write a polished long-form article in a restrained, authoritative consulting tone. For content_mode=standard, produce an evergreen SEO long-form article. For content_mode=fact-source, produce a stricter evidence-backed fact-source article with core conclusion, scenario boundaries, before-after correction table, evidence package, human-confirmation boundary, and visual-ready structures. Return only JSON matching the required schema.",
        )
        writer_system_prompt += (
            "\n\nRuntime stability rule: keep the JSON compact. Do not generate the full bodyMarkdown or zhBodyMarkdown unless you can finish valid JSON without truncation. "
            "It is acceptable, and preferred, to set bodyMarkdown and zhBodyMarkdown to empty strings. The local renderer will assemble the final markdown article from the developed sections, intelligenceCards, FAQ, keyTakeaways, introduction, and conclusion. "
            "Each section body must still contain two developed paragraphs."
        )
        try:
            article = llm.chat_json(
                writer_system_prompt,
                json.dumps(payload, ensure_ascii=False),
                temperature=0.35,
            )
        except Exception as exc:
            print("Writer LLM returned unusable JSON; using local structured fallback: %s" % exc)
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
    for item in article.get("intelligenceCards", []):
        if isinstance(item, dict):
            parts.extend(
                [
                    item.get("label", ""),
                    item.get("zhLabel", ""),
                    item.get("finding", ""),
                    item.get("zhFinding", ""),
                    item.get("evidence", ""),
                    item.get("zhEvidence", ""),
                    item.get("action", ""),
                    item.get("zhAction", ""),
                ]
            )
    for section in article.get("sections", []):
        parts.extend([section.get("heading", ""), section.get("zhHeading", ""), section.get("body", ""), section.get("zhBody", "")])
    for item in article.get("faq", []):
        if isinstance(item, dict):
            parts.extend([item.get("question", ""), item.get("answer", ""), item.get("zhQuestion", ""), item.get("zhAnswer", "")])
    return "\n".join(parts)


def deterministic_review(state: WorkflowState) -> Tuple[bool, List[str], str]:
    article = state["article"]
    content_mode = article.get("contentMode") or state.get("content_mode", "standard")
    findings = contains_any(public_facing_text(article), public_strict_terms(article, state.get("strict_terms", [])))
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
    if not article.get("intelligenceCards") or len(article.get("intelligenceCards", [])) < 3:
        findings.append("missing intelligence cards")
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
    if not re.search(r"\|[^\n]+\|", first_string(article.get("bodyMarkdown"))):
        findings.append("missing markdown evidence table")
    if content_mode == "fact-source":
        body = first_string(article.get("bodyMarkdown"))
        if len(body) < 5200:
            findings.append("fact-source markdown article too short")
        if len(re.findall(r"^##+\s+.+$", body, flags=re.MULTILINE)) < 6:
            findings.append("fact-source article needs at least six markdown headings")
        if count_markdown_tables(body) < 2:
            findings.append("fact-source article needs at least two markdown tables")
        if not re.search(r"core conclusion|核心结论|结论", body, flags=re.IGNORECASE):
            findings.append("fact-source article needs a core conclusion section")
        if not re.search(r"evidence|证据|资料包|source file", body, flags=re.IGNORECASE):
            findings.append("fact-source article needs evidence package language")
        if not re.search(r"human|人工|manual confirmation|人工确认", body, flags=re.IGNORECASE):
            findings.append("fact-source article needs human confirmation boundary")
    if any(term in public_facing_text(article).lower() for term in ["best ever", "miracle", "easy money", "100 percent"]):
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
            reviewer_system_prompt = read_prompt_file(
                "review-system.md",
                "You are a cold compliance officer. Review the draft against red_lines, medical implications, payment overpromises, and AI-like generic marketing. redlineTerms is a warning list and may contain prohibited phrases by design; do not reject the draft solely because the warning list names those phrases. Reject only when forbidden language or equivalent promises appear in the title, summary, or section bodies as public-facing copy. Return JSON: {\"status\":\"PASS|REJECT\",\"findings\":[...],\"feedback\":\"...\"}.",
            )
            result = llm.chat_json(
                reviewer_system_prompt,
                json.dumps({"red_lines": state.get("redline_terms", []), "draft": state.get("article", {})}, ensure_ascii=False),
                temperature=0.0,
            )
            if str(result.get("status", "")).upper() == "REJECT":
                passed = False
                findings = list(result.get("findings", [])) or ["llm reviewer rejected draft"]
                feedback = str(result.get("feedback", "Rewrite with tighter compliance language."))
        except Exception as exc:
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
        "contentMode",
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
        "intelligenceCards",
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
    if article.get("contentMode") not in {"standard", "fact-source"}:
        errors.append("contentMode must be standard or fact-source")
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
    if not isinstance(article.get("intelligenceCards"), list) or len(article.get("intelligenceCards", [])) < 3:
        errors.append("intelligenceCards must contain at least three cards")
    else:
        for index, item in enumerate(article.get("intelligenceCards", [])):
            if not isinstance(item, dict):
                errors.append("intelligenceCards[%d] must be an object" % index)
                continue
            for field in ["label", "zhLabel", "finding", "zhFinding", "evidence", "zhEvidence", "action", "zhAction", "severity"]:
                if not first_string(item.get(field)):
                    errors.append("intelligenceCards[%d] missing field: %s" % (index, field))
            if item.get("severity") not in {"Critical", "High", "Medium", "Watch"}:
                errors.append("intelligenceCards[%d].severity is not allowed" % index)
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
    if cjk_count(article.get("bodyMarkdown")) > 120:
        errors.append("bodyMarkdown contains too much Chinese text; English and Chinese article bodies must stay separated")
    if cjk_count(article.get("zhBodyMarkdown")) < 500:
        errors.append("zhBodyMarkdown does not contain enough Chinese text")
    if looks_english_dominant(article.get("zhBodyMarkdown")):
        errors.append("zhBodyMarkdown is English-dominant; Chinese and English article bodies must stay separated")
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
    if not re.search(r"\|[^\n]+\|", first_string(article.get("bodyMarkdown"))):
        errors.append("bodyMarkdown should contain at least one markdown table")
    if article.get("contentMode") == "fact-source":
        body = first_string(article.get("bodyMarkdown"))
        table_count = count_markdown_tables(body)
        if len(body) < 5200:
            errors.append("fact-source bodyMarkdown is too short for an evidence-backed article")
        if len(markdown_headings) < 6:
            errors.append("fact-source bodyMarkdown should contain at least six H2/H3 headings")
        if table_count < 2:
            errors.append("fact-source bodyMarkdown should contain at least two markdown tables")
        if not re.search(r"core conclusion|核心结论|结论", body, flags=re.IGNORECASE):
            errors.append("fact-source article must include a core conclusion section")
        if not re.search(r"evidence|证据|资料包|source file", body, flags=re.IGNORECASE):
            errors.append("fact-source article must name the evidence package or source files")
        if not re.search(r"human|人工|manual confirmation|人工确认", body, flags=re.IGNORECASE):
            errors.append("fact-source article must define the human confirmation boundary")
    if len(publishable_text(article)) < 6000:
        errors.append("article is too thin for publication")
    hits = contains_any(public_facing_text(article), public_strict_terms(article, strict_terms))
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


def run_workflow(
    seed: str,
    notes: str,
    profiles: Dict[str, Any],
    forbidden_terms: Dict[str, Any],
    source_dir: str,
    reviews_dir: str,
    content_mode: str = "standard",
    slug_override: str = "",
    locale: str = "zh",
    keyword_category: str = "",
    keyword_intent: str = "",
) -> WorkflowState:
    llm = OpenAICompatibleClient()
    if not llm.available:
        raise PipelineError("LLM is required. Configure API Key in /local-brain or local-brain/config.json before generating articles.")
    initial_state: WorkflowState = {
        "seed": seed,
        "slug_override": slug_override.strip(),
        "content_mode": "fact-source" if content_mode == "fact-source" else "standard",
        "locale": locale.strip() or "zh",
        "keyword_category": keyword_category.strip(),
        "keyword_intent": keyword_intent.strip(),
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
    parser.add_argument("--slug", default="", help="Optional slug from local-brain/inputs/keywords.csv.")
    parser.add_argument("--content-mode", choices=["standard", "fact-source"], default="standard", help="Content mode from keywords.csv.")
    parser.add_argument("--locale", default="zh", help="Keyword locale.")
    parser.add_argument("--category", default="", help="Keyword category from keywords.csv.")
    parser.add_argument("--intent", default="", help="Keyword intent from keywords.csv.")
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
    state = run_workflow(
        args.seed,
        notes,
        profiles,
        forbidden_terms,
        args.source_dir,
        args.reviews_dir,
        args.content_mode,
        args.slug,
        args.locale,
        args.category,
        args.intent,
    )
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
                "content_mode": article.get("contentMode", args.content_mode),
                "keyword_slug": args.slug,
                "keyword_category": args.category,
                "keyword_intent": args.intent,
                "keyword_locale": args.locale,
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
    print("  content_mode: %s" % article.get("contentMode"))
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
