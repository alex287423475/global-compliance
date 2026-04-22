import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path


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


class PipelineError(Exception):
    pass


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def slugify(text):
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


def contains_any(text, terms):
    lowered = text.lower()
    return [term for term in terms if term.lower() in lowered]


def title_case_seed(seed):
    if re.search(r"[A-Za-z]", seed):
        return " ".join(part.capitalize() if part.islower() else part for part in seed.split())
    return seed


class ScraperAgent:
    """Local intelligence collector.

    This first version deliberately avoids live crawling by default. It converts seed terms,
    local notes, and category profiles into a stable evidence brief. Live scraping can be
    added behind this interface later without touching the validator or publishing step.
    """

    def __init__(self, profiles):
        self.profiles = profiles

    def select_profile(self, seed):
        lowered = seed.lower()
        best_key = None
        best_score = -1

        for key, profile in self.profiles.items():
            score = 0
            for term in profile.get("match_terms", []):
                if term.lower() in lowered:
                    score += 1
            if score > best_score:
                best_key = key
                best_score = score

        if best_score <= 0:
            best_key = "payment-gateway-review"

        return best_key, self.profiles[best_key]

    def run(self, seed, notes):
        profile_key, profile = self.select_profile(seed)
        return {
            "seed": seed,
            "profile_key": profile_key,
            "profile": profile,
            "notes": notes.strip(),
            "safe_terms": profile.get("safe_terms", []),
            "redline_terms": profile.get("redline_terms", []),
            "evidence": profile.get("evidence", []),
        }


class ComplianceAuditorAgent:
    def __init__(self, forbidden_terms):
        self.forbidden_terms = forbidden_terms
        self.strict_terms = (
            forbidden_terms.get("global", [])
            + forbidden_terms.get("medical_claims", [])
            + forbidden_terms.get("payment_claims", [])
            + forbidden_terms.get("customs_claims", [])
        )

    def run(self, brief):
        notes_hits = contains_any(brief.get("notes", ""), self.strict_terms)
        redline_terms = list(dict.fromkeys(brief.get("redline_terms", []) + notes_hits))
        return dict(brief, redline_terms=redline_terms, strict_terms=self.strict_terms)


class ContentGeneratorAgent:
    def run(self, audited):
        seed = audited["seed"]
        profile = audited["profile"]
        category = profile.get("category", "Payment Risk")
        risk_level = profile.get("risk_level", "High")
        market = profile.get("market", "North America")
        seed_title = title_case_seed(seed)
        slug = slugify(seed + " compliance checklist")

        evidence_text = ", ".join(audited.get("evidence", [])[:5])
        safe_terms_text = ", ".join(audited.get("safe_terms", [])[:6])

        title = "%s compliance keyword and evidence checklist" % seed_title
        zh_title = "%s合规关键词与证据清单" % seed

        summary = (
            "A structured compliance intelligence brief for teams preparing SEO wording, "
            "policy pages, evidence files, and review-ready explanations around %s in %s."
            % (seed_title, market)
        )
        zh_summary = (
            "面向%s场景的合规情报简报，用于整理 SEO 表达、政策页面、证据文件和可审阅的业务说明。"
            % seed
        )

        sections = [
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
                    % seed
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
        ]

        return {
            "slug": slug,
            "title": title,
            "zhTitle": zh_title,
            "category": category,
            "market": market,
            "riskLevel": risk_level,
            "updatedAt": dt.date.today().isoformat(),
            "summary": summary,
            "zhSummary": zh_summary,
            "redlineTerms": audited.get("redline_terms", [])[:8],
            "sections": sections,
        }


class FailSafeValidator:
    def __init__(self, strict_terms):
        self.strict_terms = strict_terms

    def validate(self, article):
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

        checked_text_parts = [
            article.get("title", ""),
            article.get("summary", ""),
            article.get("zhTitle", ""),
            article.get("zhSummary", ""),
        ]

        for index, section in enumerate(sections):
            for field in ["heading", "zhHeading", "body", "zhBody"]:
                if not section.get(field):
                    errors.append("sections[%d] missing field: %s" % (index, field))
            checked_text_parts.extend([
                section.get("heading", ""),
                section.get("zhHeading", ""),
                section.get("body", ""),
                section.get("zhBody", ""),
            ])

        checked_text = "\n".join(checked_text_parts)
        hits = contains_any(checked_text, self.strict_terms)
        if hits:
            errors.append("Fail-Safe blocked forbidden claim(s) in publishable text: %s" % ", ".join(hits))

        if errors:
            raise PipelineError("\n".join(errors))

        return article


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a compliance insight draft from local seed intelligence.")
    parser.add_argument("--seed", required=True, help="Seed keyword or category, for example: 智能宠物喂食器")
    parser.add_argument("--notes-file", default="", help="Optional local notes file to enrich the intelligence brief.")
    parser.add_argument("--draft-dir", default="local-brain/drafts", help="Output directory for generated JSON drafts.")
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

    scraper = ScraperAgent(profiles)
    auditor = ComplianceAuditorAgent(forbidden_terms)
    generator = ContentGeneratorAgent()

    brief = scraper.run(args.seed, notes)
    audited = auditor.run(brief)
    article = generator.run(audited)
    validator = FailSafeValidator(audited["strict_terms"])
    validated = validator.validate(article)

    draft_dir = root / args.draft_dir
    draft_dir.mkdir(parents=True, exist_ok=True)
    output_path = draft_dir / ("%s.json" % validated["slug"])

    if output_path.exists() and not args.overwrite:
        raise PipelineError("draft already exists: %s (use --overwrite to replace it)" % output_path)

    output_path.write_text(json.dumps(validated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Local Brain draft generated:")
    print("  seed: %s" % args.seed)
    print("  profile: %s" % brief["profile_key"])
    print("  category: %s" % validated["category"])
    print("  risk: %s" % validated["riskLevel"])
    print("  output: %s" % output_path)


if __name__ == "__main__":
    try:
        main()
    except PipelineError as exc:
        print("Pipeline blocked:")
        print(exc)
        sys.exit(1)
