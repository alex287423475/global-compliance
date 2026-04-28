import { NextRequest, NextResponse } from "next/server";
import { readKeywordMiningConfig, type KeywordMiningPlatform } from "../../../../../lib/local-brain-core";

export const runtime = "nodejs";

type MiningCandidate = {
  id: string;
  keyword: string;
  slug: string;
  category: string;
  intent: string;
  priority: string;
  mode: string;
  searchVolume: number | null;
  competition: string;
  difficulty: string;
  source: string;
  score: number;
  description: string;
};

const platformLabels: Record<KeywordMiningPlatform, string> = {
  baidu: "百度PC",
  baidumobile: "百度移动",
  xiaohongshu: "小红书",
  douyin: "抖音",
};

function safeDecode(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function keywordSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function inferCategory(keyword: string) {
  const source = keyword.toLowerCase();
  if (/(paypal|stripe|chargeback|拒付|风控|支付)/u.test(source)) return "Payment Risk";
  if (/(amazon|poa|appeal|申诉|封号)/u.test(source)) return "Marketplace Appeal";
  if (/(fda|ce|合规|准入|标签|出口)/u.test(source)) return "Market Entry";
  if (/(gdpr|ccpa|隐私|数据)/u.test(source)) return "Data Privacy";
  return "Compliance Intelligence";
}

function inferIntent(keyword: string) {
  const source = keyword.toLowerCase();
  if (/(模板|代写|服务|多少钱|price|agency|consulting)/u.test(source)) return "Commercial";
  if (/(怎么|如何|what|why|guide|清单|步骤)/u.test(source)) return "Informational";
  return "Research";
}

function inferDifficulty(competitionLevel: number | null, companyCount: number | null) {
  if (competitionLevel === 1 || (companyCount ?? 0) > 400) return "High";
  if (competitionLevel === 2 || (companyCount ?? 0) > 120) return "Medium";
  return "Low";
}

function computeScore(searchVolume: number | null, competitionLevel: number | null, companyCount: number | null, sourceWeight = 0) {
  let score = 40 + sourceWeight;
  if (searchVolume) score += Math.min(30, Math.round(searchVolume / 100));
  if (competitionLevel === 1) score -= 12;
  if (competitionLevel === 2) score -= 6;
  if ((companyCount ?? 0) < 80) score += 10;
  if ((companyCount ?? 0) > 350) score -= 8;
  return Math.max(1, Math.min(99, score));
}

async function postForm(url: string, apiKey: string, body: URLSearchParams) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body,
  });

  const raw = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(raw || `HTTP ${response.status}`);
  }
  if (!response.ok || String(json?.errcode) !== "0") {
    throw new Error(String(json?.errmsg || raw || `HTTP ${response.status}`));
  }
  return json;
}

async function fetchSuggestKeywords(seed: string, platform: KeywordMiningPlatform, suggestUrl: string, apiKey: string, perPlatformLimit: number) {
  const payload = new URLSearchParams();
  payload.set("word", seed);
  payload.set("platform", platform);
  const json = await postForm(suggestUrl, apiKey, payload);
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .map((item: any) => ({
      keyword: safeDecode(item.promote_word || item.word),
      source: platformLabels[platform],
    }))
    .filter((item: { keyword: string }) => item.keyword)
    .slice(0, perPlatformLimit);
}

async function fetchLongTailKeywords(baseKeyword: string, keywordUrl: string, apiKey: string, pageSize: number) {
  const payload = new URLSearchParams();
  payload.set("keyword", baseKeyword);
  payload.set("page_index", "1");
  payload.set("page_size", String(Math.max(1, Math.min(100, pageSize))));
  const json = await postForm(keywordUrl, apiKey, payload);
  const rows = Array.isArray(json?.data?.word) ? json.data.word : [];
  return rows
    .map((item: any) => ({
      keyword: safeDecode(item.keyword),
      source: "5118长尾词",
    }))
    .filter((item: { keyword: string }) => item.keyword);
}

async function fetchMetrics(keywordParamUrl: string, apiKey: string, keywords: string[], waitSeconds: number) {
  if (keywords.length === 0) return new Map<string, any>();
  const submitBody = new URLSearchParams();
  submitBody.set("keywords", keywords.join("|"));
  const submitted = await postForm(keywordParamUrl, apiKey, submitBody);
  const taskId = submitted?.data?.taskid;
  if (!taskId) return new Map<string, any>();

  const started = Date.now();
  for (;;) {
    const body = new URLSearchParams();
    body.set("taskid", String(taskId));
    const response = await fetch(keywordParamUrl, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body,
    });
    const raw = await response.text();
    const json = JSON.parse(raw);
    if (String(json?.errcode) === "0") {
      const rows = Array.isArray(json?.data?.keyword_param) ? json.data.keyword_param : [];
      return new Map<string, any>(rows.map((row: any) => [safeDecode(row.keyword), row]));
    }
    if (String(json?.errcode) !== "101") {
      throw new Error(String(json?.errmsg || raw || `HTTP ${response.status}`));
    }
    if (Date.now() - started > Math.max(30, waitSeconds * 4) * 1000) {
      throw new Error("5118 指标任务等待超时");
    }
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { seeds?: string[] };
  const seeds = Array.isArray(body.seeds) ? body.seeds.map((item) => String(item).trim()).filter(Boolean) : [];
  if (seeds.length === 0) {
    return NextResponse.json({ message: "请至少提供一个种子词" }, { status: 400 });
  }

  const config = readKeywordMiningConfig();
  if (!config.apiKey) {
    return NextResponse.json({ message: "请先保存 5118 API Key" }, { status: 400 });
  }

  try {
    const suggestedRows = [];
    for (const seed of seeds) {
      for (const platform of config.platforms) {
        const rows = await fetchSuggestKeywords(seed, platform, config.suggestUrl, config.apiKey, config.perPlatformLimit);
        for (const row of rows) {
          suggestedRows.push({ ...row, seed });
        }
      }
    }

    const longTailSeeds = Array.from(new Set(suggestedRows.map((row) => row.keyword))).slice(0, Math.max(0, config.expandTopN));
    const longTailRows = [];
    for (const keyword of longTailSeeds) {
      const rows = await fetchLongTailKeywords(keyword, config.keywordUrl, config.apiKey, config.pageSize);
      for (const row of rows) {
        longTailRows.push({ ...row, seed: keyword });
      }
    }

    const deduped = Array.from(
      new Map(
        [...suggestedRows, ...longTailRows]
          .filter((row) => row.keyword)
          .map((row, index) => [`${row.keyword}|${row.source}`, { ...row, index }]),
      ).values(),
    ).slice(0, config.outputCount);

    const metricsMap =
      config.metricMode === "full"
        ? await fetchMetrics(
            config.keywordParamUrl,
            config.apiKey,
            deduped.slice(0, config.metricBatchSize).map((row) => row.keyword),
            config.waitSeconds,
          )
        : new Map<string, any>();

    const candidates: MiningCandidate[] = deduped.map((row, index) => {
      const metric = metricsMap.get(row.keyword);
      const searchVolume = metric ? Number(metric.index || metric.mobile_index || metric.google_index || 0) : null;
      const competitionLevel = metric ? Number(metric.bidword_kwc || 0) : null;
      const companyCount = metric ? Number(metric.bidword_company_count || 0) : null;
      const score = computeScore(searchVolume, competitionLevel, companyCount, 8 - Math.min(index, 8));
      return {
        id: `${keywordSlug(row.keyword)}-${index}`,
        keyword: row.keyword,
        slug: keywordSlug(row.keyword),
        category: inferCategory(row.keyword),
        intent: inferIntent(row.keyword),
        priority: score >= 80 ? "P1" : score >= 65 ? "P2" : "P3",
        mode: config.metricMode === "full" ? "API+指标" : "API下拉词",
        searchVolume,
        competition: metric ? `${companyCount ?? 0}家公司 / KWC ${competitionLevel ?? "-"}` : "-",
        difficulty: inferDifficulty(competitionLevel, companyCount),
        source: row.source,
        score,
        description: `${row.source} 下拉词，基于种子词「${row.seed}」扩展`,
      };
    });

    return NextResponse.json({ candidates, config });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "5118 挖掘失败" },
      { status: 400 },
    );
  }
}
