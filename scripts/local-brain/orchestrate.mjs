import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(process.cwd());
const localBrainRoot = path.join(repoRoot, "local-brain");
const runtimeDir = path.join(localBrainRoot, "runtime");
const statusPath = path.join(runtimeDir, "status.json");
const draftsDir = path.join(localBrainRoot, "drafts");
const auditsDir = path.join(localBrainRoot, "audits");
const insightsPath = path.join(repoRoot, "content", "insights.ts");
const tempDir = path.join(localBrainRoot, "tmp");
const materialsDir = path.join(localBrainRoot, "materials");
const factSourcesDir = path.join(localBrainRoot, "inputs", "fact-sources");
const progressPrefix = "[LOCAL_BRAIN_PROGRESS] ";

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((item) => item.trim());
}

function normalizeContentMode(value) {
  return String(value || "").trim() === "fact-source" ? "fact-source" : "standard";
}

function readKeywordRows() {
  const filePath = path.join(localBrainRoot, "inputs", "keywords.csv");
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    return {
      ...row,
      keyword: String(row.keyword || "").trim(),
      slug: String(row.slug || "").trim(),
      locale: String(row.locale || "zh").trim(),
      category: String(row.category || "").trim(),
      intent: String(row.intent || "").trim(),
      priority: String(row.priority || "P1").trim(),
      contentMode: normalizeContentMode(row.contentMode || row.mode),
    };
  }).filter((row) => row.keyword);
}

function requestKeywordRows(request) {
  const fileRows = readKeywordRows();
  const requestedRows = Array.isArray(request.keywordRows) ? request.keywordRows : [];
  const seeds = Array.isArray(request.seeds) ? request.seeds.map((item) => String(item).trim()).filter(Boolean) : [];
  const rows = [];

  for (const item of requestedRows) {
    const keyword = String(item?.keyword || "").trim();
    if (!keyword) continue;
    const match = fileRows.find((row) => row.slug && row.slug === item.slug) || fileRows.find((row) => row.keyword === keyword);
    rows.push({ ...(match || {}), ...item, keyword, contentMode: normalizeContentMode(item.contentMode || match?.contentMode) });
  }

  for (const seed of seeds) {
    if (rows.some((row) => row.keyword === seed)) continue;
    const match = fileRows.find((row) => row.keyword === seed || row.slug === seed);
    rows.push({ ...(match || {}), keyword: match?.keyword || seed, contentMode: normalizeContentMode(match?.contentMode) });
  }

  return rows;
}

function publishedSlugSet() {
  if (!fs.existsSync(insightsPath)) return new Set();
  const source = fs.readFileSync(insightsPath, "utf8");
  return new Set(Array.from(source.matchAll(/slug:\s*"([^"]+)"/g)).map((match) => match[1]));
}

function draftCountSummary() {
  ensureDir(draftsDir);
  const published = publishedSlugSet();
  const drafts = fs.readdirSync(draftsDir).filter((item) => item.endsWith(".json"));
  return {
    drafts: drafts.length,
    published: drafts.filter((item) => published.has(item.replace(/\.json$/u, ""))).length,
    pending: drafts.filter((item) => !published.has(item.replace(/\.json$/u, ""))).length,
  };
}

function loadStatus() {
  return readJson(statusPath, {
    updatedAt: null,
    isRunning: false,
    currentStep: null,
    lock: null,
    log: [],
    counts: { drafts: 0, published: 0, pending: 0, packages: 0 },
  });
}

function saveStatus(status) {
  ensureDir(path.dirname(statusPath));
  const counts = draftCountSummary();
  fs.writeFileSync(
    statusPath,
    JSON.stringify(
      {
        ...status,
        updatedAt: nowIso(),
        counts: {
          ...status.counts,
          ...counts,
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function appendLog(step, message) {
  const status = loadStatus();
  status.log = [...(status.log || []), { time: nowIso(), step, message }].slice(-160);
  saveStatus(status);
}

function setRunning(step) {
  const status = loadStatus();
  status.isRunning = true;
  status.currentStep = step;
  status.lock = { pid: process.pid, step, startedAt: nowIso() };
  saveStatus(status);
}

function finish(step, success, message) {
  const status = loadStatus();
  status.isRunning = false;
  status.currentStep = success ? null : step;
  status.lock = null;
  if (message) {
    status.log = [...(status.log || []), { time: nowIso(), step, message }].slice(-160);
  }
  saveStatus(status);
}

function pythonCommand() {
  const venvPython = path.join(repoRoot, ".venv-local-brain", "Scripts", "python.exe");
  return fs.existsSync(venvPython) ? venvPython : "python";
}

function runCommand(command, args, step) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, LOCAL_BRAIN_PROGRESS: "1", PYTHONUNBUFFERED: "1" },
      shell: false,
    });

    const output = [];
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output.push(text);
      for (const rawLine of text.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith(progressPrefix)) {
          try {
            const event = JSON.parse(line.slice(progressPrefix.length));
            appendLog(step, `${event.agent}: ${event.message_code}`);
            const status = loadStatus();
            status.currentStep = `${step}:${event.agent}`;
            saveStatus(status);
          } catch {
            appendLog(step, line);
          }
        } else {
          appendLog(step, line.slice(0, 600));
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output.push(text);
      for (const rawLine of text.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (line) appendLog(step, line.slice(0, 600));
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output.join("\n"));
      } else {
        reject(new Error(output.join("\n") || `${command} failed with exit code ${code}`));
      }
    });
  });
}

function prepareSelectionDir(selectedDrafts) {
  if (!Array.isArray(selectedDrafts) || selectedDrafts.length === 0) {
    return draftsDir;
  }
  const selectionDir = path.join(tempDir, `publish-${Date.now().toString(36)}`);
  ensureDir(selectionDir);
  for (const item of selectedDrafts) {
    const sourcePath = path.join(draftsDir, `${item}.json`);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(selectionDir, path.basename(sourcePath)));
    }
  }
  return selectionDir;
}

function packageManifestPath(packageId) {
  return path.join(materialsDir, packageId, "manifest.json");
}

function loadDraft(slug) {
  return readJson(path.join(draftsDir, `${slug}.json`), null);
}

function loadAudit(slug) {
  return readJson(path.join(auditsDir, `${slug}.audit.json`), null);
}

function resolveSourceDirs(request) {
  if (request.packageId) {
    const manifest = readJson(packageManifestPath(String(request.packageId)), null);
    if (!manifest) {
      throw new Error(`Material package not found: ${request.packageId}`);
    }
    return {
      sourceDir: manifest.knowledgeDir || "local-brain/knowledge",
      reviewsDir: manifest.reviewsDir || "local-brain/reviews",
    };
  }

  return {
    sourceDir: request.sourceDir || "local-brain/knowledge",
    reviewsDir: request.reviewsDir || "local-brain/reviews",
  };
}

function createNotesFile(prefix, notes) {
  const trimmed = String(notes || "").trim();
  if (!trimmed) return null;
  const filePath = path.join(tempDir, `${prefix}-${Date.now().toString(36)}.txt`);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, trimmed, "utf8");
  return filePath;
}

function readFactSourcePack(slug) {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return { filePath: null, content: "" };
  const candidates = [
    path.join(factSourcesDir, `${cleanSlug}.md`),
    path.join(factSourcesDir, `${cleanSlug}.txt`),
    path.join(factSourcesDir, `${cleanSlug}.json`),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) return { filePath: null, content: "" };
  return { filePath, content: fs.readFileSync(filePath, "utf8").trim() };
}

function createRowNotesFile(row, baseNotesFile) {
  const baseNotes = baseNotesFile && fs.existsSync(baseNotesFile) ? fs.readFileSync(baseNotesFile, "utf8").trim() : "";
  const contentMode = normalizeContentMode(row.contentMode);
  const factSource = contentMode === "fact-source" ? readFactSourcePack(row.slug) : { filePath: null, content: "" };
  if (contentMode === "fact-source" && !factSource.content) {
    appendLog("generate", `Fact-source mode has no source pack for ${row.slug || row.keyword}; using knowledge base and evidence rules only.`);
  }
  const parts = [];
  if (baseNotes) parts.push(baseNotes);
  if (factSource.content) {
    parts.push(
      [
        `Fact-source package: ${path.relative(repoRoot, factSource.filePath)}`,
        "",
        "The following material is source context. Use it as evidence context, but do not invent facts beyond it.",
        "",
        factSource.content,
      ].join("\n"),
    );
  }
  if (parts.length === 0) return null;
  return createNotesFile(`notes-${row.slug || Date.now().toString(36)}`, parts.join("\n\n---\n\n"));
}

async function runGenerate(request) {
  const rows = requestKeywordRows(request);
  const overwrite = Boolean(request.overwrite);
  const { sourceDir, reviewsDir } = resolveSourceDirs(request);
  const notesFile = createNotesFile("notes", request.notes);

  for (const row of rows) {
    const args = [
      "scripts/local-brain/generate-insight.py",
      "--seed",
      String(row.keyword),
      "--source-dir",
      String(sourceDir),
      "--reviews-dir",
      String(reviewsDir),
      "--content-mode",
      normalizeContentMode(row.contentMode),
    ];
    if (row.slug) args.push("--slug", String(row.slug));
    if (row.category) args.push("--category", String(row.category));
    if (row.intent) args.push("--intent", String(row.intent));
    if (row.locale) args.push("--locale", String(row.locale));
    const rowNotesFile = createRowNotesFile(row, notesFile);
    if (rowNotesFile) {
      args.push("--notes-file", path.relative(repoRoot, rowNotesFile));
    }
    if (overwrite) {
      args.push("--overwrite");
    }
    await runCommand(pythonCommand(), args, "generate");
  }
}

async function runReview(request) {
  const selectedDrafts = Array.isArray(request.selectedDrafts) ? request.selectedDrafts : [];
  if (selectedDrafts.length === 0) {
    throw new Error("No drafts selected for review");
  }

  for (const slug of selectedDrafts) {
    const args = ["scripts/local-brain/review-draft.py", "--slug", String(slug)];
    await runCommand(pythonCommand(), args, "review");
  }
}

async function runImages(request) {
  const selectedDrafts = Array.isArray(request.selectedDrafts) ? request.selectedDrafts : [];
  if (selectedDrafts.length === 0) {
    throw new Error("No drafts selected for image refresh");
  }

  const args = ["scripts/local-brain/refresh-images.mjs"];
  for (const slug of selectedDrafts) {
    args.push("--slug", String(slug));
  }
  await runCommand(process.execPath, args, "images");
}

async function runApprove(request) {
  const selectedDrafts = Array.isArray(request.selectedDrafts) ? request.selectedDrafts : [];
  if (selectedDrafts.length === 0) {
    throw new Error("No drafts selected for approval");
  }

  for (const slug of selectedDrafts) {
    const args = ["scripts/local-brain/approve-draft.py", "--slug", String(slug)];
    await runCommand(pythonCommand(), args, "approve");
  }
}

async function runRewrite(request) {
  const selectedDrafts = Array.isArray(request.selectedDrafts) ? request.selectedDrafts : [];
  if (selectedDrafts.length === 0) {
    throw new Error("No drafts selected for rewrite");
  }

  const { sourceDir, reviewsDir } = resolveSourceDirs(request);
  const notesFile = createNotesFile("rewrite-notes", request.notes);

  for (const slug of selectedDrafts) {
    const audit = loadAudit(String(slug));
    const draft = loadDraft(String(slug));
    const seed = String(audit?.seed || draft?.zhTitle || draft?.title || slug).trim();
    const args = [
      "scripts/local-brain/generate-insight.py",
      "--seed",
      seed,
      "--source-dir",
      String(sourceDir),
      "--reviews-dir",
      String(reviewsDir),
      "--overwrite",
    ];
    if (notesFile) {
      args.push("--notes-file", path.relative(repoRoot, notesFile));
    }
    await runCommand(pythonCommand(), args, "rewrite");
  }
}

async function runValidate(request) {
  const selectionDir = prepareSelectionDir(request.selectedDrafts);
  await runCommand("npm.cmd", ["run", "brain:add-batch", "--", "--dry-run", path.relative(repoRoot, selectionDir)], "validate");
}

async function runPublish(request) {
  const selectionDir = prepareSelectionDir(request.selectedDrafts);
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/publish-insights.ps1",
    "-DraftDir",
    path.relative(repoRoot, selectionDir),
    "-CommitMessage",
    String(request.commitMessage || `Publish compliance insights ${new Date().toISOString().slice(0, 16).replace("T", " ")}`),
  ];
  if (request.noPush) {
    args.push("-NoPush");
  }
  await runCommand("powershell", args, "publish");
}

async function main() {
  const requestPath = process.argv[2];
  if (!requestPath) throw new Error("Missing request JSON path");
  const request = readJson(requestPath, null);
  if (!request) throw new Error("Invalid request payload");

  setRunning(request.action);
  appendLog(request.action, `Task enqueued: ${request.action}`);

  try {
    if (request.action === "generate") {
      await runGenerate(request);
      await runCommand(process.execPath, ["scripts/local-brain/refresh-images.mjs"], "images");
      finish("generate", true, "Draft generation completed");
      return;
    }
    if (request.action === "review") {
      await runReview(request);
      finish("review", true, "AI review completed");
      return;
    }
    if (request.action === "images" || request.action === "visuals") {
      await runImages(request);
      finish(request.action, true, "Image refresh completed");
      return;
    }
    if (request.action === "approve") {
      await runApprove(request);
      finish("approve", true, "Manual approval completed");
      return;
    }
    if (request.action === "rewrite") {
      await runRewrite(request);
      finish("rewrite", true, "AI rewrite completed");
      return;
    }
    if (request.action === "validate") {
      await runValidate(request);
      finish("validate", true, "Draft validation completed");
      return;
    }
    if (request.action === "publish") {
      await runPublish(request);
      finish("publish", true, "Publish flow completed");
      return;
    }
    throw new Error(`Unsupported action: ${request.action}`);
  } catch (error) {
    finish(request.action, false, error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  finish("runtime", false, error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
