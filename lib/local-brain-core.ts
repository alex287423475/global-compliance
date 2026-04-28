import fs from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();
export const localBrainRoot = path.join(repoRoot, "local-brain");
export const draftsDir = path.join(localBrainRoot, "drafts");
export const auditsDir = path.join(localBrainRoot, "audits");
export const knowledgeDir = path.join(localBrainRoot, "knowledge");
export const reviewsDir = path.join(localBrainRoot, "reviews");
export const materialsDir = path.join(localBrainRoot, "materials");
export const runtimeDir = path.join(localBrainRoot, "runtime");
export const requestsDir = path.join(runtimeDir, "requests");
export const tempDir = path.join(localBrainRoot, "tmp");
export const configPath = path.join(localBrainRoot, "config.json");
export const keywordMiningConfigPath = path.join(localBrainRoot, "5118.config.json");
export const seedsFilePath = path.join(localBrainRoot, "seeds.txt");
export const keywordsCsvPath = path.join(localBrainRoot, "inputs", "keywords.csv");
export const keywordOptionsPath = path.join(localBrainRoot, "inputs", "keyword-options.json");
export const promptFilePath = path.join(localBrainRoot, "prompts", "insight-agent-prompt.md");
export const researchPromptFilePath = path.join(localBrainRoot, "prompts", "research-system.md");
export const reviewPromptFilePath = path.join(localBrainRoot, "prompts", "review-system.md");
export const rewritePromptFilePath = path.join(localBrainRoot, "prompts", "rewrite-system.md");
export const insightsContentPath = path.join(repoRoot, "content", "insights.ts");
export const vercelProjectPath = path.join(repoRoot, ".vercel", "project.json");

export type LocalBrainLogItem = {
  time: string;
  step: string;
  message: string;
};

export type LocalBrainStatus = {
  updatedAt: string | null;
  isRunning: boolean;
  currentStep: string | null;
  lock: { pid: number | null; step: string; startedAt: string } | null;
  log: LocalBrainLogItem[];
  counts: {
    drafts: number;
    published: number;
    pending: number;
    packages: number;
  };
};

export type DraftMeta = {
  slug: string;
  title: string;
  zhTitle: string;
  category: string;
  contentMode: string;
  market: string;
  riskLevel: string;
  coverImage: string;
  imageUpdatedAt: string;
  visualCount: number;
  updatedAt: string;
  fileName: string;
  filePath: string;
  published: boolean;
  expectedUrl: string;
};

export type MaterialPackageMeta = {
  id: string;
  label: string;
  mergeDefaults: boolean;
  createdAt: string;
  knowledgeFiles: string[];
  reviewFiles: string[];
  evidenceFiles: string[];
  knowledgeDir: string;
  reviewsDir: string;
};

export type LlmConfig = {
  provider: string;
  base_url: string;
  model: string;
  api_key: string;
};

export type AiRole = "modelA" | "modelB" | "modelC";

export type LlmConfigBundle = Record<AiRole, LlmConfig>;

export type KeywordMiningPlatform = "baidu" | "baidumobile" | "xiaohongshu" | "douyin";

export type KeywordMiningConfig = {
  suggestUrl: string;
  keywordUrl: string;
  keywordParamUrl: string;
  apiKey: string;
  metricMode: "full" | "suggest-only";
  platforms: KeywordMiningPlatform[];
  perPlatformLimit: number;
  expandTopN: number;
  pageSize: number;
  metricBatchSize: number;
  waitSeconds: number;
  outputCount: number;
};

export type PromptTemplateFile = {
  key: string;
  label: string;
  description: string;
  fileName: string;
  filePath: string;
  content: string;
};

export type KeywordFileRow = {
  keyword: string;
  slug: string;
  locale: string;
  category: string;
  intent: string;
  priority: string;
  contentMode: string;
  source: string;
  searchVolume: string;
  competition: string;
  difficulty: string;
};

export type KeywordOptionType = "category" | "intent";

export type KeywordOptions = {
  category: string[];
  intent: string[];
};

type StoredKeywordOptions = Partial<KeywordOptions> & {
  deletedCategory?: string[];
  deletedIntent?: string[];
};

export const defaultKeywordOptions: KeywordOptions = {
  category: [
    "支付风控",
    "平台申诉",
    "市场准入",
    "供应链合规",
    "危机公关",
    "知识产权攻防",
    "资本运作",
    "B2B 合规",
    "SEO 资产",
    "隐私与数据合规",
  ],
  intent: ["信息", "询价", "比较", "风险", "办理", "指南", "案例", "合规", "转化", "证据清单"],
};

export type AuditMeta = {
  slug: string;
  seed: string;
  reviewPassed: boolean;
  approved: boolean;
  approvedAt: string;
  revisionCount: number;
  findingsCount: number;
  llmEnabled: boolean;
  provider: string;
  model: string;
  updatedAt: string;
  fileName: string;
  filePath: string;
};

export type DashboardMetrics = {
  keywords: number;
  drafts: number;
  aiReview: number;
  aiRewrite: number;
  validated: number;
  reviewed: number;
  published: number;
  articleCount: number;
  logCount: number;
  packageCount: number;
};

const STATUS_PATH = path.join(runtimeDir, "status.json");
const KEYWORD_FILE_HEADERS: Array<keyof KeywordFileRow> = [
  "keyword",
  "slug",
  "locale",
  "category",
  "intent",
  "priority",
  "contentMode",
  "source",
  "searchVolume",
  "competition",
  "difficulty",
];
const keywordSlugTokenMap: Array<[RegExp, string]> = [
  [/支付风控/g, "payment-risk"],
  [/平台申诉/g, "marketplace-appeal"],
  [/市场准入/g, "market-entry"],
  [/供应链/g, "supply-chain"],
  [/危机公关/g, "crisis-pr"],
  [/知识产权/g, "intellectual-property"],
  [/资本运作/g, "capital-markets"],
  [/证据清单/g, "evidence-checklist"],
  [/证据/g, "evidence"],
  [/清单/g, "checklist"],
  [/拒付/g, "chargeback"],
  [/风控/g, "risk-control"],
  [/北京/g, "beijing"],
  [/全球博译/g, "qqbytran"],
  [/跨境电商/g, "cross-border-ecommerce"],
  [/独立站/g, "independent-site"],
  [/亚马逊/g, "amazon"],
  [/listing/gi, "listing"],
  [/证件/g, "certificate"],
  [/合同/g, "contract"],
  [/法律/g, "legal"],
  [/专利/g, "patent"],
  [/技术/g, "technical"],
  [/本地化/g, "localization"],
  [/翻译/g, "translation"],
  [/支付网关/g, "payment-gateway"],
  [/拒付/g, "chargeback"],
  [/申诉/g, "appeal"],
  [/关键词/g, "keywords"],
  [/词库/g, "keyword-bank"],
  [/合规/g, "compliance"],
  [/指南/g, "guide"],
  [/流程/g, "workflow"],
  [/风险/g, "risk"],
];
const defaultLlmConfig: LlmConfig = {
  provider: "openai",
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  api_key: "",
};
const promptTemplateRegistry = {
  "research-system": {
    label: "情报整理提示词",
    description: "用于 Researcher Agent，负责提取搜索意图、痛点、红线词、安全表达和证据类型。",
    filePath: researchPromptFilePath,
  },
  "generate-system": {
    label: "生成提示词",
    description: "用于 Researcher / Writer 主生成链路，决定文章框架、语气和结构化输出方式。",
    filePath: promptFilePath,
  },
  "review-system": {
    label: "AI质检提示词",
    description: "用于 Reviewer Agent，负责识别红线词、过度承诺和语气偏差。",
    filePath: reviewPromptFilePath,
  },
  "rewrite-system": {
    label: "AI重写提示词",
    description: "用于重写阶段，接收质检意见后输出可发布版本。",
    filePath: rewritePromptFilePath,
  },
} as const;
const defaultPromptContent: Record<keyof typeof promptTemplateRegistry, string> = {
  "research-system": `你是 Local Brain 合规文章生产线中的情报整理智能体。

只返回 JSON，包含 research_data、pain_points、red_lines、safe_terms 和 evidence。
standard 模式关注搜索意图和可复用 SEO 角度。
fact-source 模式关注可验证源文件、证据缺口和人工确认边界。`,
  "generate-system": `你是 Local Brain 合规文章生产线中的写作提示词。

你的任务是帮助写作链路产出面向跨境经营者的长篇合规 SEO 文章。

要求：
- 使用克制、权威、咨询式语气。
- 优先表达运营清晰度，而不是营销口号。
- 保留证据、红线逻辑和可复用知识结构。
- 输出必须支持文章、FAQ 和情报卡渲染。`,
  "review-system": `你是 Local Brain 合规文章生产线中的质检提示词。

你的任务是检查生成内容是否存在：
- 红线词公开承诺
- 医疗或保证结果类表达
- 缺乏依据的确定性判断
- 廉价营销腔或机器感

返回具体修改意见，不要输出泛泛评价。`,
  "rewrite-system": `你是 Local Brain 合规文章生产线中的重写提示词。

你的任务是在质检发现问题后重写草稿：
- 保留文章结构
- 删除风险表达
- 收紧证据边界
- 保持文章适合发布到 qqbytran.com/insights`,
};

export function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function readTextFile(filePath: string, fallback = "") {
  if (!fs.existsSync(filePath)) return fallback;
  return fs.readFileSync(filePath, "utf8");
}

export function writeTextFile(filePath: string, value: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

function escapeCsv(value: string) {
  if (/[",\n\r]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }
  return value;
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((item) => item.length > 0)) {
        rows.push(currentRow);
      }
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  if (currentRow.some((item) => item.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function splitMultiValue(value: string) {
  return value
    .split(/[、,，;；|]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferKeywordCategory(keyword: string) {
  if (/申诉|拒付|风控|支付|paypal|stripe/iu.test(keyword)) return "支付与申诉";
  if (/合同|协议|法律|条款|隐私/iu.test(keyword)) return "法律与合规";
  if (/listing|seo|词库|关键词|亚马逊|独立站/iu.test(keyword)) return "SEO与增长";
  if (/证件|公证|认证/iu.test(keyword)) return "证件与证明";
  return "合规本地化";
}

export function generateKeywordSlug(keyword: string) {
  let value = keyword.trim();
  for (const [pattern, replacement] of keywordSlugTokenMap) {
    value = value.replace(pattern, ` ${replacement} `);
  }

  const slug = value
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-")
    .slice(0, 88)
    .replace(/-+$/gu, "");

  if (slug) return slug;
  return `keyword-${new Date().toISOString().slice(0, 10).replace(/-/gu, "")}`;
}

export function normalizeKeywordRow(input: Partial<KeywordFileRow>): KeywordFileRow {
  const keyword = String(input.keyword || "").trim();
  const row: KeywordFileRow = {
    keyword,
    slug: generateKeywordSlug(String(input.slug || "").trim() || keyword),
    locale: String(input.locale || "zh").trim(),
    category: String(input.category || inferKeywordCategory(keyword)).trim(),
    intent: String(input.intent || "信息").trim(),
    priority: String(input.priority || "P1").trim(),
    contentMode: String(input.contentMode || "standard").trim(),
    source: String(input.source || "").trim(),
    searchVolume: String(input.searchVolume || "").trim(),
    competition: String(input.competition || "").trim(),
    difficulty: String(input.difficulty || "").trim(),
  };

  if (!row.keyword) throw new Error("关键词不能为空。");
  if (!row.slug) throw new Error("slug 不能为空。");
  if (!/^[a-z0-9-]+$/u.test(row.slug)) throw new Error("slug 只能包含小写字母、数字和连字符。");
  if (!["zh", "en", "ja"].includes(row.locale)) throw new Error("语言只能是 zh、en 或 ja。");
  if (!row.category) throw new Error("分类不能为空。");
  if (!row.intent) throw new Error("意图不能为空。");
  if (!row.priority) throw new Error("优先级不能为空。");
  if (!["standard", "fact-source"].includes(row.contentMode)) throw new Error("内容模式必须是 standard 或 fact-source。");
  return row;
}

function keywordRowsFromSeeds(seeds: string[]) {
  return seeds.map((keyword) =>
    normalizeKeywordRow({
      keyword,
      source: "seeds.txt",
    }),
  );
}

export function readKeywordRows() {
  if (fs.existsSync(keywordsCsvPath)) {
    const content = readTextFile(keywordsCsvPath);
    const rows = parseCsv(content);
    if (rows.length === 0) return [];

    const [headerRow, ...dataRows] = rows;
    const headerMap = Object.fromEntries(headerRow.map((item, index) => [item.trim(), index]));
    return dataRows
      .map((columns) => {
        const record = Object.fromEntries(
          KEYWORD_FILE_HEADERS.map((header) => [header, String(columns[headerMap[header] ?? -1] || "").trim()]),
        ) as Partial<KeywordFileRow>;
        try {
          return normalizeKeywordRow(record);
        } catch {
          return null;
        }
      })
      .filter((item): item is KeywordFileRow => item !== null);
  }

  const seeds = readSeedList();
  return keywordRowsFromSeeds(seeds);
}

export function writeKeywordRows(rows: KeywordFileRow[]) {
  ensureDir(path.dirname(keywordsCsvPath));
  const normalized = rows.map((row) => normalizeKeywordRow(row));
  const lines = [
    KEYWORD_FILE_HEADERS.join(","),
    ...normalized.map((row) => KEYWORD_FILE_HEADERS.map((header) => escapeCsv(String(row[header] || ""))).join(",")),
  ];
  writeTextFile(keywordsCsvPath, `${lines.join("\n")}\n`);
  writeSeedList(normalized.map((row) => row.keyword));
}

function normalizeOptionList(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function splitKeywordOptionValue(value: string) {
  return value
    .split(/[、,，;；|]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readStoredKeywordOptions(): StoredKeywordOptions {
  return readJsonFile<StoredKeywordOptions>(keywordOptionsPath, {});
}

export function readKeywordOptions(): KeywordOptions {
  const saved = readStoredKeywordOptions();
  const deletedCategory = new Set(normalizeOptionList(saved.deletedCategory));
  const deletedIntent = new Set(normalizeOptionList(saved.deletedIntent));
  const rows = readKeywordRows();

  return {
    category: normalizeOptionList([
      ...defaultKeywordOptions.category.filter((option) => !deletedCategory.has(option)),
      ...normalizeOptionList(saved.category),
      ...rows.flatMap((row) => splitKeywordOptionValue(row.category || "")),
    ]),
    intent: normalizeOptionList([
      ...defaultKeywordOptions.intent.filter((option) => !deletedIntent.has(option)),
      ...normalizeOptionList(saved.intent),
      ...rows.flatMap((row) => splitKeywordOptionValue(row.intent || "")),
    ]),
  };
}

export function writeKeywordOptions(options: StoredKeywordOptions) {
  writeJsonFile(keywordOptionsPath, {
    category: normalizeOptionList(options.category),
    intent: normalizeOptionList(options.intent),
    deletedCategory: normalizeOptionList(options.deletedCategory),
    deletedIntent: normalizeOptionList(options.deletedIntent),
  });
}

export function addKeywordOption(type: KeywordOptionType, value: string) {
  const clean = value.trim();
  if (!clean) throw new Error("选项不能为空。");

  const stored = readStoredKeywordOptions();
  const deletedKey = type === "category" ? "deletedCategory" : "deletedIntent";
  writeKeywordOptions({
    ...stored,
    [type]: normalizeOptionList([...(stored[type] || []), clean]),
    [deletedKey]: normalizeOptionList(stored[deletedKey]).filter((item) => item !== clean),
  });

  return readKeywordOptions();
}

export function deleteKeywordOption(type: KeywordOptionType, value: string) {
  const clean = value.trim();
  if (!clean) throw new Error("选项不能为空。");

  const stored = readStoredKeywordOptions();
  const deletedKey = type === "category" ? "deletedCategory" : "deletedIntent";
  writeKeywordOptions({
    ...stored,
    [type]: normalizeOptionList(stored[type]).filter((item) => item !== clean),
    [deletedKey]: normalizeOptionList([...(stored[deletedKey] || []), clean]),
  });

  return readKeywordOptions();
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";
}

export function insightsIndexUrl() {
  return `${siteUrl().replace(/\/+$/u, "")}/insights`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "") || "file";
}

export function currentStatus(): LocalBrainStatus {
  const fallback: LocalBrainStatus = {
    updatedAt: null,
    isRunning: false,
    currentStep: null,
    lock: null,
    log: [],
    counts: { drafts: 0, published: 0, pending: 0, packages: 0 },
  };
  const status = readJsonFile<LocalBrainStatus>(STATUS_PATH, fallback);
  const drafts = scanDrafts();
  const packages = scanMaterialPackages();
  return {
    ...status,
    counts: {
      drafts: drafts.length,
      published: drafts.filter((item) => item.published).length,
      pending: drafts.filter((item) => !item.published).length,
      packages: packages.length,
    },
  };
}

export function updateStatus(next: Partial<LocalBrainStatus>) {
  const current = currentStatus();
  const merged: LocalBrainStatus = {
    ...current,
    ...next,
    updatedAt: nowIso(),
    counts: current.counts,
  };
  writeJsonFile(STATUS_PATH, merged);
  return merged;
}

export function publishedSlugSet() {
  if (!fs.existsSync(insightsContentPath)) return new Set<string>();
  const source = fs.readFileSync(insightsContentPath, "utf8");
  return new Set(Array.from(source.matchAll(/slug:\s*"([^"]+)"/g)).map((match) => match[1]));
}

export function scanDrafts(): DraftMeta[] {
  ensureDir(draftsDir);
  const publishedSlugs = publishedSlugSet();
  return fs
    .readdirSync(draftsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(draftsDir, fileName);
      const article = readJsonFile<Record<string, unknown>>(filePath, {});
      const slug = String(article.slug || fileName.replace(/\.json$/u, ""));
      return {
        slug,
        title: String(article.title || slug),
        zhTitle: String(article.zhTitle || article.title || slug),
        category: String(article.category || "Unknown"),
        contentMode: String(article.contentMode || "standard"),
        market: String(article.market || "Unknown"),
        riskLevel: String(article.riskLevel || "Unknown"),
        coverImage: String(article.coverImage || ""),
        imageUpdatedAt: String(article.imageUpdatedAt || ""),
        visualCount: Array.isArray(article.visualAssets) ? article.visualAssets.length : 0,
        updatedAt: String(article.updatedAt || ""),
        fileName,
        filePath,
        published: publishedSlugs.has(slug),
        expectedUrl: `${insightsIndexUrl()}/${slug}`,
      };
    })
    .sort((left, right) => {
      const leftTime = fs.statSync(left.filePath).mtimeMs;
      const rightTime = fs.statSync(right.filePath).mtimeMs;
      return rightTime - leftTime;
    });
}

export function scanAudits(): AuditMeta[] {
  ensureDir(auditsDir);
  return fs
    .readdirSync(auditsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(auditsDir, fileName);
      const audit = readJsonFile<Record<string, unknown>>(filePath, {});
      const draftPath = String(audit.draft || "");
      const slugFromDraft = draftPath ? path.basename(draftPath).replace(/\.json$/u, "") : fileName.replace(/\.audit\.json$/u, "");
      const findings = Array.isArray(audit.review_findings) ? audit.review_findings : [];
      const stats = fs.statSync(filePath);
      return {
        slug: slugFromDraft,
        seed: String(audit.seed || slugFromDraft),
        reviewPassed: Boolean(audit.review_passed),
        approved: Boolean(audit.approved),
        approvedAt: String(audit.approved_at || ""),
        revisionCount: Number(audit.revision_count || 0),
        findingsCount: findings.length,
        llmEnabled: Boolean(audit.llm_enabled),
        provider: String(audit.llm_provider || ""),
        model: String(audit.llm_model || ""),
        updatedAt: stats.mtime.toISOString(),
        fileName,
        filePath,
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function isLikelyValidatedDraft(filePath: string) {
  const draft = readJsonFile<Record<string, unknown>>(filePath, {});
  const hasBody = typeof draft.bodyMarkdown === "string" && String(draft.bodyMarkdown).length >= 3000;
  const hasFaq = Array.isArray(draft.faq) && draft.faq.length >= 3;
  const hasToc = Array.isArray(draft.toc) && draft.toc.length >= 5;
  const hasCards = Array.isArray(draft.intelligenceCards) && draft.intelligenceCards.length >= 3;
  return Boolean(draft.slug) && Boolean(draft.title) && hasBody && hasFaq && hasToc && hasCards;
}

export function materialManifestPath(packageId: string) {
  return path.join(materialsDir, packageId, "manifest.json");
}

export function scanMaterialPackages(): MaterialPackageMeta[] {
  ensureDir(materialsDir);
  return fs
    .readdirSync(materialsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJsonFile<MaterialPackageMeta | null>(materialManifestPath(entry.name), null))
    .filter((item): item is MaterialPackageMeta => Boolean(item))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export function readLlmConfig(): LlmConfig {
  return readLlmConfigBundle().modelA;
}

function normalizeLlmConfig(input: Partial<LlmConfig> | undefined, fallback: LlmConfig): LlmConfig {
  return {
    provider: String(input?.provider || fallback.provider).trim(),
    base_url: String(input?.base_url || fallback.base_url).trim(),
    model: String(input?.model || fallback.model).trim(),
    api_key: String(input?.api_key || fallback.api_key).trim(),
  };
}

export function readLlmConfigBundle(): LlmConfigBundle {
  const raw = readJsonFile<Record<string, unknown>>(configPath, defaultLlmConfig as unknown as Record<string, unknown>);
  const base = normalizeLlmConfig(raw as Partial<LlmConfig>, defaultLlmConfig);
  const roleConfigs = raw as Record<AiRole, Partial<LlmConfig>>;
  return {
    modelA: normalizeLlmConfig(roleConfigs.modelA, base),
    modelB: normalizeLlmConfig(roleConfigs.modelB, base),
    modelC: normalizeLlmConfig(roleConfigs.modelC, base),
  };
}

export function readKeywordMiningConfig(): KeywordMiningConfig {
  return readJsonFile<KeywordMiningConfig>(keywordMiningConfigPath, {
    suggestUrl: "https://apis.5118.com/suggest/list",
    keywordUrl: "https://apis.5118.com/keyword/word/v2",
    keywordParamUrl: "https://apis.5118.com/keywordparam/v2",
    apiKey: "",
    metricMode: "full",
    platforms: ["baidu", "baidumobile", "xiaohongshu", "douyin"],
    perPlatformLimit: 30,
    expandTopN: 8,
    pageSize: 30,
    metricBatchSize: 80,
    waitSeconds: 8,
    outputCount: 40,
  });
}

export function readSeedList() {
  return readTextFile(seedsFilePath)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function writeSeedList(seeds: string[]) {
  writeTextFile(seedsFilePath, seeds.join("\n") + (seeds.length ? "\n" : ""));
}

export function readPromptTemplate() {
  return readPromptFiles().find((item) => item.key === "generate-system")?.content || "";
}

export function writePromptTemplate(prompt: string) {
  writePromptFile("generate-system", prompt);
}

export function writeLlmConfig(config: LlmConfig) {
  const current = readLlmConfigBundle();
  writeLlmConfigBundle({
    ...current,
    modelA: normalizeLlmConfig(config, current.modelA),
  });
}

export function writeLlmConfigBundle(bundle: LlmConfigBundle) {
  const normalized = {
    modelA: normalizeLlmConfig(bundle.modelA, defaultLlmConfig),
    modelB: normalizeLlmConfig(bundle.modelB, defaultLlmConfig),
    modelC: normalizeLlmConfig(bundle.modelC, defaultLlmConfig),
  };
  writeJsonFile(configPath, {
    ...normalized.modelA,
    ...normalized,
  });
}

export function writeKeywordMiningConfig(config: KeywordMiningConfig) {
  writeJsonFile(keywordMiningConfigPath, config);
}

export function readPromptFiles(): PromptTemplateFile[] {
  return Object.entries(promptTemplateRegistry).map(([key, meta]) => ({
    key,
    label: meta.label,
    description: meta.description,
    fileName: path.basename(meta.filePath),
    filePath: meta.filePath,
    content: readTextFile(meta.filePath, defaultPromptContent[key as keyof typeof promptTemplateRegistry]),
  }));
}

export function writePromptFile(key: keyof typeof promptTemplateRegistry, content: string) {
  const target = promptTemplateRegistry[key];
  if (!target) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  writeTextFile(target.filePath, content);
}

export function writeMaterialPackage(meta: MaterialPackageMeta) {
  writeJsonFile(materialManifestPath(meta.id), meta);
}

export function projectInfo() {
  return readJsonFile<Record<string, string>>(vercelProjectPath, {});
}

export function latestLogs(limit = 60) {
  return currentStatus().log.slice(-limit);
}

export function dashboardMetrics(): DashboardMetrics {
  const drafts = scanDrafts();
  const audits = scanAudits();
  const status = currentStatus();
  const keywords = readKeywordRows();
  return {
    keywords: keywords.length > 0 ? keywords.length : drafts.length,
    drafts: drafts.length,
    aiReview: audits.length,
    aiRewrite: audits.reduce((sum, item) => sum + Math.max(0, item.revisionCount), 0),
    validated: drafts.filter((draft) => isLikelyValidatedDraft(draft.filePath)).length,
    reviewed: audits.filter((item) => item.reviewPassed).length,
    published: drafts.filter((draft) => draft.published).length,
    articleCount: drafts.length,
    logCount: status.log.length,
    packageCount: scanMaterialPackages().length,
  };
}
