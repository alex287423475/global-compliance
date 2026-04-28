import { NextRequest, NextResponse } from "next/server";
import { readPromptFiles, writePromptFile, writePromptTemplate } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ prompts: readPromptFiles() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const prompt = String(body.prompt || "");
  if (!prompt.trim()) {
    return NextResponse.json({ message: "Prompt 不能为空" }, { status: 400 });
  }
  writePromptTemplate(prompt);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const key = String(body.key || "").trim() as "generate-system" | "review-system" | "rewrite-system";
  const content = String(body.content || "");
  if (!key) {
    return NextResponse.json({ message: "Prompt key 不能为空" }, { status: 400 });
  }
  if (!content.trim()) {
    return NextResponse.json({ message: "Prompt 内容不能为空" }, { status: 400 });
  }
  writePromptFile(key, content);
  const prompt = readPromptFiles().find((item) => item.key === key);
  return NextResponse.json({ ok: true, prompt });
}
