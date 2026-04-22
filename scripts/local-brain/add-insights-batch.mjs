import fs from "node:fs";
import path from "node:path";
import { validateInsight } from "./validate-insight.mjs";

const contentPath = path.resolve("content/insights.ts");

function collectJsonFiles(inputPaths) {
  const files = [];

  for (const inputPath of inputPaths) {
    const absolutePath = path.resolve(inputPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${inputPath}`);
    }

    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          files.push(path.join(absolutePath, entry.name));
        }
      }
    } else if (stat.isFile() && absolutePath.endsWith(".json")) {
      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toTypeScriptObject(article) {
  return JSON.stringify(article, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/\n/g, "\n  ");
}

function getExistingSlugs(source) {
  return Array.from(source.matchAll(/slug:\s*"([^"]+)"/g)).map((match) => match[1]);
}

const dryRun = process.argv.includes("--dry-run");
const inputPaths = process.argv.slice(2).filter((arg) => arg !== "--dry-run");

if (inputPaths.length === 0) {
  console.error("Usage: npm run brain:add-batch -- [--dry-run] local-brain/drafts");
  process.exit(1);
}

let draftFiles = [];

try {
  draftFiles = collectJsonFiles(inputPaths);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (draftFiles.length === 0) {
  console.error("No JSON draft files found.");
  process.exit(1);
}

const articles = [];
const errors = [];
const seenBatchSlugs = new Set();

for (const filePath of draftFiles) {
  let article;

  try {
    article = readJson(filePath);
  } catch (error) {
    errors.push(`${filePath}: invalid JSON (${error.message})`);
    continue;
  }

  const articleErrors = validateInsight(article);

  if (articleErrors.length > 0) {
    for (const error of articleErrors) {
      errors.push(`${filePath}: ${error}`);
    }
    continue;
  }

  if (seenBatchSlugs.has(article.slug)) {
    errors.push(`${filePath}: duplicate slug inside batch (${article.slug})`);
    continue;
  }

  seenBatchSlugs.add(article.slug);
  articles.push(article);
}

if (errors.length > 0) {
  console.error("Batch import failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const source = fs.readFileSync(contentPath, "utf8");
const existingSlugs = new Set(getExistingSlugs(source));
const newArticles = articles.filter((article) => !existingSlugs.has(article.slug));
const skippedArticles = articles.filter((article) => existingSlugs.has(article.slug));

if (newArticles.length === 0) {
  console.log(`No new articles to add. Skipped ${skippedArticles.length} existing article(s).`);
  process.exit(0);
}

if (dryRun) {
  console.log(`Dry run passed. ${newArticles.length} new article(s) ready to add.`);

  if (skippedArticles.length > 0) {
    console.log(`Would skip ${skippedArticles.length} existing article(s): ${skippedArticles.map((article) => article.slug).join(", ")}`);
  }

  process.exit(0);
}

const marker = "];";
const markerIndex = source.lastIndexOf(marker);

if (markerIndex === -1) {
  console.error("Could not find article array closing marker in content/insights.ts");
  process.exit(1);
}

const insertion = newArticles.map((article) => `  ${toTypeScriptObject(article)},`).join("\n") + "\n";
const updatedSource = `${source.slice(0, markerIndex)}${insertion}${source.slice(markerIndex)}`;

fs.writeFileSync(contentPath, updatedSource, "utf8");

console.log(`Added ${newArticles.length} insight article(s).`);

if (skippedArticles.length > 0) {
  console.log(`Skipped ${skippedArticles.length} existing article(s): ${skippedArticles.map((article) => article.slug).join(", ")}`);
}
