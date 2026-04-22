import fs from "node:fs";
import path from "node:path";
import { validateInsight } from "./validate-insight.mjs";

const contentPath = path.resolve("content/insights.ts");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function toTypeScriptObject(article) {
  return JSON.stringify(article, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/\n/g, "\n  ");
}

function getExistingSlugs(source) {
  return Array.from(source.matchAll(/slug:\s*"([^"]+)"/g)).map((match) => match[1]);
}

const draftPath = process.argv[2];

if (!draftPath) {
  console.error("Usage: npm run brain:add -- local-brain/drafts/example-insight.json");
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

const source = fs.readFileSync(contentPath, "utf8");
const existingSlugs = getExistingSlugs(source);

if (existingSlugs.includes(article.slug)) {
  console.error(`Duplicate slug: ${article.slug}`);
  process.exit(1);
}

const insertion = `  ${toTypeScriptObject(article)},\n`;
const marker = "];";
const markerIndex = source.lastIndexOf(marker);

if (markerIndex === -1) {
  console.error("Could not find article array closing marker in content/insights.ts");
  process.exit(1);
}

const updatedSource = `${source.slice(0, markerIndex)}${insertion}${source.slice(markerIndex)}`;
fs.writeFileSync(contentPath, updatedSource, "utf8");

console.log(`Added insight article: ${article.slug}`);
