import { NextRequest, NextResponse } from "next/server";
import { readLlmConfigBundle, writeLlmConfig, writeLlmConfigBundle } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

function maskApiKey(value: string) {
  return value ? `${value.slice(0, 4)}...${value.slice(-4)}` : "";
}

function roleLabel(role: string) {
  if (role === "modelA") return "模型 A";
  if (role === "modelB") return "模型 B";
  return "模型 C";
}

function rolePurpose(role: string) {
  if (role === "modelA") return "文章生成";
  if (role === "modelB") return "AI 质检与 AI 重写";
  return "关键词挖掘与站内 AI 搜索";
}

export async function GET() {
  const bundle = readLlmConfigBundle();
  return NextResponse.json(
    Object.fromEntries(
      Object.entries(bundle).map(([role, config]) => [
        role,
        {
          role,
          label: roleLabel(role),
          purpose: rolePurpose(role),
          provider: config.provider,
          base_url: config.base_url,
          model: config.model,
          api_key_masked: maskApiKey(config.api_key),
          api_key_set: Boolean(config.api_key),
        },
      ]),
    ),
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;

  if (body.role) {
    const role = String(body.role) as "modelA" | "modelB" | "modelC";
    const bundle = readLlmConfigBundle();
    const current = bundle[role] || bundle.modelA;
    const nextConfig = {
      provider: String(body.provider || current.provider || "openai").trim(),
      base_url: String(body.base_url || current.base_url || "").trim(),
      model: String(body.model || current.model || "").trim(),
      api_key: String(body.api_key || current.api_key || "").trim(),
    };
    writeLlmConfigBundle({
      ...bundle,
      [role]: nextConfig,
    });
    return NextResponse.json({ ok: true });
  }

  const legacyConfig = {
    provider: String(body.provider || "openai").trim(),
    base_url: String(body.base_url || "").trim(),
    model: String(body.model || "").trim(),
    api_key: String(body.api_key || "").trim(),
  };
  writeLlmConfig(legacyConfig);
  return NextResponse.json({ ok: true });
}
