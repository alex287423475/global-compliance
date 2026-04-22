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

export function validateInsight(article) {
  const errors = [];
  const requiredFields = [
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
  ];

  for (const field of requiredFields) {
    if (article[field] === undefined || article[field] === null || article[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (article.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    errors.push("slug must be lowercase ASCII words separated by hyphens");
  }

  if (article.category && !allowedCategories.has(article.category)) {
    errors.push(`category must be one of: ${Array.from(allowedCategories).join(", ")}`);
  }

  if (article.riskLevel && !allowedRiskLevels.has(article.riskLevel)) {
    errors.push("riskLevel must be Critical, High, or Medium");
  }

  if (article.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(article.updatedAt)) {
    errors.push("updatedAt must use YYYY-MM-DD format");
  }

  if (!Array.isArray(article.redlineTerms) || article.redlineTerms.length < 2) {
    errors.push("redlineTerms must contain at least two terms");
  }

  if (!Array.isArray(article.sections) || article.sections.length < 2) {
    errors.push("sections must contain at least two sections");
  } else {
    article.sections.forEach((section, index) => {
      for (const field of ["heading", "zhHeading", "body", "zhBody"]) {
        if (!section[field]) {
          errors.push(`sections[${index}] missing field: ${field}`);
        }
      }
      if (section.body && section.body.length < 80) {
        errors.push(`sections[${index}].body is too short`);
      }
      if (section.zhBody && section.zhBody.length < 40) {
        errors.push(`sections[${index}].zhBody is too short`);
      }
    });
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
