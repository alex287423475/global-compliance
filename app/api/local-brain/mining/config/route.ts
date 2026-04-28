import { NextRequest, NextResponse } from "next/server";
import { readKeywordMiningConfig, writeKeywordMiningConfig, type KeywordMiningConfig, type KeywordMiningPlatform } from "../../../../../lib/local-brain-core";

export const runtime = "nodejs";

const platformAllowlist = new Set<KeywordMiningPlatform>(["baidu", "baidumobile", "xiaohongshu", "douyin"]);

export async function GET() {
  const config = readKeywordMiningConfig();
  return NextResponse.json({
    ...config,
    apiKeyMasked: config.apiKey ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : "",
    apiKeySet: Boolean(config.apiKey),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<KeywordMiningConfig>;
  const current = readKeywordMiningConfig();

  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((item): item is KeywordMiningPlatform => typeof item === "string" && platformAllowlist.has(item as KeywordMiningPlatform))
    : current.platforms;

  const nextConfig: KeywordMiningConfig = {
    suggestUrl: String(body.suggestUrl || current.suggestUrl).trim(),
    keywordUrl: String(body.keywordUrl || current.keywordUrl).trim(),
    keywordParamUrl: String(body.keywordParamUrl || current.keywordParamUrl).trim(),
    apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : current.apiKey,
    metricMode: body.metricMode === "suggest-only" ? "suggest-only" : "full",
    platforms: platforms.length > 0 ? platforms : current.platforms,
    perPlatformLimit: Number(body.perPlatformLimit || current.perPlatformLimit),
    expandTopN: Number(body.expandTopN || current.expandTopN),
    pageSize: Number(body.pageSize || current.pageSize),
    metricBatchSize: Number(body.metricBatchSize || current.metricBatchSize),
    waitSeconds: Number(body.waitSeconds || current.waitSeconds),
    outputCount: Number(body.outputCount || current.outputCount),
  };

  writeKeywordMiningConfig(nextConfig);
  return NextResponse.json({ ok: true });
}
