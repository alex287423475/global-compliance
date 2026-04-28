import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  DraftMeta,
  MaterialPackageMeta,
  ensureDir,
  insightsIndexUrl,
  materialManifestPath,
  materialsDir,
  nowIso,
  reviewsDir,
  safeName,
  scanMaterialPackages,
  writeMaterialPackage,
} from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

const knowledgeDirDefault = path.join(process.cwd(), "local-brain", "knowledge");

function copyFilesRecursive(source: string, target: string) {
  if (!fs.existsSync(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      ensureDir(targetPath);
      copyFilesRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

async function saveUploadGroup(files: File[], targetDir: string) {
  const names: string[] = [];
  ensureDir(targetDir);
  for (const file of files) {
    const fileName = safeName(file.name);
    const filePath = path.join(targetDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    names.push(fileName);
  }
  return names;
}

export async function GET() {
  return NextResponse.json({ packages: scanMaterialPackages() });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const label = String(form.get("label") || "手动资料包").trim();
  const mergeDefaults = String(form.get("mergeDefaults") || "true") === "true";
  const packageId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const root = path.join(materialsDir, packageId);
  const knowledgeTarget = path.join(root, "knowledge");
  const reviewsTarget = path.join(root, "reviews");

  ensureDir(root);
  if (mergeDefaults) {
    copyFilesRecursive(knowledgeDirDefault, knowledgeTarget);
    copyFilesRecursive(reviewsDir, reviewsTarget);
  }

  const knowledgeFiles = form.getAll("knowledgeFiles").filter((item): item is File => item instanceof File);
  const reviewFiles = form.getAll("reviewFiles").filter((item): item is File => item instanceof File);
  const evidenceFiles = form.getAll("evidenceFiles").filter((item): item is File => item instanceof File);

  if (knowledgeFiles.length === 0 && reviewFiles.length === 0 && evidenceFiles.length === 0 && !mergeDefaults) {
    return NextResponse.json({ message: "手动资料导入模式下，至少上传一个文件，或勾选保留默认知识库。" }, { status: 400 });
  }

  const savedKnowledge = await saveUploadGroup(knowledgeFiles, knowledgeTarget);
  const savedReviews = await saveUploadGroup(reviewFiles, reviewsTarget);
  const savedEvidence = await saveUploadGroup(evidenceFiles, knowledgeTarget);

  const meta: MaterialPackageMeta = {
    id: packageId,
    label,
    mergeDefaults,
    createdAt: nowIso(),
    knowledgeFiles: savedKnowledge,
    reviewFiles: savedReviews,
    evidenceFiles: savedEvidence,
    knowledgeDir: knowledgeTarget,
    reviewsDir: reviewsTarget,
  };
  writeMaterialPackage(meta);
  return NextResponse.json({ ok: true, package: meta, siteUrl: insightsIndexUrl() });
}
