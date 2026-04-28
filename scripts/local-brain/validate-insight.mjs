import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const allowedCategories = new Set([
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
]);

const allowedRiskLevels = new Set(["Critical", "High", "Medium"]);

function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countCjk(value) {
  return (String(value || "").match(/[\u4e00-\u9fff]/g) || []).length;
}

function countLatinWords(value) {
  return (String(value || "").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || []).length;
}

function isEnglishDominant(value) {
  const cjk = countCjk(value);
  const latin = countLatinWords(value);
  return latin >= 80 && latin > Math.max(40, cjk / 5);
}

function collectHeadings(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^##\s+|^###\s+/.test(line));
}

export function validateInsight(article) {
  const errors = [];
  const requiredFields = [
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
    "bodyMarkdown",
    "zhBodyMarkdown",
    "toc",
    "intelligenceCards",
    "faq",
    "relatedKeywords",
    "redlineTerms",
  ];

  for (const field of requiredFields) {
    if (article[field] === undefined || article[field] === null || article[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (article.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    errors.push("slug must be lowercase ASCII words separated by hyphens");
  }

  if (article.contentMode && !["standard", "fact-source"].includes(article.contentMode)) {
    errors.push("contentMode must be standard or fact-source");
  }

  if (article.category && !allowedCategories.has(article.category)) {
    errors.push(`category must be one of: ${Array.from(allowedCategories).join(", ")}`);
  }

  if (article.riskLevel && !allowedRiskLevels.has(article.riskLevel)) {
    errors.push("riskLevel must be Critical, High, or Medium");
  }

  for (const field of ["title", "metaTitle", "metaDescription", "dek", "summary", "introduction", "conclusion"]) {
    if (countCjk(article[field]) > 0) {
      errors.push(`${field} must not contain Chinese text; keep English and Chinese fields separated`);
    }
  }

  for (const field of ["zhTitle", "zhDek", "zhSummary", "zhIntroduction", "zhConclusion"]) {
    if (isEnglishDominant(article[field])) {
      errors.push(`${field} is English-dominant; keep Chinese and English fields separated`);
    }
  }

  if (article.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(article.updatedAt)) {
    errors.push("updatedAt must use YYYY-MM-DD format");
  }

  if (article.metaTitle && article.metaTitle.length > 80) {
    errors.push("metaTitle should stay within 80 characters");
  }

  if (article.metaDescription && article.metaDescription.length > 180) {
    errors.push("metaDescription should stay within 180 characters");
  }

  if (!Array.isArray(article.relatedKeywords) || article.relatedKeywords.length < 6) {
    errors.push("relatedKeywords must contain at least six keyword variants");
  }

  if (!Array.isArray(article.redlineTerms) || article.redlineTerms.length < 4) {
    errors.push("redlineTerms must contain at least four terms");
  }

  if (!Array.isArray(article.toc) || article.toc.length < 5) {
    errors.push("toc must contain at least five heading items");
  } else {
    article.toc.forEach((item, index) => {
      for (const field of ["id", "label", "zhLabel", "level"]) {
        if (item[field] === undefined || item[field] === null || item[field] === "") {
          errors.push(`toc[${index}] missing field: ${field}`);
        }
      }
      if (item.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) {
        errors.push(`toc[${index}].id must be lowercase hyphenated ASCII`);
      }
      if (item.level !== 2 && item.level !== 3) {
        errors.push(`toc[${index}].level must be 2 or 3`);
      }
    });
  }

  if (!Array.isArray(article.intelligenceCards) || article.intelligenceCards.length < 3) {
    errors.push("intelligenceCards must contain at least three extractable cards");
  } else {
    article.intelligenceCards.forEach((item, index) => {
      for (const field of [
        "label",
        "zhLabel",
        "finding",
        "zhFinding",
        "evidence",
        "zhEvidence",
        "action",
        "zhAction",
        "severity",
      ]) {
        if (!item[field]) {
          errors.push(`intelligenceCards[${index}] missing field: ${field}`);
        }
      }
      if (item.finding && item.finding.length < 60) {
        errors.push(`intelligenceCards[${index}].finding is too short`);
      }
      if (item.evidence && item.evidence.length < 40) {
        errors.push(`intelligenceCards[${index}].evidence is too short`);
      }
      if (item.action && item.action.length < 40) {
        errors.push(`intelligenceCards[${index}].action is too short`);
      }
      if (item.severity && !["Critical", "High", "Medium", "Watch"].includes(item.severity)) {
        errors.push(`intelligenceCards[${index}].severity is not allowed`);
      }
    });
  }

  if (!Array.isArray(article.faq) || article.faq.length < 3) {
    errors.push("faq must contain at least three items");
  } else {
    article.faq.forEach((item, index) => {
      for (const field of ["question", "answer", "zhQuestion", "zhAnswer"]) {
        if (!item[field]) {
          errors.push(`faq[${index}] missing field: ${field}`);
        }
      }
    });
  }

  if (typeof article.bodyMarkdown !== "string" || article.bodyMarkdown.length < 4000) {
    errors.push("bodyMarkdown is too short for a publishable SEO article");
  }

  if (typeof article.zhBodyMarkdown !== "string" || article.zhBodyMarkdown.length < 2000) {
    errors.push("zhBodyMarkdown is too short for a publishable localized article");
  }

  if (countCjk(article.bodyMarkdown) > 120) {
    errors.push("bodyMarkdown contains too much Chinese text; keep English and Chinese article bodies separated");
  }

  if (countCjk(article.zhBodyMarkdown) < 500) {
    errors.push("zhBodyMarkdown does not contain enough Chinese text");
  }

  if (isEnglishDominant(article.zhBodyMarkdown)) {
    errors.push("zhBodyMarkdown is English-dominant; keep Chinese and English article bodies separated");
  }

  const englishWordCount = countWords(article.bodyMarkdown);
  if (englishWordCount < 900) {
    errors.push("bodyMarkdown should contain at least 900 English words");
  }

  const headings = collectHeadings(article.bodyMarkdown);
  if (headings.length < 5) {
    errors.push("bodyMarkdown must contain at least five H2/H3 headings");
  }

  if (!/\|[^\n]+\|/.test(String(article.bodyMarkdown || ""))) {
    errors.push("bodyMarkdown should contain at least one markdown table");
  }

  if (article.contentMode === "fact-source") {
    const body = String(article.bodyMarkdown || "");
    const visualAssets = Array.isArray(article.visualAssets) ? article.visualAssets : [];
    const tableCount = (body.match(/(?:^\|.+\|\s*$\n?)+/gm) || []).length;
    if (body.length < 5200) {
      errors.push("fact-source bodyMarkdown is too short for an evidence-backed article");
    }
    if (headings.length < 6) {
      errors.push("fact-source bodyMarkdown must contain at least six H2/H3 headings");
    }
    if (tableCount < 2) {
      errors.push("fact-source bodyMarkdown should contain at least two markdown tables");
    }
    if (!/core conclusion|核心结论|结论/i.test(body)) {
      errors.push("fact-source article must include a core conclusion section");
    }
    if (!/evidence|证据|资料包|source file/i.test(body)) {
      errors.push("fact-source article must name the evidence package or source files");
    }
    if (!/human|人工|manual confirmation|人工确认/i.test(body)) {
      errors.push("fact-source article must define the human confirmation boundary");
    }
    if (visualAssets.length < 3) {
      errors.push("fact-source article must include at least three visualAssets; run 刷新配图 before validation");
    }
  }

  const faqQuestions = Array.isArray(article.faq) ? article.faq.map((item) => item.question) : [];
  if (new Set(faqQuestions).size !== faqQuestions.length) {
    errors.push("faq questions should be unique");
  }

  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const draftPath = process.argv[2];

  if (!draftPath) {
    console.error("Usage: npm run brain:validate -- local-brain/drafts/example-insight.json");
    process.exit(1);
  }

  const article = readJson(draftPath);
  const errors = validateInsight(article);

  if (errors.length > 0) {
    console.error("Insight validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Insight validation passed: ${article.slug}`);
}
