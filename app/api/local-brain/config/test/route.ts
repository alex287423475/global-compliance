import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, "");
}

function resolveOpenAiCompatibleUrl(baseUrl: string) {
  const trimmed = trimTrailingSlash(baseUrl);
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function resolveAnthropicUrl(baseUrl: string) {
  const trimmed = trimTrailingSlash(baseUrl);
  if (trimmed.endsWith("/messages")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

async function testOpenAiCompatible(baseUrl: string, apiKey: string, model: string) {
  const response = await fetch(resolveOpenAiCompatibleUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: "system", content: "Reply with OK only." },
        { role: "user", content: "Connection test." },
      ],
    }),
  });
  return response;
}

async function testAnthropic(baseUrl: string, apiKey: string, model: string) {
  const response = await fetch(resolveAnthropicUrl(baseUrl), {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      system: "Reply with OK only.",
      messages: [{ role: "user", content: "Connection test." }],
    }),
  });
  return response;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const apiKey = String(body.api_key || "").trim();
  const baseUrl = String(body.base_url || "").trim();
  const model = String(body.model || "").trim();
  const provider = String(body.provider || "").trim().toLowerCase();

  if (!apiKey || !baseUrl || !model) {
    return NextResponse.json({ message: "API Key、Base URL 和模型都不能为空。" }, { status: 400 });
  }

  const started = Date.now();

  try {
    const response =
      provider === "claude"
        ? await testAnthropic(baseUrl, apiKey, model)
        : await testOpenAiCompatible(baseUrl, apiKey, model);

    const raw = await response.text();
    if (!response.ok) {
      return NextResponse.json({ message: raw.slice(0, 800) || `HTTP ${response.status}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      provider,
      model,
      latencyMs: Date.now() - started,
      message: raw.slice(0, 200) || "OK",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        message: `LLM network request failed. Check API Base URL, proxy/VPN, and provider endpoint. Details: ${message}`,
      },
      { status: 400 },
    );
  }
}
