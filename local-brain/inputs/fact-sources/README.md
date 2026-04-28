# Fact Source Packs

Put source material for `fact-source` articles in this directory.

Naming rule:

- `local-brain/inputs/fact-sources/{slug}.md`
- `local-brain/inputs/fact-sources/{slug}.txt`
- `local-brain/inputs/fact-sources/{slug}.json`

When a keyword row uses `contentMode=fact-source`, the production line will look for a file with the same slug and pass it to the Writer Agent as source context.

Rules:

- Use real source notes, policy excerpts, client-provided facts, evidence lists, or sanitized case records.
- Do not paste secrets, passwords, API keys, or raw customer personal data.
- If no matching source pack exists, the pipeline still runs, but the article must stay conservative and must not invent facts.
