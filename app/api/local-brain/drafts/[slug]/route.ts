import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { draftsDir, ensureDir, readJsonFile, writeJsonFile } from "../../../../../lib/local-brain-core";

export const runtime = "nodejs";

function safeSlug(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function draftPath(slug: string) {
  const normalized = safeSlug(slug);
  if (!normalized) throw new Error("无效草稿 slug。");
  return path.join(draftsDir, `${normalized}.json`);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const filePath = draftPath(slug);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ message: "草稿不存在。" }, { status: 404 });
  }
  return NextResponse.json({ draft: readJsonFile<Record<string, unknown>>(filePath, {}), filePath });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "草稿编辑只允许在本地开发环境执行。" }, { status: 403 });
  }

  const { slug } = await context.params;
  const filePath = draftPath(slug);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ message: "草稿不存在。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { draft?: unknown } | null;
  if (!body || typeof body.draft !== "object" || body.draft === null || Array.isArray(body.draft)) {
    return NextResponse.json({ message: "请求体必须包含 draft 对象。" }, { status: 400 });
  }

  const current = readJsonFile<Record<string, unknown>>(filePath, {});
  const next = { ...current, ...(body.draft as Record<string, unknown>), slug: safeSlug(String(current.slug || slug)) };
  ensureDir(path.dirname(filePath));
  writeJsonFile(filePath, next);
  return NextResponse.json({ ok: true, draft: next, filePath });
}
