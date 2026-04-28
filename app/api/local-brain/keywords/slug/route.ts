import { NextRequest, NextResponse } from "next/server";
import { generateKeywordSlug, readKeywordRows } from "../../../../../lib/local-brain-core";

export const runtime = "nodejs";

function makeUniqueSlug(base: string) {
  const used = new Set(readKeywordRows().map((row) => row.slug).filter(Boolean));
  if (!used.has(base)) return base;

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { keyword?: string };
  const keyword = String(body.keyword || "").trim();
  if (!keyword) {
    return NextResponse.json({ slug: "" });
  }
  return NextResponse.json({ slug: makeUniqueSlug(generateKeywordSlug(keyword)) });
}
