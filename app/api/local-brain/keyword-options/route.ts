import { NextRequest, NextResponse } from "next/server";
import { addKeywordOption, deleteKeywordOption, readKeywordOptions, type KeywordOptionType } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

function parseType(value: unknown): KeywordOptionType | null {
  return value === "category" || value === "intent" ? value : null;
}

export async function GET() {
  return NextResponse.json({ options: readKeywordOptions() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { type?: unknown; value?: unknown };
    const type = parseType(body.type);
    if (!type) return NextResponse.json({ message: "选项类型必须是 category 或 intent。" }, { status: 400 });
    return NextResponse.json({ ok: true, options: addKeywordOption(type, String(body.value || "")) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "添加选项失败。" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { type?: unknown; value?: unknown };
    const type = parseType(body.type);
    if (!type) return NextResponse.json({ message: "选项类型必须是 category 或 intent。" }, { status: 400 });
    return NextResponse.json({ ok: true, options: deleteKeywordOption(type, String(body.value || "")) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除选项失败。" }, { status: 400 });
  }
}
