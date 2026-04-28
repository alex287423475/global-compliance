import { NextRequest, NextResponse } from "next/server";

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

function toNumber(value: unknown) {
  const cleaned = String(value ?? "").replace(/[,%]/gu, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreFromMetric(volume: number | null, difficulty: number | null) {
  let score = 45;
  if (volume) score += Math.min(30, Math.round(volume / 100));
  if (difficulty) score -= Math.min(20, Math.round(difficulty / 10));
  return Math.max(1, Math.min(99, score));
}

function parseDelimited(content: string) {
  const lines = content.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(",") ? "," : null;
  if (!delimiter) {
    return lines.map((line) => ({ keyword: line }));
  }

  const headers = lines[0].split(delimiter).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((item) => item.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });
}

function extractKeyword(row: Record<string, unknown>) {
  const keys = ["关键词", "keyword", "term", "word", "下拉词", "长尾词"];
  for (const key of keys) {
    const match = Object.keys(row).find((header) => header.toLowerCase() === key.toLowerCase());
    if (match && String(row[match] || "").trim()) {
      return String(row[match]).trim();
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ message: "请至少上传一个 5118 导出文件" }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  for (const file of files) {
    const content = await file.text();
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "json") {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        rows.push(...parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"));
      }
      continue;
    }
    rows.push(...parseDelimited(content));
  }

  const candidates: MiningCandidate[] = rows
    .map((row, index) => {
      const keyword = extractKeyword(row);
      if (!keyword) return null;
      const volume = toNumber(row["搜索量"] ?? row["指数"] ?? row["searchVolume"] ?? row["index"]);
      const difficulty = toNumber(row["难度"] ?? row["difficulty"]);
      const competitionRaw = row["竞争度"] ?? row["competition"] ?? row["竞价公司数"] ?? row["companyCount"] ?? "-";
      const score = scoreFromMetric(volume, difficulty);
      return {
        id: `${keywordSlug(keyword)}-${index}`,
        keyword,
        slug: keywordSlug(keyword),
        category: inferCategory(keyword),
        intent: inferIntent(keyword),
        priority: score >= 80 ? "P1" : score >= 65 ? "P2" : "P3",
        mode: "5118手动导入",
        searchVolume: volume,
        competition: String(competitionRaw || "-"),
        difficulty: difficulty == null ? "-" : String(difficulty),
        source: "5118导入文件",
        score,
        description: `来自文件导入：${Object.keys(row).join(" / ")}`,
      };
    })
    .filter((item): item is MiningCandidate => Boolean(item));

  return NextResponse.json({ candidates });
}
