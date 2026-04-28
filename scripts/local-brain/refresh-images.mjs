import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const draftsDir = path.join(repoRoot, "local-brain", "drafts");
const coversDir = path.join(repoRoot, "public", "insights", "covers");
const factSourceDir = path.join(repoRoot, "public", "insights", "fact-source");

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function wrapText(value, limit, maxLines) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function categoryCode(article) {
  return String(article.category || "Compliance")
    .split(/\s+/)
    .map((item) => item[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

function severityColor(riskLevel) {
  if (riskLevel === "Critical") return "#991b1b";
  if (riskLevel === "High") return "#b45309";
  return "#172554";
}

function buildSvg(article) {
  const title = article.title || article.zhTitle || article.slug;
  const dek = article.dek || article.summary || "";
  const category = article.category || "Compliance Intelligence";
  const market = article.market || "Global";
  const risk = article.riskLevel || "Medium";
  const code = categoryCode(article);
  const titleLines = wrapText(title, 40, 3);
  const dekLines = wrapText(dek, 72, 3);
  const riskColor = severityColor(risk);
  const now = new Date().toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(title)}">
  <rect width="1600" height="900" fill="#f8fafc"/>
  <rect x="64" y="64" width="1472" height="772" fill="#ffffff" stroke="#dbe4f0" stroke-width="2"/>
  <rect x="64" y="64" width="1472" height="94" fill="#172554"/>
  <text x="104" y="123" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="8">${escapeXml(category.toUpperCase())}</text>
  <text x="1330" y="123" fill="#cbd5e1" font-family="JetBrains Mono, Consolas, monospace" font-size="22" text-anchor="end">${escapeXml(now)}</text>
  <line x1="104" y1="235" x2="1496" y2="235" stroke="#dbe4f0" stroke-width="2"/>
  <text x="104" y="214" fill="#1d4ed8" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="7">COMPLIANCE INTELLIGENCE</text>
  ${titleLines.map((line, index) => `<text x="104" y="${326 + index * 76}" fill="#172554" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="600">${escapeXml(line)}</text>`).join("\n  ")}
  <rect x="104" y="590" width="8" height="126" fill="${riskColor}"/>
  ${dekLines.map((line, index) => `<text x="136" y="${618 + index * 34}" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="26">${escapeXml(line)}</text>`).join("\n  ")}
  <rect x="1038" y="300" width="370" height="370" fill="#f8fafc" stroke="#dbe4f0" stroke-width="2"/>
  <text x="1223" y="440" fill="#172554" font-family="Georgia, 'Times New Roman', serif" font-size="90" font-weight="600" text-anchor="middle">${escapeXml(code)}</text>
  <line x1="1098" y1="490" x2="1348" y2="490" stroke="${riskColor}" stroke-width="3"/>
  <text x="1223" y="548" fill="#475569" font-family="JetBrains Mono, Consolas, monospace" font-size="25" text-anchor="middle">${escapeXml(market)}</text>
  <text x="1223" y="596" fill="${riskColor}" font-family="JetBrains Mono, Consolas, monospace" font-size="25" font-weight="700" text-anchor="middle">${escapeXml(risk.toUpperCase())}</text>
  <text x="104" y="780" fill="#172554" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="6">QQBYTRAN.COM / INSIGHTS</text>
</svg>
`;
}

function buildFactSourceSvg(article, asset) {
  const title = article.title || article.zhTitle || article.slug;
  const subtitle = asset.title;
  const rows = asset.rows || [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="820" viewBox="0 0 1400 820" role="img" aria-label="${escapeXml(subtitle)}">
  <rect width="1400" height="820" fill="#f8fafc"/>
  <rect x="56" y="56" width="1288" height="708" fill="#ffffff" stroke="#dbe4f0" stroke-width="2"/>
  <text x="96" y="116" fill="#1d4ed8" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="7">FACT SOURCE VISUAL</text>
  <text x="96" y="190" fill="#172554" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="600">${escapeXml(subtitle)}</text>
  <text x="96" y="242" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="24">${escapeXml(title).slice(0, 92)}</text>
  <line x1="96" y1="292" x2="1304" y2="292" stroke="#dbe4f0" stroke-width="2"/>
  ${rows.map((row, index) => {
    const y = 360 + index * 110;
    return `<rect x="96" y="${y - 48}" width="1208" height="82" fill="${index % 2 === 0 ? "#f8fafc" : "#ffffff"}" stroke="#dbe4f0" stroke-width="1"/>
  <text x="126" y="${y}" fill="#991b1b" font-family="JetBrains Mono, Consolas, monospace" font-size="22" font-weight="700">${escapeXml(row.code)}</text>
  <text x="260" y="${y}" fill="#172554" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="700">${escapeXml(row.label)}</text>
  <text x="650" y="${y}" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="23">${escapeXml(row.detail)}</text>`;
  }).join("\n  ")}
  <text x="96" y="720" fill="#172554" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="5">QQBYTRAN FACT-SOURCE ARTICLE</text>
</svg>
`;
}

function factSourceAssets(article, slug) {
  const assetDefinitions = [
    {
      type: "evidence-chain",
      title: "Evidence Chain",
      rows: [
        { code: "01", label: "Source Files", detail: "Policies, screenshots, orders, logs" },
        { code: "02", label: "Claim Boundary", detail: "What the page may safely say" },
        { code: "03", label: "Human Review", detail: "Where judgment cannot be automated" },
      ],
    },
    {
      type: "risk-matrix",
      title: "Risk Matrix",
      rows: [
        { code: "A", label: "Overclaim", detail: "Unsupported absolute outcome" },
        { code: "B", label: "Mismatch", detail: "Policy and support language diverge" },
        { code: "C", label: "Evidence Gap", detail: "No file can prove the statement" },
      ],
    },
    {
      type: "workflow-boundary",
      title: "Workflow Boundary",
      rows: [
        { code: "R", label: "Researcher", detail: "Extracts source facts and redlines" },
        { code: "W", label: "Writer", detail: "Builds long-form SEO argument" },
        { code: "V", label: "Reviewer", detail: "Blocks unsupported claims" },
      ],
    },
  ];

  return assetDefinitions.map((asset) => {
    const fileName = `${slug}-${asset.type}.svg`;
    const src = `/insights/fact-source/${fileName}`;
    fs.writeFileSync(path.join(factSourceDir, fileName), buildFactSourceSvg(article, asset), "utf8");
    return {
      type: asset.type,
      title: asset.title,
      alt: `${article.title || article.zhTitle || slug} ${asset.title}`,
      src,
    };
  });
}

function appendVisualSection(markdown, assets, heading, locale = "en") {
  const text = String(markdown || "");
  if (!assets.length || text.includes(assets[0].src)) return text;
  const isZh = locale === "zh";
  const block = [
    `## ${heading}`,
    "",
    ...assets.map((asset) => {
      const caption = isZh
        ? `**${asset.title}.** 这张图由文章的事实源流程生成，发布前仍应对照底层证据包进行人工核验。`
        : `**${asset.title}.** This diagram is generated from the article's fact-source workflow and should be reviewed against the underlying evidence package before publication.`;
      return `![${asset.alt}](${asset.src})\n\n${caption}`;
    }),
  ].join("\n\n");
  return `${text.trim()}\n\n${block}\n`;
}

function parseSlugs() {
  const slugs = [];
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--slug" && args[index + 1]) {
      slugs.push(safeSlug(args[index + 1]));
      index += 1;
    } else if (arg.startsWith("--slug=")) {
      slugs.push(safeSlug(arg.slice("--slug=".length)));
    }
  }
  return slugs.filter(Boolean);
}

function draftFilesFor(slugs) {
  ensureDir(draftsDir);
  if (slugs.length > 0) {
    return slugs
      .map((slug) => path.join(draftsDir, `${slug}.json`))
      .filter((filePath) => fs.existsSync(filePath));
  }
  return fs
    .readdirSync(draftsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => path.join(draftsDir, fileName));
}

function main() {
  const slugs = parseSlugs();
  const draftFiles = draftFilesFor(slugs);
  if (draftFiles.length === 0) {
    throw new Error(slugs.length ? `No matching drafts found: ${slugs.join(", ")}` : "No drafts found.");
  }

  ensureDir(coversDir);
  ensureDir(factSourceDir);

  for (const draftPath of draftFiles) {
    const article = readJson(draftPath);
    const slug = safeSlug(article.slug || path.basename(draftPath, ".json"));
    if (!slug) throw new Error(`Invalid slug in ${draftPath}`);

    const coverFileName = `${slug}.svg`;
    const publicPath = `/insights/covers/${coverFileName}`;
    fs.writeFileSync(path.join(coversDir, coverFileName), buildSvg({ ...article, slug }), "utf8");

    article.coverImage = publicPath;
    article.ogImage = publicPath;
    article.imageAlt = `${article.title || article.zhTitle || slug} cover image`;
    article.imagePrompt = "Generated deterministic legal-document cover: midnight header, evidence boundary, risk stamp, and compliance intelligence metadata.";
    article.imageUpdatedAt = new Date().toISOString();

    if (article.contentMode === "fact-source") {
      const assets = factSourceAssets(article, slug);
      article.visualAssets = assets;
      article.visualUpdatedAt = new Date().toISOString();
      article.bodyMarkdown = appendVisualSection(article.bodyMarkdown, assets, "Fact-Source Visuals", "en");
      article.zhBodyMarkdown = appendVisualSection(article.zhBodyMarkdown, assets, "事实源图表", "zh");
    } else {
      article.visualAssets = [];
    }

    writeJson(draftPath, article);
    console.log(`Refreshed cover image: ${slug} -> ${publicPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Image refresh failed.");
  process.exit(1);
}
