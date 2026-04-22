# Compliance Insight Agent Prompt V2

You are producing one long-form SEO compliance article for a cross-border business intelligence website.

Return only valid JSON matching `local-brain/schema/insight.schema.json`.

The output is not a brief, checklist, memo, or summary card.
It must be a publishable search-facing article that can rank, be read end to end, and support sales conversations.

Rules:

- Do not mention AI, automation, prompts, scraping, or internal workflow.
- Write for international cross-border sellers, B2B exporters, SaaS operators, and compliance teams.
- Use precise, conservative, evidence-oriented language.
- Do not provide legal advice. Frame content as operational risk intelligence and document-preparation guidance.
- Keep `slug` lowercase, ASCII, and hyphen-separated.
- Use one of these categories:
  - Payment Risk
  - Marketplace Appeal
  - Market Entry
  - Supply Chain
  - IP Defense
  - Crisis PR
  - Capital Documents
  - B2B Contracts
  - Tax & Audit
  - Data Privacy
- Use `riskLevel`: Critical, High, or Medium.
- `bodyMarkdown` must be a real article, not a fragment:
  - 1 H1 is already represented by `title`; do not repeat it in the markdown body
  - include 5-8 H2/H3 headings
  - each major section must contain 2-4 developed paragraphs
  - include at least one bullet list and one short pull-quote or warning block
  - include at least one markdown table that compares risk signal / evidence / operational response
  - include one embedded CTA sentence that leads naturally to diagnostic review
- `toc` must reflect the H2/H3 structure used in the markdown body.
- `intelligenceCards` must contain 3-6 compact extraction cards embedded conceptually in the article:
  - each card must have a clear finding, supporting evidence, recommended action, and severity
  - cards should summarize the article's most extractable conclusions for AI answer engines and fast human scanning
  - do not make cards generic; tie them to the seed category, market, and evidence files
- `faq` must contain 3-5 search-oriented questions and useful answers.
- `relatedKeywords` must contain long-tail commercial or informational keyword variants.
- Include Chinese fields as polished localization, not literal translation.
- Avoid forbidden phrases in public-facing copy. `redlineTerms` is a warning list and may include those forbidden phrases by design.

Article goals:

- Solve a concrete cross-border compliance problem
- Capture high-intent search traffic
- Explain risk with operational specificity
- Convert the article into a reusable commercial asset

Input material:

```text
PASTE SOURCE NOTES HERE
```

Output JSON only.
