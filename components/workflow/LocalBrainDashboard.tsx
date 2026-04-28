"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type AiRole = "modelA" | "modelB" | "modelC";
type NavId = "overview" | "models" | "prompts" | "keyword-mining" | "seed-files" | "sitemap" | "operations" | "logs";
type WorkflowAction = "generate" | "images" | "visuals" | "review" | "rewrite" | "validate" | "approve" | "publish";
type MiningTab = "api" | "manual";
type MiningPlatform = "baidu" | "baidumobile" | "xiaohongshu" | "douyin";
type DraftFilter = "all" | "draft" | "needs-review" | "approved" | "published";

type AiConfig = {
  role: AiRole;
  label: string;
  purpose: string;
  provider: string;
  base_url: string;
  model: string;
  api_key_set: boolean;
  api_key_masked: string;
};

type AiConfigBundle = Record<AiRole, AiConfig>;

type PromptFile = {
  key: string;
  label: string;
  description: string;
  fileName: string;
  filePath: string;
  content: string;
};

type MaterialPackage = {
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

type DraftMeta = {
  slug: string;
  title: string;
  zhTitle: string;
  category: string;
  contentMode: string;
  market: string;
  riskLevel: string;
  coverImage?: string;
  imageUpdatedAt?: string;
  visualCount: number;
  updatedAt: string;
  fileName: string;
  filePath: string;
  published: boolean;
  expectedUrl: string;
};

type DraftEditorState = {
  slug: string;
  filePath: string;
  content: string;
  published: boolean;
  expectedUrl: string;
};

type AuditMeta = {
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

type Metrics = {
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

type WorkflowStatus = {
  updatedAt: string | null;
  isRunning: boolean;
  currentStep: string | null;
  lock: { pid: number | null; step: string; startedAt: string } | null;
  log: Array<{ time: string; step: string; message: string }>;
  counts: { drafts: number; published: number; pending: number; packages: number };
  siteUrl: string;
  packages: MaterialPackage[];
  audits: AuditMeta[];
  seeds: string[];
  metrics: Metrics;
};

type KeywordFileRow = {
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
  articleStatus?: string;
  articleStatusLabel?: string;
  articleUrl?: string | null;
  generated?: boolean;
};

type KeywordOptionType = "category" | "intent";

type KeywordOptions = {
  category: string[];
  intent: string[];
};

type MiningConfig = {
  suggestUrl: string;
  keywordUrl: string;
  keywordParamUrl: string;
  apiKey: string;
  apiKeyMasked?: string;
  apiKeySet?: boolean;
  metricMode: "full" | "suggest-only";
  platforms: MiningPlatform[];
  perPlatformLimit: number;
  expandTopN: number;
  pageSize: number;
  metricBatchSize: number;
  waitSeconds: number;
  outputCount: number;
};

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

type AiTestResult = {
  success: boolean;
  message: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
};

const navItems: Array<{ id: NavId; title: string; subtitle: string }> = [
  { id: "overview", title: "运行概览", subtitle: "查看阶段数量与队列状态" },
  { id: "models", title: "AI 模型配置", subtitle: "模型 A、B、C" },
  { id: "prompts", title: "Prompt 提示词", subtitle: "生成、质检、重写提示词" },
  { id: "keyword-mining", title: "关键词挖掘", subtitle: "5118 API 与手动导入" },
  { id: "seed-files", title: "关键词文件", subtitle: "结构化关键词资产" },
  { id: "sitemap", title: "站点地图", subtitle: "Sitemap 与提交入口" },
  { id: "operations", title: "流程操作", subtitle: "生成、配图、审核、发布" },
  { id: "logs", title: "最近日志", subtitle: "脚本事件与审计轨迹" },
];

const providerDefaults: Record<string, { label: string; baseUrl: string; model: string }> = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  claude: { label: "Claude", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5-20250929" },
  gemini: { label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
};

const defaultMiningConfig: MiningConfig = {
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
};

const emptyKeywordRow: KeywordFileRow = {
  keyword: "",
  slug: "",
  locale: "zh",
  category: "支付风控",
  intent: "信息",
  priority: "P1",
  contentMode: "standard",
  source: "manual",
  searchVolume: "",
  competition: "",
  difficulty: "",
};

const defaultKeywordOptions: KeywordOptions = {
  category: ["支付风控", "平台申诉", "市场准入", "供应链合规", "危机公关", "知识产权攻防", "资本运作", "B2B 合规", "SEO 资产", "隐私与数据合规"],
  intent: ["信息", "询价", "比较", "风险", "办理", "指南", "案例", "合规", "转化", "证据清单"],
};

const defaultSeeds = ["Amazon POA 申诉信", "Stripe PayPal 拒付抗辩", "独立站合规政策"].join("\n");

const draftFilters: Array<{ id: DraftFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "draft", label: "未发布" },
  { id: "needs-review", label: "待质检/待重写" },
  { id: "approved", label: "已审核" },
  { id: "published", label: "已发布" },
];

function splitMultiValue(value: string) {
  return value
    .split(/[、,，;；|]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeKeywordOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function providerLabel(provider: string) {
  return providerDefaults[provider]?.label || provider || "未知提供商";
}

function matchesDraftFilter(draft: DraftMeta, audit: AuditMeta | undefined, filter: DraftFilter) {
  if (filter === "all") return true;
  if (filter === "published") return draft.published;
  if (filter === "approved") return Boolean(audit?.approved) && !draft.published;
  if (filter === "needs-review") return !draft.published && (!audit || !audit.reviewPassed);
  return !draft.published;
}

function defaultConfig(role: AiRole): AiConfig {
  const defaults = providerDefaults.deepseek;
  return {
    role,
    label: role === "modelA" ? "模型 A" : role === "modelB" ? "模型 B" : "模型 C",
    purpose: role === "modelA" ? "文章生成" : role === "modelB" ? "质检与重写" : "关键词挖掘与检索",
    provider: "deepseek",
    base_url: defaults.baseUrl,
    model: defaults.model,
    api_key_set: false,
    api_key_masked: "",
  };
}

export function LocalBrainDashboard() {
  const [activeNav, setActiveNav] = useState<NavId>("overview");
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [config, setConfig] = useState<AiConfigBundle>({
    modelA: defaultConfig("modelA"),
    modelB: defaultConfig("modelB"),
    modelC: defaultConfig("modelC"),
  });
  const [configForms, setConfigForms] = useState<AiConfigBundle>({
    modelA: defaultConfig("modelA"),
    modelB: defaultConfig("modelB"),
    modelC: defaultConfig("modelC"),
  });
  const [apiKeys, setApiKeys] = useState<Record<AiRole, string>>({ modelA: "", modelB: "", modelC: "" });
  const [testResults, setTestResults] = useState<Record<AiRole, AiTestResult | null>>({ modelA: null, modelB: null, modelC: null });
  const [prompts, setPrompts] = useState<PromptFile[]>([]);
  const [activePromptKey, setActivePromptKey] = useState("generate-system");
  const [promptDraft, setPromptDraft] = useState("");
  const activePromptKeyRef = useRef("generate-system");
  const promptDraftRef = useRef("");
  const [seedText, setSeedText] = useState(defaultSeeds);
  const [notes, setNotes] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [packageLabel, setPackageLabel] = useState("Local Brain material package");
  const [mergeDefaults, setMergeDefaults] = useState(true);
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [miningTab, setMiningTab] = useState<MiningTab>("api");
  const [miningConfig, setMiningConfig] = useState<MiningConfig>(defaultMiningConfig);
  const [manualKeywordFiles, setManualKeywordFiles] = useState<File[]>([]);
  const [candidateRows, setCandidateRows] = useState<MiningCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({});
  const [keywordRows, setKeywordRows] = useState<KeywordFileRow[]>([]);
  const [keywordOptions, setKeywordOptions] = useState<KeywordOptions>(defaultKeywordOptions);
  const [keywordForm, setKeywordForm] = useState<KeywordFileRow>(emptyKeywordRow);
  const [editingKeywordSlug, setEditingKeywordSlug] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [keywordOptionBusy, setKeywordOptionBusy] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<Record<string, boolean>>({});
  const [selectedDrafts, setSelectedDrafts] = useState<Record<string, boolean>>({});
  const [draftFilter, setDraftFilter] = useState<DraftFilter>("all");
  const [confirmPublish, setConfirmPublish] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [noPush, setNoPush] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftEditor, setDraftEditor] = useState<DraftEditorState | null>(null);
  const [logQuery, setLogQuery] = useState("");

  async function refresh() {
    const [statusRes, draftsRes, configRes, promptRes, miningRes, keywordRes, keywordOptionsRes] = await Promise.all([
      fetch("/api/local-brain/status", { cache: "no-store" }),
      fetch("/api/local-brain/drafts", { cache: "no-store" }),
      fetch("/api/local-brain/config", { cache: "no-store" }),
      fetch("/api/local-brain/prompt", { cache: "no-store" }),
      fetch("/api/local-brain/mining/config", { cache: "no-store" }),
      fetch("/api/local-brain/keywords", { cache: "no-store" }),
      fetch("/api/local-brain/keyword-options", { cache: "no-store" }),
    ]);
    if (!statusRes.ok || !draftsRes.ok || !configRes.ok || !promptRes.ok || !miningRes.ok || !keywordRes.ok || !keywordOptionsRes.ok) {
      throw new Error("Failed to load Local Brain state.");
    }
    const nextStatus = (await statusRes.json()) as WorkflowStatus;
    const nextDrafts = (await draftsRes.json()) as { drafts: DraftMeta[] };
    const nextConfig = (await configRes.json()) as AiConfigBundle;
    const nextPrompts = (await promptRes.json()) as { prompts?: PromptFile[] };
    const nextMining = (await miningRes.json()) as MiningConfig;
    const nextKeywords = (await keywordRes.json()) as { rows?: KeywordFileRow[] };
    const nextKeywordOptions = (await keywordOptionsRes.json()) as { options?: KeywordOptions };

    setStatus(nextStatus);
    setDrafts(nextDrafts.drafts || []);
    setConfig(nextConfig);
    setConfigForms(nextConfig);
    setPrompts(nextPrompts.prompts || []);
    setMiningConfig({ ...defaultMiningConfig, ...nextMining, apiKey: "", apiKeySet: nextMining.apiKeySet, apiKeyMasked: nextMining.apiKeyMasked });
    setKeywordRows(nextKeywords.rows || []);
    setKeywordOptions(nextKeywordOptions.options || defaultKeywordOptions);

    const preferredPrompt = (nextPrompts.prompts || []).find((item) => item.key === activePromptKeyRef.current) || nextPrompts.prompts?.[0];
    if (preferredPrompt && !promptDraftRef.current) {
      activePromptKeyRef.current = preferredPrompt.key;
      promptDraftRef.current = preferredPrompt.content;
      setActivePromptKey(preferredPrompt.key);
      setPromptDraft(preferredPrompt.content);
    }
    if (nextStatus.seeds?.length && seedText === defaultSeeds) {
      setSeedText(nextStatus.seeds.join("\n"));
    }
    if (!selectedPackageId && nextStatus.packages?.[0]?.id) {
      setSelectedPackageId(nextStatus.packages[0].id);
    }
  }

  useEffect(() => {
    refresh().catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Failed to load Local Brain."));
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/u, "");
    if (navItems.some((item) => item.id === hash)) setActiveNav(hash as NavId);
  }, []);

  useEffect(() => {
    activePromptKeyRef.current = activePromptKey;
  }, [activePromptKey]);

  useEffect(() => {
    promptDraftRef.current = promptDraft;
  }, [promptDraft]);

  useEffect(() => {
    if (slugTouched || !keywordForm.keyword.trim()) return;
    let disposed = false;
    const timer = window.setTimeout(() => {
      generateKeywordFormSlug(keywordForm.keyword)
        .then((slug) => {
          if (!disposed && slug) {
            setKeywordForm((current) => (current.keyword === keywordForm.keyword && !slugTouched ? { ...current, slug } : current));
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [keywordForm.keyword, slugTouched]);

  const packages = status?.packages || [];
  const audits = status?.audits || [];
  const auditsBySlug = useMemo(() => new Map(audits.map((audit) => [audit.slug, audit])), [audits]);
  const seedRows = useMemo(() => seedText.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean), [seedText]);
  const pendingDrafts = useMemo(() => drafts.filter((draft) => !draft.published), [drafts]);
  const selectedDraftRows = useMemo(() => drafts.filter((draft) => selectedDrafts[draft.slug]), [drafts, selectedDrafts]);
  const selectedDraftSlugs = selectedDraftRows.map((draft) => draft.slug);
  const visibleDrafts = useMemo(() => drafts.filter((draft) => matchesDraftFilter(draft, auditsBySlug.get(draft.slug), draftFilter)), [auditsBySlug, draftFilter, drafts]);
  const selectedKeywordRows = keywordRows.filter((row) => selectedKeywords[row.slug]);
  const pendingKeywordRows = keywordRows.filter((row) => !row.generated);
  const selectedCandidateRows = candidateRows.filter((row) => selectedCandidates[row.id]);
  const activePrompt = prompts.find((item) => item.key === activePromptKey) || prompts[0];
  const categoryOptions = useMemo(
    () => mergeKeywordOptions([...keywordOptions.category, ...keywordRows.flatMap((row) => splitMultiValue(row.category)), ...splitMultiValue(keywordForm.category)]),
    [keywordForm.category, keywordOptions.category, keywordRows],
  );
  const intentOptions = useMemo(
    () => mergeKeywordOptions([...keywordOptions.intent, ...keywordRows.flatMap((row) => splitMultiValue(row.intent)), ...splitMultiValue(keywordForm.intent)]),
    [keywordForm.intent, keywordOptions.intent, keywordRows],
  );
  const allDraftsSelected = drafts.length > 0 && drafts.every((draft) => selectedDrafts[draft.slug]);
  const allKeywordSelected = keywordRows.length > 0 && keywordRows.every((row) => selectedKeywords[row.slug]);
  const metrics = status?.metrics;
  const configuredModels = Object.values(config).filter((item) => item.api_key_set).length;
  const latestLog = status?.log?.[status.log.length - 1] || null;
  const readinessItems = useMemo(
    () => [
      { label: "模型 A：文章生成", ok: config.modelA.api_key_set, detail: config.modelA.api_key_set ? `${providerLabel(config.modelA.provider)} / ${config.modelA.model}` : "未配置 API Key" },
      { label: "模型 B：质检与重写", ok: config.modelB.api_key_set, detail: config.modelB.api_key_set ? `${providerLabel(config.modelB.provider)} / ${config.modelB.model}` : "未配置 API Key" },
      { label: "关键词文件", ok: keywordRows.length > 0 || seedRows.length > 0, detail: keywordRows.length > 0 ? `${keywordRows.length} 个结构化关键词` : `${seedRows.length} 个临时种子词` },
      { label: "草稿池", ok: drafts.length > 0, detail: drafts.length > 0 ? `${drafts.length} 篇草稿，${pendingDrafts.length} 篇未发布` : "暂无草稿" },
      { label: "发布闸门", ok: audits.some((item) => item.approved), detail: audits.some((item) => item.approved) ? `${audits.filter((item) => item.approved).length} 篇已审核` : "发布前需先完成 AI 质检与人工审核" },
    ],
    [audits, config, drafts.length, keywordRows.length, pendingDrafts.length, seedRows.length],
  );
  const approvedDraftCount = audits.filter((item) => item.approved).length;
  const reviewPassedCount = audits.filter((item) => item.reviewPassed).length;
  const operationScope = selectedDraftRows.length > 0 ? selectedDraftRows : drafts;
  const publishScope = selectedDraftRows.length > 0 ? selectedDraftRows : drafts.filter((draft) => auditsBySlug.get(draft.slug)?.approved);
  const operationWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!config.modelA.api_key_set) warnings.push("模型 A 未配置，不能生成文章。");
    if (!config.modelB.api_key_set) warnings.push("模型 B 未配置，不能执行 AI 质检。");
    if (drafts.length > 0 && selectedDraftRows.length === 0) warnings.push("未勾选草稿时，配图、质检、校验、审核会默认处理全部草稿。");
    if (publishScope.length === 0) warnings.push("当前没有已审核草稿可发布。");
    return warnings;
  }, [config.modelA.api_key_set, config.modelB.api_key_set, drafts.length, publishScope.length, selectedDraftRows.length]);
  const filteredLogs = useMemo(() => {
    const logs = status?.log || [];
    const query = logQuery.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((item) => `${item.step} ${item.message} ${item.time}`.toLowerCase().includes(query));
  }, [logQuery, status?.log]);
  const failedAuditCount = audits.filter((item) => !item.reviewPassed).length;

  const navBadges: Record<NavId, number> = {
    overview: metrics?.articleCount || drafts.length,
    models: configuredModels,
    prompts: prompts.length,
    "keyword-mining": candidateRows.length || seedRows.length,
    "seed-files": keywordRows.length,
    sitemap: 3,
    operations: drafts.length,
    logs: (status?.log?.length || 0) + audits.length,
  };

  function setNav(navId: NavId) {
    setActiveNav(navId);
    window.history.replaceState(null, "", `#${navId}`);
  }

  function noticeClear() {
    setError(null);
    setMessage(null);
  }

  async function runJson(path: string, options: RequestInit, fallback: string) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || fallback);
    return payload;
  }

  async function generateKeywordFormSlug(keyword: string) {
    const payload = (await runJson(
      "/api/local-brain/keywords/slug",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword }) },
      "slug 生成失败",
    )) as { slug?: string };
    return payload.slug || "";
  }

  async function runWorkflow(action: WorkflowAction, extra: Record<string, unknown>) {
    const actionLabels: Record<WorkflowAction, string> = {
      generate: "生成文章",
      images: "刷新配图",
      visuals: "刷新配图",
      review: "AI 质检",
      rewrite: "AI 重写",
      validate: "校验草稿",
      approve: "审核通过",
      publish: "发布网站",
    };
    setBusy(action);
    noticeClear();
    try {
      await runJson(
        "/api/local-brain/run",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) },
        `${actionLabels[action]}失败`,
      );
      setMessage(`${actionLabels[action]}已启动`);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `${actionLabels[action]}失败`);
    } finally {
      setBusy(null);
    }
  }

  async function saveConfig(role: AiRole) {
    const form = configForms[role];
    setBusy(`config:${role}`);
    noticeClear();
    try {
      await runJson(
        "/api/local-brain/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, provider: form.provider, base_url: form.base_url, model: form.model, api_key: apiKeys[role] }),
        },
        "Config save failed",
      );
      setApiKeys((current) => ({ ...current, [role]: "" }));
      setMessage(`${form.label} saved`);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Config save failed");
    } finally {
      setBusy(null);
    }
  }

  async function testConfig(role: AiRole) {
    const form = configForms[role];
    setBusy(`test:${role}`);
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/config/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, provider: form.provider, base_url: form.base_url, model: form.model, api_key: apiKeys[role] }),
        },
        "Model test failed",
      )) as AiTestResult;
      setTestResults((current) => ({ ...current, [role]: payload }));
      setMessage(payload.message || "Model test passed");
    } catch (nextError) {
      const text = nextError instanceof Error ? nextError.message : "Model test failed";
      setTestResults((current) => ({ ...current, [role]: { success: false, message: text } }));
      setError(text);
    } finally {
      setBusy(null);
    }
  }

  async function savePrompt() {
    if (!activePrompt) return;
    setBusy("prompt");
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/prompt",
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: activePrompt.key, content: promptDraft }) },
        "Prompt save failed",
      )) as { prompt?: PromptFile };
      if (payload.prompt) {
        setPrompts((current) => current.map((item) => (item.key === payload.prompt?.key ? payload.prompt : item)));
        promptDraftRef.current = payload.prompt.content;
        setPromptDraft(payload.prompt.content);
      }
      setMessage("Prompt saved");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Prompt save failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveMiningConfig() {
    setBusy("mining-config");
    noticeClear();
    try {
      await runJson(
        "/api/local-brain/mining/config",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(miningConfig) },
        "5118 config save failed",
      );
      setMessage("5118 config saved");
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "5118 config save failed");
    } finally {
      setBusy(null);
    }
  }

  async function runKeywordMining() {
    if (seedRows.length === 0) {
      setError("Enter at least one seed keyword.");
      return;
    }
    setBusy("mining");
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/mining/run",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seeds: seedRows }) },
        "Keyword mining failed",
      )) as { candidates?: MiningCandidate[] };
      const rows = payload.candidates || [];
      setCandidateRows(rows);
      setSelectedCandidates(Object.fromEntries(rows.map((row) => [row.id, false])));
      setMessage(`Mining completed: ${rows.length} candidates`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Keyword mining failed");
    } finally {
      setBusy(null);
    }
  }

  async function importKeywordFiles() {
    if (manualKeywordFiles.length === 0) {
      setError("Upload at least one exported keyword file.");
      return;
    }
    const form = new FormData();
    manualKeywordFiles.forEach((file) => form.append("files", file));
    setBusy("import-keywords");
    noticeClear();
    try {
      const payload = (await runJson("/api/local-brain/mining/import", { method: "POST", body: form }, "Keyword import failed")) as { candidates?: MiningCandidate[] };
      const rows = payload.candidates || [];
      setCandidateRows(rows);
      setSelectedCandidates(Object.fromEntries(rows.map((row) => [row.id, false])));
      setMessage(`Imported ${rows.length} candidates`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Keyword import failed");
    } finally {
      setBusy(null);
    }
  }

  async function addCandidatesToKeywordFile() {
    const rows = selectedCandidateRows.length > 0 ? selectedCandidateRows : candidateRows;
    if (rows.length === 0) {
      setError("No keyword candidates to add.");
      return;
    }
    setBusy("add-candidates");
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/keywords",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: rows.map((row) => ({
              keyword: row.keyword,
              slug: row.slug,
              locale: "zh",
              category: row.category,
              intent: row.intent,
              priority: row.priority,
              contentMode: "standard",
              source: row.source,
              searchVolume: row.searchVolume == null ? "" : String(row.searchVolume),
              competition: row.competition,
              difficulty: row.difficulty,
            })),
          }),
        },
        "Add candidates failed",
      )) as { rows?: KeywordFileRow[] };
      setKeywordRows(payload.rows || []);
      setMessage(`Added ${rows.length} keywords`);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Add candidates failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveKeywordRow() {
    if (!keywordForm.keyword.trim()) {
      setError("Keyword is required.");
      return;
    }
    setBusy("keyword-row");
    noticeClear();
    const isEditing = Boolean(editingKeywordSlug);
    try {
      const payload = (await runJson(
        "/api/local-brain/keywords",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEditing ? { ...keywordForm, originalSlug: editingKeywordSlug } : keywordForm),
        },
        isEditing ? "Keyword update failed" : "Keyword save failed",
      )) as { rows?: KeywordFileRow[] };
      setKeywordRows(payload.rows || []);
      setKeywordForm(emptyKeywordRow);
      setEditingKeywordSlug(null);
      setSlugTouched(false);
      setMessage(isEditing ? "Keyword updated" : "Keyword saved");
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : isEditing ? "Keyword update failed" : "Keyword save failed");
    } finally {
      setBusy(null);
    }
  }

  function editKeywordRow(row: KeywordFileRow) {
    setKeywordForm({
      keyword: row.keyword || "",
      slug: row.slug || "",
      locale: row.locale || "zh",
      category: row.category || "",
      intent: row.intent || "",
      priority: row.priority || "P1",
      contentMode: row.contentMode || "standard",
      source: row.source || "manual",
      searchVolume: row.searchVolume || "",
      competition: row.competition || "",
      difficulty: row.difficulty || "",
      articleStatus: row.articleStatus,
      articleStatusLabel: row.articleStatusLabel,
      articleUrl: row.articleUrl,
      generated: row.generated,
    });
    setEditingKeywordSlug(row.slug);
    setSlugTouched(true);
    setActiveNav("seed-files");
    setMessage(`已载入关键词：${row.keyword}`);
  }

  function cancelKeywordEdit() {
    setKeywordForm(emptyKeywordRow);
    setEditingKeywordSlug(null);
    setSlugTouched(false);
    setMessage("已取消关键词编辑");
  }

  async function addKeywordOption(type: KeywordOptionType, value: string) {
    const clean = value.trim();
    if (!clean) return;
    setKeywordOptionBusy(`add:${type}`);
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/keyword-options",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, value: clean }) },
        "添加选项失败",
      )) as { options?: KeywordOptions };
      setKeywordOptions(payload.options || defaultKeywordOptions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "添加选项失败");
    } finally {
      setKeywordOptionBusy(null);
    }
  }

  async function deleteKeywordOption(type: KeywordOptionType, value: string) {
    if (!window.confirm(`确认删除选项：${value}？已在关键词文件中使用的值仍会继续显示。`)) return;
    setKeywordOptionBusy(`delete:${type}:${value}`);
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/keyword-options",
        { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, value }) },
        "删除选项失败",
      )) as { options?: KeywordOptions };
      setKeywordOptions(payload.options || defaultKeywordOptions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "删除选项失败");
    } finally {
      setKeywordOptionBusy(null);
    }
  }

  async function deleteKeywordRow(slug: string) {
    setBusy(`delete:${slug}`);
    noticeClear();
    try {
      const payload = (await runJson(
        "/api/local-brain/keywords",
        { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) },
        "Keyword delete failed",
      )) as { rows?: KeywordFileRow[] };
      setKeywordRows(payload.rows || []);
      setSelectedKeywords((current) => ({ ...current, [slug]: false }));
      setMessage("Keyword deleted");
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Keyword delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveMaterialsPackage() {
    const form = new FormData();
    form.set("label", packageLabel.trim() || "Local Brain material package");
    form.set("mergeDefaults", String(mergeDefaults));
    knowledgeFiles.forEach((file) => form.append("knowledgeFiles", file));
    reviewFiles.forEach((file) => form.append("reviewFiles", file));
    evidenceFiles.forEach((file) => form.append("evidenceFiles", file));
    setBusy("materials");
    noticeClear();
    try {
      const payload = (await runJson("/api/local-brain/materials", { method: "POST", body: form }, "Package save failed")) as { package?: MaterialPackage };
      if (payload.package?.id) setSelectedPackageId(payload.package.id);
      setKnowledgeFiles([]);
      setReviewFiles([]);
      setEvidenceFiles([]);
      setMessage("Material package saved");
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Package save failed");
    } finally {
      setBusy(null);
    }
  }

  function selectedOrPendingDraftSlugs() {
    return selectedDraftRows.length > 0 ? selectedDraftRows.map((item) => item.slug) : drafts.map((item) => item.slug);
  }

  function selectedOrApprovedDraftSlugs() {
    if (selectedDraftRows.length > 0) {
      return selectedDraftRows.map((item) => item.slug);
    }
    return drafts.filter((draft) => auditsBySlug.get(draft.slug)?.approved).map((draft) => draft.slug);
  }

  async function handleGenerate() {
    const selectedRows =
      selectedKeywordRows.length > 0
        ? selectedKeywordRows
        : seedRows.map((seed) => ({ ...emptyKeywordRow, keyword: seed, slug: "", source: "manual", contentMode: "standard" }));
    const selectedSeeds = selectedRows.map((row) => row.keyword);
    if (selectedSeeds.length === 0) {
      setError("Select or enter at least one keyword.");
      return;
    }
    await runWorkflow("generate", {
      seeds: selectedSeeds,
      keywordRows: selectedRows,
      notes,
      overwrite,
      packageId: selectedPackageId || null,
      sourceMode: selectedPackageId ? "manual" : "api",
    });
  }

  async function handleReview() {
    const selected = selectedOrPendingDraftSlugs();
    if (selected.length === 0) {
      setError("No drafts available for AI review.");
      return;
    }
    await runWorkflow("review", { selectedDrafts: selected });
  }

  async function handleRefreshImages() {
    const selected = selectedOrPendingDraftSlugs();
    if (selected.length === 0) {
      setError("没有可刷新配图的草稿。");
      return;
    }
    await runWorkflow("images", { selectedDrafts: selected });
  }

  async function handleRewrite() {
    if (selectedDraftSlugs.length === 0) {
      setError("Select at least one draft for AI rewrite.");
      return;
    }
    await runWorkflow("rewrite", { selectedDrafts: selectedDraftSlugs, notes, packageId: selectedPackageId || null });
  }

  async function handleValidate() {
    const selected = selectedOrPendingDraftSlugs();
    if (selected.length === 0) {
      setError("No drafts available for validation.");
      return;
    }
    await runWorkflow("validate", { selectedDrafts: selected });
  }

  async function handleApprove() {
    const selected = selectedOrPendingDraftSlugs();
    if (selected.length === 0) {
      setError("No drafts available for approval.");
      return;
    }
    const blocked = selected.filter((slug) => !auditsBySlug.get(slug)?.reviewPassed);
    if (blocked.length > 0) {
      setError(`AI review must pass before approval: ${blocked.slice(0, 5).join(", ")}`);
      return;
    }
    await runWorkflow("approve", { selectedDrafts: selected });
  }

  async function handlePublish() {
    if (confirmPublish.trim() !== "PUBLISH") {
      setError("发布前请先输入 PUBLISH。");
      return;
    }
    const selected = selectedOrApprovedDraftSlugs();
    if (selected.length === 0) {
      setError("没有可发布草稿。请勾选草稿，或先完成 AI 质检与审核通过。");
      return;
    }
    const blocked = selected.filter((slug) => !auditsBySlug.get(slug)?.approved);
    if (blocked.length > 0) {
      setError(`以下草稿尚未审核通过，不能发布：${blocked.slice(0, 5).join(", ")}`);
      return;
    }
    await runWorkflow("publish", {
      selectedDrafts: selected,
      noPush,
      commitMessage: commitMessage.trim() || `Publish qqbytran insights ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    });
  }

  function draftSeed(draft: DraftMeta) {
    return (draft.zhTitle || draft.title || draft.slug).trim();
  }

  async function handleGenerateDraft(draft: DraftMeta) {
    await runWorkflow("generate", {
      seeds: [draftSeed(draft)],
      keywordRows: [
        {
          keyword: draftSeed(draft),
          slug: draft.slug,
          locale: "zh",
          category: draft.category,
          intent: "refresh",
          priority: "P1",
          contentMode: draft.contentMode || "standard",
          source: "draft",
          searchVolume: "",
          competition: "",
          difficulty: "",
        },
      ],
      notes,
      overwrite: true,
      packageId: selectedPackageId || null,
      sourceMode: selectedPackageId ? "manual" : "api",
    });
  }

  async function handleRefreshImagesDraft(draft: DraftMeta) {
    await runWorkflow("images", { selectedDrafts: [draft.slug] });
  }

  async function handleReviewDraft(draft: DraftMeta) {
    if (!config.modelB.api_key_set) {
      setError("请先配置模型 B，再执行 AI 质检。");
      return;
    }
    await runWorkflow("review", { selectedDrafts: [draft.slug] });
  }

  async function handleRewriteDraft(draft: DraftMeta) {
    await runWorkflow("rewrite", { selectedDrafts: [draft.slug], notes, packageId: selectedPackageId || null });
  }

  async function handleValidateDraft(draft: DraftMeta) {
    await runWorkflow("validate", { selectedDrafts: [draft.slug] });
  }

  async function handleApproveDraft(draft: DraftMeta) {
    const audit = auditsBySlug.get(draft.slug);
    if (!audit?.reviewPassed) {
      setError(`AI 质检通过后才能审核：${draft.slug}`);
      return;
    }
    await runWorkflow("approve", { selectedDrafts: [draft.slug] });
  }

  async function handlePublishDraft(draft: DraftMeta) {
    if (confirmPublish.trim() !== "PUBLISH") {
      setError("发布前请先在右侧发布设置中输入 PUBLISH。");
      return;
    }
    const audit = auditsBySlug.get(draft.slug);
    if (!audit?.approved) {
      setError(`人工审核通过后才能发布：${draft.slug}`);
      return;
    }
    await runWorkflow("publish", {
      selectedDrafts: [draft.slug],
      noPush,
      commitMessage: commitMessage.trim() || `Publish qqbytran insight ${draft.slug}`,
    });
  }

  async function handleViewDraft(draft: DraftMeta) {
    setBusy(`draft:${draft.slug}`);
    noticeClear();
    try {
      const payload = (await runJson(`/api/local-brain/drafts/${draft.slug}`, { method: "GET" }, "草稿读取失败")) as {
        draft?: unknown;
        filePath?: string;
      };
      setDraftEditor({
        slug: draft.slug,
        filePath: payload.filePath || draft.filePath,
        content: JSON.stringify(payload.draft || {}, null, 2),
        published: draft.published,
        expectedUrl: draft.expectedUrl,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "草稿读取失败");
    } finally {
      setBusy(null);
    }
  }

  async function saveDraftEditor() {
    if (!draftEditor) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(draftEditor.content);
    } catch {
      setError("草稿 JSON 格式不正确，请修正后再保存。");
      return;
    }

    setBusy("draft-editor");
    noticeClear();
    try {
      await runJson(
        `/api/local-brain/drafts/${draftEditor.slug}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: parsed }),
        },
        "草稿保存失败",
      );
      setMessage(`草稿已保存：${draftEditor.slug}`);
      setDraftEditor(null);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "草稿保存失败");
    } finally {
      setBusy(null);
    }
  }

  function handleFactSource(draft: DraftMeta) {
    const source = selectedPackageId ? packages.find((item) => item.id === selectedPackageId)?.label || selectedPackageId : "默认知识库";
    setMessage(`事实源资料包：${source}。当前文章：${draft.slug}`);
  }

  function handleReviewReport(draft: DraftMeta) {
    const audit = auditsBySlug.get(draft.slug);
    if (!audit) {
      setError(`暂无质检报告：${draft.slug}`);
      return;
    }
    setMessage(`质检报告：${audit.filePath}`);
  }

  function updateConfig(role: AiRole, patch: Partial<AiConfig>) {
    setConfigForms((current) => ({ ...current, [role]: { ...current[role], ...patch } }));
  }

  function changeProvider(role: AiRole, provider: string) {
    const defaults = providerDefaults[provider] || providerDefaults.openai;
    updateConfig(role, { provider, base_url: defaults.baseUrl, model: defaults.model });
  }

  function toggleAllDrafts() {
    setSelectedDrafts((current) => {
      const next = { ...current };
      for (const draft of drafts) next[draft.slug] = !allDraftsSelected;
      return next;
    });
  }

  function toggleAllKeywords() {
    setSelectedKeywords((current) => {
      const next = { ...current };
      for (const row of keywordRows) next[row.slug] = !allKeywordSelected;
      return next;
    });
  }

  const panelMap: Record<NavId, ReactNode> = {
    overview: (
      <Panel title="运行概览" description="合规文章生产线的本地控制中心。">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="关键词" value={metrics?.keywords || keywordRows.length} tone="white" />
          <Metric label="草稿" value={metrics?.drafts || drafts.length} tone="amber" />
          <Metric label="AI 质检" value={metrics?.aiReview || audits.length} tone="cyan" />
          <Metric label="已审核" value={audits.filter((item) => item.approved).length} tone="green" />
          <Metric label="已发布" value={metrics?.published || 0} tone="violet" />
          <Metric label="日志" value={metrics?.logCount || status?.log?.length || 0} tone="white" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InfoTile label="目标站点" value={status?.siteUrl || "https://www.qqbytran.com/insights"} />
          <InfoTile label="当前步骤" value={status?.currentStep || "空闲"} />
          <InfoTile label="运行锁" value={status?.lock ? `${status.lock.step} / PID ${status.lock.pid || "-"}` : "无"} />
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[8px] border border-slate-700 bg-slate-900/45 p-5">
            <h3 className="text-lg font-semibold text-white">生产线就绪检查</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {readinessItems.map((item) => (
                <ReadinessItem key={item.label} {...item} />
              ))}
            </div>
          </div>
          <div className="rounded-[8px] border border-slate-700 bg-slate-900/45 p-5">
            <h3 className="text-lg font-semibold text-white">最近事件</h3>
            {latestLog ? (
              <div className="mt-4 rounded-[8px] bg-slate-950 p-4">
                <p className="text-xs text-slate-500">{formatDate(latestLog.time)}</p>
                <p className="mt-2 font-semibold text-white">{latestLog.step}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{latestLog.message}</p>
              </div>
            ) : (
              <Empty text="暂无运行事件。" />
            )}
          </div>
        </div>
      </Panel>
    ),
    models: (
      <Panel title="AI 模型配置" description="模型 A 负责生成，模型 B 负责质检与重写，模型 C 负责关键词挖掘和检索辅助。">
        <div className="space-y-5">
          {(["modelA", "modelB", "modelC"] as AiRole[]).map((role) => {
            const form = configForms[role];
            const result = testResults[role];
            return (
              <div key={role} className="rounded-[8px] border border-slate-700 bg-slate-900/55 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{form.label}</h3>
                    <p className="mt-1 text-sm text-slate-400">{form.purpose}</p>
                    <p className="mt-1 text-xs text-slate-500">{form.api_key_set ? `已保存密钥：${form.api_key_masked}` : "未保存 API Key"}</p>
                  </div>
                  <StatusPill tone={form.api_key_set ? "green" : "slate"}>{form.api_key_set ? "已配置" : "缺少密钥"}</StatusPill>
                </div>
                <div className="mt-5 grid gap-3 xl:grid-cols-[0.8fr_1.3fr_1fr_1fr_auto_auto]">
                  <Field label="提供商">
                    <select className={inputClass} value={form.provider} onChange={(event) => changeProvider(role, event.target.value)}>
                      {Object.entries(providerDefaults).map(([value, item]) => (
                        <option key={value} value={value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="API Base URL">
                    <input className={inputClass} value={form.base_url} onChange={(event) => updateConfig(role, { base_url: event.target.value })} />
                  </Field>
                  <Field label="模型">
                    <input className={inputClass} value={form.model} onChange={(event) => updateConfig(role, { model: event.target.value })} />
                  </Field>
                  <Field label="API Key">
                    <input className={inputClass} value={apiKeys[role]} onChange={(event) => setApiKeys((current) => ({ ...current, [role]: event.target.value }))} placeholder={form.api_key_set ? "留空则保留已保存密钥" : "必填"} />
                  </Field>
                  <ActionButton busy={busy === `config:${role}`} label="保存" busyLabel="保存中..." onClick={() => void saveConfig(role)} />
                  <GhostButton disabled={busy === `test:${role}`} label={busy === `test:${role}` ? "测试中..." : "测试"} onClick={() => void testConfig(role)} />
                </div>
                {result ? <p className={`mt-3 text-sm ${result.success ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p> : null}
              </div>
            );
          })}
        </div>
      </Panel>
    ),
    prompts: (
      <Panel title="Prompt 提示词" description="编辑本地生产线使用的生成、质检和重写提示词。">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <button
                key={prompt.key}
                type="button"
                onClick={() => {
                  activePromptKeyRef.current = prompt.key;
                  promptDraftRef.current = prompt.content;
                  setActivePromptKey(prompt.key);
                  setPromptDraft(prompt.content);
                }}
                className={`w-full rounded-[8px] border px-4 py-3 text-left ${activePromptKey === prompt.key ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-900 text-slate-300"}`}
              >
                <p className="font-semibold">{prompt.label}</p>
                <p className="mt-1 text-xs opacity-80">{prompt.fileName}</p>
              </button>
            ))}
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{activePrompt?.label || "Prompt"}</h3>
                <p className="mt-1 text-sm text-slate-400">{activePrompt?.description}</p>
              </div>
              <ActionButton busy={busy === "prompt"} label="保存提示词" busyLabel="保存中..." onClick={() => void savePrompt()} />
            </div>
            <textarea className={`${inputClass} mt-4 min-h-[560px] font-mono text-xs`} value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
          </div>
        </div>
      </Panel>
    ),
    "keyword-mining": (
      <Panel title="关键词挖掘工具" description="支持 5118 API 自动挖掘，也支持导入 5118 导出的文件，再加入结构化关键词文件。">
        <div className="flex flex-wrap gap-3">
          <ModeButton active={miningTab === "api"} onClick={() => setMiningTab("api")}>API 自动挖掘</ModeButton>
          <ModeButton active={miningTab === "manual"} onClick={() => setMiningTab("manual")}>5118 手动导入</ModeButton>
        </div>
        {miningTab === "api" ? (
          <div className="mt-6 rounded-[8px] border border-slate-700 bg-slate-900/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">5118 全链路配置</h3>
                <p className="mt-1 text-sm text-slate-400">API Key 只保存在本地配置里。部分指标补全任务可能需要等待。</p>
              </div>
              <ActionButton busy={busy === "mining-config"} label="保存 5118 配置" busyLabel="保存中..." onClick={() => void saveMiningConfig()} />
            </div>
            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              <input className={inputClass} value={miningConfig.suggestUrl} onChange={(event) => setMiningConfig((current) => ({ ...current, suggestUrl: event.target.value }))} />
              <input className={inputClass} value={miningConfig.keywordUrl} onChange={(event) => setMiningConfig((current) => ({ ...current, keywordUrl: event.target.value }))} />
              <input className={inputClass} value={miningConfig.keywordParamUrl} onChange={(event) => setMiningConfig((current) => ({ ...current, keywordParamUrl: event.target.value }))} />
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
              <input className={inputClass} value={miningConfig.apiKey} onChange={(event) => setMiningConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder={miningConfig.apiKeySet ? `Saved: ${miningConfig.apiKeyMasked}` : "5118 API Key"} />
              <select className={inputClass} value={miningConfig.metricMode} onChange={(event) => setMiningConfig((current) => ({ ...current, metricMode: event.target.value === "suggest-only" ? "suggest-only" : "full" }))}>
                <option value="full">全流程补指标</option>
                <option value="suggest-only">只拉取下拉词</option>
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["baidu", "baidumobile", "xiaohongshu", "douyin"] as MiningPlatform[]).map((platform) => (
                <label key={platform} className="rounded-[8px] border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200">
                  <input
                    className="mr-2 accent-blue-500"
                    type="checkbox"
                    checked={miningConfig.platforms.includes(platform)}
                    onChange={(event) =>
                      setMiningConfig((current) => ({
                        ...current,
                        platforms: event.target.checked ? Array.from(new Set([...current.platforms, platform])) : current.platforms.filter((item) => item !== platform),
                      }))
                    }
                  />
                  {platform}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-6">
              <NumberField label="每平台下拉词" value={miningConfig.perPlatformLimit} onChange={(value) => setMiningConfig((current) => ({ ...current, perPlatformLimit: value }))} />
              <NumberField label="扩展 TopN" value={miningConfig.expandTopN} onChange={(value) => setMiningConfig((current) => ({ ...current, expandTopN: value }))} />
              <NumberField label="分页数量" value={miningConfig.pageSize} onChange={(value) => setMiningConfig((current) => ({ ...current, pageSize: value }))} />
              <NumberField label="补指标批量" value={miningConfig.metricBatchSize} onChange={(value) => setMiningConfig((current) => ({ ...current, metricBatchSize: value }))} />
              <NumberField label="等待秒数" value={miningConfig.waitSeconds} onChange={(value) => setMiningConfig((current) => ({ ...current, waitSeconds: value }))} />
              <NumberField label="输出数量" value={miningConfig.outputCount} onChange={(value) => setMiningConfig((current) => ({ ...current, outputCount: value }))} />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[8px] border border-slate-700 bg-slate-900/50 p-5">
            <UploadInput title="5118 导出文件" files={manualKeywordFiles} onChange={setManualKeywordFiles} />
            <div className="mt-4">
              <ActionButton busy={busy === "import-keywords"} label="导入文件" busyLabel="导入中..." onClick={() => void importKeywordFiles()} />
            </div>
          </div>
        )}
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="种子词">
            <textarea className={`${inputClass} min-h-[160px]`} value={seedText} onChange={(event) => setSeedText(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <ActionButton busy={busy === "mining"} label="开始挖掘" busyLabel="挖掘中..." onClick={() => void runKeywordMining()} />
          </div>
        </div>
        <CandidateTable rows={candidateRows} selected={selectedCandidates} onToggle={(id, checked) => setSelectedCandidates((current) => ({ ...current, [id]: checked }))} />
        <div className="mt-5 flex justify-end">
          <ActionButton busy={busy === "add-candidates"} label="加入关键词文件" busyLabel="加入中..." onClick={() => void addCandidatesToKeywordFile()} />
        </div>
      </Panel>
    ),
    "seed-files": (
      <Panel title="关键词文件" description="结构化关键词资产。可在这里选择关键词，再到流程操作中生成文章。">
        <div className="grid gap-3 xl:grid-cols-[1.15fr_1.15fr_0.45fr_1.3fr_1.3fr_0.45fr_0.75fr_auto_auto]">
          <TextInput label="关键词" value={keywordForm.keyword} onChange={(keyword) => setKeywordForm((current) => ({ ...current, keyword }))} />
          <TextInput
            label={slugTouched ? "slug（手动）" : "slug（自动）"}
            value={keywordForm.slug}
            placeholder="自动生成"
            onChange={(slug) => {
              setSlugTouched(true);
              setKeywordForm((current) => ({ ...current, slug }));
            }}
          />
          <SelectInput label="语言" value={keywordForm.locale} options={["zh", "en", "ja"]} onChange={(locale) => setKeywordForm((current) => ({ ...current, locale }))} />
          <MultiSelectInput
            label="分类"
            value={keywordForm.category}
            options={categoryOptions}
            type="category"
            optionBusy={keywordOptionBusy}
            onChange={(category) => setKeywordForm((current) => ({ ...current, category }))}
            onAddOption={(type, value) => void addKeywordOption(type, value)}
            onDeleteOption={(type, value) => void deleteKeywordOption(type, value)}
          />
          <MultiSelectInput
            label="意图"
            value={keywordForm.intent}
            options={intentOptions}
            type="intent"
            optionBusy={keywordOptionBusy}
            onChange={(intent) => setKeywordForm((current) => ({ ...current, intent }))}
            onAddOption={(type, value) => void addKeywordOption(type, value)}
            onDeleteOption={(type, value) => void deleteKeywordOption(type, value)}
          />
          <SelectInput label="优先级" value={keywordForm.priority} options={["P0", "P1", "P2", "P3"]} onChange={(priority) => setKeywordForm((current) => ({ ...current, priority }))} />
          <SelectInput label="内容模式" value={keywordForm.contentMode} options={["standard", "fact-source"]} onChange={(contentMode) => setKeywordForm((current) => ({ ...current, contentMode }))} />
          <button
            type="button"
            onClick={() => {
              setSlugTouched(false);
              setKeywordForm((current) => ({ ...current, slug: "" }));
            }}
            className="self-end rounded-[8px] border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-400 disabled:text-slate-600"
          >
            重新自动
          </button>
          <div className="flex items-end gap-2">
            {editingKeywordSlug ? <GhostButton label="取消编辑" onClick={cancelKeywordEdit} /> : null}
            <ActionButton busy={busy === "keyword-row"} label={editingKeywordSlug ? "保存修改" : "新增"} busyLabel="保存中..." onClick={() => void saveKeywordRow()} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">总行数：{keywordRows.length}。已选择：{selectedKeywordRows.length}。</p>
          <div className="flex gap-3">
            <GhostButton label={allKeywordSelected ? "取消全选" : "全选"} onClick={toggleAllKeywords} />
            <ActionButton busy={busy === "generate"} label="生成所选关键词文章" busyLabel="启动中..." onClick={() => void handleGenerate()} disabled={selectedKeywordRows.length === 0 || status?.isRunning || !config.modelA.api_key_set} />
          </div>
        </div>
        <KeywordTable rows={keywordRows} selected={selectedKeywords} onToggle={(slug, checked) => setSelectedKeywords((current) => ({ ...current, [slug]: checked }))} onDelete={deleteKeywordRow} onEdit={editKeywordRow} />
      </Panel>
    ),
    sitemap: (
      <Panel title="站点地图" description="发布仍然先写入本地内容库，线上更新以 Git 推送和 Vercel 部署为边界。">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoTile label="情报库入口" value={status?.siteUrl || "https://www.qqbytran.com/insights"} />
          <InfoTile label="Sitemap" value="https://www.qqbytran.com/sitemap.xml" />
          <InfoTile label="Robots" value="https://www.qqbytran.com/robots.txt" />
        </div>
      </Panel>
    ),
    operations: (
      <Panel title="流程操作" description="按照 SEO 文章生产线的显性流程执行：生成文章、刷新配图、AI 质检、AI 重写、校验草稿、人工审核、发布网站。">
        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[8px] border border-slate-700 bg-slate-950/45 p-4">
            <h3 className="text-base font-semibold text-white">当前操作范围</h3>
            <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
              <p>草稿池：{drafts.length} 篇</p>
              <p>已选择：{selectedDraftRows.length} 篇</p>
              <p>质检通过：{reviewPassedCount} 篇</p>
              <p>可发布：{publishScope.length} 篇</p>
            </div>
            <p className="mt-3 break-all text-sm leading-6 text-slate-400">
              {selectedDraftRows.length > 0 ? `将优先处理已选择草稿：${selectedDraftRows.map((item) => item.slug).slice(0, 5).join("、")}${selectedDraftRows.length > 5 ? " 等" : ""}` : "未选择草稿。除“发布网站”外，多数批量操作会默认处理草稿池中的全部草稿。"}
            </p>
          </div>
          <div className="rounded-[8px] border border-slate-700 bg-slate-950/45 p-4">
            <h3 className="text-base font-semibold text-white">操作提示</h3>
            <div className="mt-3 space-y-2">
              {operationWarnings.length === 0 ? (
                <p className="text-sm text-emerald-200">当前配置满足基本运行条件。</p>
              ) : (
                operationWarnings.map((item) => (
                  <p key={item} className="text-sm leading-6 text-amber-100">
                    {item}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FlowButton title="生成文章" hint="从已选关键词或种子词生成新草稿" busy={busy === "generate"} disabled={status?.isRunning || !config.modelA.api_key_set} onClick={() => void handleGenerate()} />
          <FlowButton title="刷新配图" hint={`${operationScope.length} 篇草稿`} busy={busy === "images"} disabled={status?.isRunning || drafts.length === 0} onClick={() => void handleRefreshImages()} />
          <FlowButton title="AI 质检" hint={`${operationScope.length} 篇草稿`} busy={busy === "review"} disabled={status?.isRunning || drafts.length === 0 || !config.modelB.api_key_set} onClick={() => void handleReview()} />
          <FlowButton title="AI 重写" hint="仅处理已勾选草稿" busy={busy === "rewrite"} disabled={status?.isRunning || selectedDraftSlugs.length === 0} onClick={() => void handleRewrite()} />
          <FlowButton title="校验草稿" hint={`${operationScope.length} 篇草稿`} busy={busy === "validate"} disabled={status?.isRunning || drafts.length === 0} onClick={() => void handleValidate()} />
          <FlowButton title="审核通过" hint="要求 AI 质检通过" busy={busy === "approve"} disabled={status?.isRunning || drafts.length === 0} onClick={() => void handleApprove()} />
          <FlowButton title="发布网站" hint={`${publishScope.length} 篇可发布`} busy={busy === "publish"} disabled={status?.isRunning || publishScope.length === 0 || confirmPublish.trim() !== "PUBLISH"} onClick={() => void handlePublish()} />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">草稿池</h3>
                <p className="mt-1 text-sm text-slate-400">选择草稿后可执行重写、配图、校验、审核和发布。未选择时默认处理全部草稿，包含已发布文章的修订与再次发布。</p>
              </div>
              <GhostButton label={allDraftsSelected ? "取消选择" : "选择全部草稿"} onClick={toggleAllDrafts} />
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-700 bg-slate-950/45 p-3">
              <div className="flex flex-wrap gap-2">
                {draftFilters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${draftFilter === item.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    onClick={() => setDraftFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-400">当前显示：{visibleDrafts.length} 篇；已选择：{selectedDraftRows.length} 篇</p>
            </div>
            <div className="space-y-3">
              {visibleDrafts.length === 0 ? (
                <Empty text="暂无草稿。" />
              ) : (
                visibleDrafts.map((draft) => (
                  <DraftCard
                    key={draft.slug}
                    audit={auditsBySlug.get(draft.slug)}
                    busy={busy}
                    checked={Boolean(selectedDrafts[draft.slug])}
                    disabled={Boolean(status?.isRunning)}
                    draft={draft}
                    onApprove={() => void handleApproveDraft(draft)}
                    onFactSource={() => handleFactSource(draft)}
                    onGenerate={() => void handleGenerateDraft(draft)}
                    onRefreshImages={() => void handleRefreshImagesDraft(draft)}
                    onReview={() => void handleReviewDraft(draft)}
                    onReviewReport={() => handleReviewReport(draft)}
                    onRewrite={() => void handleRewriteDraft(draft)}
                    onPublish={() => void handlePublishDraft(draft)}
                    onToggle={(checked) => setSelectedDrafts((current) => ({ ...current, [draft.slug]: checked }))}
                    onValidate={() => void handleValidateDraft(draft)}
                    onView={() => void handleViewDraft(draft)}
                  />
                ))
              )}
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-[8px] border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold text-white">发布设置</h3>
              <Field className="mt-4" label="提交说明"><input className={inputClass} value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="发布 qqbytran 情报库文章" /></Field>
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input className="accent-blue-500" type="checkbox" checked={noPush} onChange={(event) => setNoPush(event.target.checked)} /> 只提交本地，不推送远端</label>
              <Field className="mt-4" label="发布确认"><input className={inputClass} value={confirmPublish} onChange={(event) => setConfirmPublish(event.target.value)} placeholder="输入 PUBLISH" /></Field>
              <div className="mt-4 rounded-[8px] bg-slate-950 p-4 text-sm text-slate-300">
                <p>目标站点：{status?.siteUrl || "https://www.qqbytran.com/insights"}</p>
                <p className="mt-2">已选草稿：{selectedDraftRows.length}</p>
                <p className="mt-2">全部草稿：{drafts.length}</p>
                <p className="mt-2">未发布草稿：{pendingDrafts.length}</p>
                <p className="mt-2">已审核草稿：{approvedDraftCount}</p>
                <p className="mt-2">本次可发布：{publishScope.length}</p>
              </div>
              <div className="mt-4 rounded-[8px] border border-amber-500/25 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
                发布只处理“已审核通过”的草稿。若文章已发布，仍可查看编辑、重新生成修订稿、刷新配图、再次校验并重新发布。
              </div>
            </div>
            <div className="rounded-[8px] border border-slate-700 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold text-white">Local Brain 材料包</h3>
              <Field className="mt-4" label="材料包"><select className={inputClass} value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)}><option value="">默认知识库</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
              <Field className="mt-4" label="运行备注"><textarea className={`${inputClass} min-h-[120px]`} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
              <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input className="accent-blue-500" type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} /> 允许覆盖同名草稿</label>
            </div>
          </div>
        </div>
      </Panel>
    ),
    logs: (
      <Panel title="最近日志" description="脚本运行事件与审计元数据。">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <InfoTile label="日志事件" value={String(status?.log?.length || 0)} />
          <InfoTile label="筛选结果" value={String(filteredLogs.length)} />
          <InfoTile label="审计记录" value={String(audits.length)} />
          <InfoTile label="阻断记录" value={String(failedAuditCount)} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[8px] bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">运行日志</h3>
              <input
                className="w-full rounded-[8px] border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400 md:w-72"
                value={logQuery}
                onChange={(event) => setLogQuery(event.target.value)}
                placeholder="搜索步骤、报错、slug"
              />
            </div>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-auto">
              {filteredLogs.length === 0 ? <Empty text="没有匹配的日志。" /> : filteredLogs.slice(-60).reverse().map((item, index) => <LogItem key={`${item.time}-${index}`} item={item} />)}
            </div>
          </div>
          <div className="rounded-[8px] bg-slate-900/60 p-5">
            <h3 className="text-lg font-semibold text-white">审计轨迹</h3>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-auto">
              {audits.map((audit) => <AuditCard key={audit.fileName} audit={audit} />)}
            </div>
          </div>
        </div>
      </Panel>
    ),
  };

  return (
    <main className="min-h-screen bg-[#05081a] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[1640px]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-400">LOCAL BRAIN</p>
            <h1 className="mt-3 text-4xl font-semibold text-white md:text-5xl">合规文章生产线控制台</h1>
            <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300">沿用 SEO 文章自动生产线的布局与控制逻辑，并加入合规知识库、AI 质检、人工审核、刷新配图和发布到 qqbytran.com 情报库的能力。</p>
          </div>
          <StatusPill tone={status?.isRunning ? "green" : "slate"}>{status?.isRunning ? "运行中" : "空闲"}</StatusPill>
        </div>

        <RunBanner status={status} latestLog={latestLog} />

        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}

        <div className="mt-8 grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[8px] border border-slate-700 bg-slate-800/55 p-3">
            {navItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setNav(item.id)} className={`mb-2 block w-full rounded-[8px] px-4 py-4 text-left transition ${activeNav === item.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{item.title}</span>
                  <span className="rounded-full bg-slate-950/60 px-2 py-1 text-xs">{navBadges[item.id]}</span>
                </span>
                <span className="mt-1 block text-sm opacity-80">{item.subtitle}</span>
              </button>
            ))}
          </aside>
          <div>{panelMap[activeNav]}</div>
        </div>
      </div>
      {draftEditor ? (
        <div className="fixed inset-0 z-50 bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-[8px] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">LOCAL DRAFT</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">查看 / 编辑草稿</h2>
                <p className="mt-2 break-all text-sm text-slate-400">{draftEditor.slug}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{draftEditor.filePath}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {draftEditor.published ? <GhostButton label="打开线上页面" onClick={() => window.open(draftEditor.expectedUrl, "_blank", "noopener,noreferrer")} /> : null}
                <GhostButton disabled={busy === "draft-editor"} label="关闭" onClick={() => setDraftEditor(null)} />
                <ActionButton busy={busy === "draft-editor"} label="保存草稿" busyLabel="保存中..." onClick={() => void saveDraftEditor()} />
              </div>
            </div>
            <textarea
              className={`${inputClass} mt-5 min-h-0 flex-1 resize-none font-mono text-xs leading-6`}
              value={draftEditor.content}
              onChange={(event) => setDraftEditor((current) => (current ? { ...current, content: event.target.value } : current))}
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

const inputClass = "w-full rounded-[8px] border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400";

function Panel({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <section className="rounded-[8px] border border-slate-700 bg-slate-800/55 p-6">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function TextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input className={inputClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelectInput({
  label,
  onAddOption,
  onChange,
  onDeleteOption,
  optionBusy,
  options,
  type,
  value,
}: {
  label: string;
  onAddOption: (type: KeywordOptionType, value: string) => void;
  onChange: (value: string) => void;
  onDeleteOption: (type: KeywordOptionType, value: string) => void;
  optionBusy: string | null;
  options: string[];
  type: KeywordOptionType;
  value: string;
}) {
  const [newOption, setNewOption] = useState("");
  const selected = splitMultiValue(value);

  function toggleOption(option: string) {
    const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    onChange(next.join("、"));
  }

  function addOption() {
    const clean = newOption.trim();
    if (!clean) return;
    onAddOption(type, clean);
    if (!selected.includes(clean)) onChange([...selected, clean].join("、"));
    setNewOption("");
  }

  return (
    <div className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <div className="rounded-[8px] border border-slate-700 bg-slate-950 p-3">
        <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-[6px] px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-800">
              <input className="h-4 w-4 accent-blue-500" type="checkbox" checked={selected.includes(option)} onChange={() => toggleOption(option)} />
              <span className="min-w-0 flex-1 truncate">{option}</span>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:text-slate-700"
                disabled={optionBusy === `delete:${type}:${option}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteOption(type, option);
                }}
              >
                删除
              </button>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
          <input
            className="min-w-0 flex-1 rounded-[6px] border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-400"
            value={newOption}
            placeholder={`新增${label}`}
            onChange={(event) => setNewOption(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOption();
              }
            }}
          />
          <button
            type="button"
            className="rounded-[6px] bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500"
            disabled={!newOption.trim() || optionBusy === `add:${type}`}
            onClick={addOption}
          >
            添加
          </button>
        </div>
        <p className="mt-2 truncate text-xs text-slate-500">{selected.length > 0 ? selected.join("、") : `未选择${label}`}</p>
      </div>
    </div>
  );
}

function Field({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({ busy, busyLabel, disabled, label, onClick }: { busy: boolean; busyLabel: string; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className="rounded-[8px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700">
      {busy ? busyLabel : label}
    </button>
  );
}

function GhostButton({ disabled, label, onClick }: { disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-[8px] border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500">
      {label}
    </button>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[8px] border px-5 py-2 text-sm font-semibold ${active ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-950 text-slate-200"}`}>
      {children}
    </button>
  );
}

function FlowButton({ busy, disabled, hint, onClick, title }: { busy?: boolean; disabled?: boolean; hint?: string; onClick: () => void; title: string }) {
  return (
    <button type="button" title={hint || title} onClick={onClick} disabled={busy || disabled} className="min-h-[86px] rounded-[8px] bg-blue-600 px-5 py-4 text-center text-lg font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700">
      <span className="block">{busy ? "执行中..." : title}</span>
      {hint ? <span className="mt-2 block text-xs font-normal text-blue-100/80">{hint}</span> : null}
    </button>
  );
}

function Metric({ label, tone, value }: { label: string; tone: "white" | "amber" | "cyan" | "green" | "violet"; value: number }) {
  const tones = { white: "text-white", amber: "text-yellow-300", cyan: "text-cyan-300", green: "text-emerald-300", violet: "text-violet-300" };
  return (
    <div className="rounded-[8px] border border-slate-700 bg-slate-900/60 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-4 text-4xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: "green" | "rose" | "slate" }) {
  const className = tone === "green" ? "bg-emerald-500/15 text-emerald-200" : tone === "rose" ? "bg-rose-500/15 text-rose-200" : "bg-slate-700 text-slate-200";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function RunBanner({ latestLog, status }: { latestLog: WorkflowStatus["log"][number] | null; status: WorkflowStatus | null }) {
  if (!status?.isRunning && !latestLog) return null;
  const running = Boolean(status?.isRunning);
  return (
    <div className={`mt-8 rounded-[8px] border px-5 py-4 ${running ? "border-blue-400/40 bg-blue-950/35" : "border-slate-700 bg-slate-900/55"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-bold uppercase tracking-[0.16em] ${running ? "text-blue-200" : "text-slate-400"}`}>{running ? "PIPELINE RUNNING" : "LAST PIPELINE EVENT"}</p>
          <p className="mt-2 text-lg font-semibold text-white">{status?.currentStep || latestLog?.step || "空闲"}</p>
        </div>
        <div className="text-right text-sm text-slate-300">
          {status?.lock ? <p>锁定：{status.lock.step} / PID {status.lock.pid || "-"}</p> : <p>运行锁：无</p>}
          {latestLog ? <p className="mt-1">最近：{formatDate(latestLog.time)}</p> : null}
        </div>
      </div>
      {latestLog ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{latestLog.message}</p> : null}
    </div>
  );
}

function ReadinessItem({ detail, label, ok }: { detail: string; label: string; ok: boolean }) {
  return (
    <div className={`rounded-[8px] border p-4 ${ok ? "border-emerald-500/25 bg-emerald-950/15" : "border-amber-500/25 bg-amber-950/15"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
        </div>
        <StatusPill tone={ok ? "green" : "slate"}>{ok ? "就绪" : "待处理"}</StatusPill>
      </div>
    </div>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: "success" | "error" }) {
  return <div className={`mt-6 whitespace-pre-wrap rounded-[8px] border px-4 py-3 text-sm leading-6 ${tone === "success" ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-100" : "border-rose-500/30 bg-rose-950/30 text-rose-100"}`}>{children}</div>;
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <Field label={label}>
      <input className={inputClass} type="number" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />
    </Field>
  );
}

function UploadInput({ files, onChange, title }: { files: File[]; onChange: (files: File[]) => void; title: string }) {
  return (
    <label className="block rounded-[8px] bg-slate-950 p-4">
      <p className="font-semibold text-white">{title}</p>
      <input className="mt-3 block w-full text-sm text-slate-400 file:mr-4 file:rounded-[8px] file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white" type="file" multiple onChange={(event) => onChange(Array.from(event.target.files || []))} />
      <div className="mt-3 space-y-1 text-xs text-slate-500">{files.length === 0 ? <p>未选择文件</p> : files.map((file) => <p key={`${file.name}-${file.size}`}>{file.name}</p>)}</div>
    </label>
  );
}

function CandidateTable({ onToggle, rows, selected }: { onToggle: (id: string, checked: boolean) => void; rows: MiningCandidate[]; selected: Record<string, boolean> }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-[8px] border border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr><th className="p-3">选择</th><th className="p-3">关键词</th><th className="p-3">Slug</th><th className="p-3">分类</th><th className="p-3">意图</th><th className="p-3">评分</th><th className="p-3">来源</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={7}>暂无候选词。</td></tr> : rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-800">
              <td className="p-3"><input type="checkbox" className="accent-blue-500" checked={Boolean(selected[row.id])} onChange={(event) => onToggle(row.id, event.target.checked)} /></td>
              <td className="p-3 text-white">{row.keyword}</td>
              <td className="p-3 text-slate-400">{row.slug}</td>
              <td className="p-3 text-slate-300">{row.category}</td>
              <td className="p-3 text-slate-300">{row.intent}</td>
              <td className="p-3 text-cyan-300">{row.score}</td>
              <td className="p-3 text-slate-400">{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordTable({
  onDelete,
  onEdit,
  onToggle,
  rows,
  selected,
}: {
  onDelete: (slug: string) => void;
  onEdit: (row: KeywordFileRow) => void;
  onToggle: (slug: string, checked: boolean) => void;
  rows: KeywordFileRow[];
  selected: Record<string, boolean>;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[8px] border border-slate-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="p-3">选择</th>
            <th className="p-3">关键词</th>
            <th className="p-3">Slug</th>
            <th className="p-3">语言</th>
            <th className="p-3">分类</th>
            <th className="p-3">意图</th>
            <th className="p-3">优先级</th>
            <th className="p-3">内容模式</th>
            <th className="p-3">状态</th>
            <th className="p-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-6 text-center text-slate-500" colSpan={10}>暂无关键词。</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.slug} className="border-t border-slate-800">
                <td className="p-3"><input type="checkbox" className="accent-blue-500" checked={Boolean(selected[row.slug])} onChange={(event) => onToggle(row.slug, event.target.checked)} /></td>
                <td className="p-3 text-white">{row.keyword}</td>
                <td className="p-3 text-slate-400">{row.slug}</td>
                <td className="p-3 text-slate-300">{row.locale}</td>
                <td className="p-3 text-slate-300">{row.category}</td>
                <td className="p-3 text-slate-300">{row.intent}</td>
                <td className="p-3 text-slate-300">{row.priority}</td>
                <td className="p-3 text-slate-300">{row.contentMode}</td>
                <td className="p-3 text-slate-400">{row.articleStatusLabel || row.articleStatus || "-"}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <button type="button" className="text-blue-300 hover:text-blue-200" onClick={() => onEdit(row)}>编辑</button>
                    <button type="button" className="text-rose-300 hover:text-rose-200" onClick={() => onDelete(row.slug)}>删除</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DraftCard({
  audit,
  busy,
  checked,
  disabled,
  draft,
  onApprove,
  onFactSource,
  onGenerate,
  onRefreshImages,
  onReview,
  onReviewReport,
  onRewrite,
  onPublish,
  onToggle,
  onValidate,
  onView,
}: {
  audit?: AuditMeta;
  busy: string | null;
  checked: boolean;
  disabled: boolean;
  draft: DraftMeta;
  onApprove: () => void;
  onFactSource: () => void;
  onGenerate: () => void;
  onRefreshImages: () => void;
  onReview: () => void;
  onReviewReport: () => void;
  onRewrite: () => void;
  onPublish: () => void;
  onToggle: (checked: boolean) => void;
  onValidate: () => void;
  onView: () => void;
}) {
  const stage = draftStage(draft, audit);
  const reviewSummary = audit
    ? `AI质检：${audit.reviewPassed ? "通过" : "需修订"} / 重写 ${audit.revisionCount} 次 / 问题 ${audit.findingsCount} 个。${audit.approved ? "人工审核已通过。" : "发布前仍需人工审核。"}`
    : "尚未执行 AI 质检。建议先完成质检，再决定是否重写、校验和发布。";

  return (
    <article className="rounded-[8px] border border-slate-700 bg-slate-950/35 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <label className="flex min-w-0 items-start gap-3">
          <input className="mt-2 accent-blue-500" type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} />
          <span className="min-w-0">
            <span className="block text-2xl font-bold leading-tight text-white">{draft.zhTitle || draft.title}</span>
            <span className="mt-2 block text-lg text-slate-400">{draft.slug}</span>
          </span>
        </label>
        <span className="rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-100">{stage}</span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-400 md:grid-cols-4">
        <p>分类：{draft.category || "-"}</p>
        <p>模式：{contentModeLabel(draft.contentMode)}</p>
        <p>市场：{draft.market || "-"}</p>
        <p>风险：{draft.riskLevel || "-"}</p>
        <p>配图：{draft.imageUpdatedAt ? formatDate(draft.imageUpdatedAt) : draft.coverImage ? "已生成" : "未生成"}{draft.contentMode === "fact-source" ? ` / 图表 ${draft.visualCount || 0}` : ""}</p>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <GateChip label="配图" ok={Boolean(draft.coverImage || draft.imageUpdatedAt)} detail={draft.coverImage || draft.imageUpdatedAt ? "已准备" : "待刷新"} />
        <GateChip label="AI 质检" ok={Boolean(audit?.reviewPassed)} detail={audit ? (audit.reviewPassed ? "通过" : "需修订") : "未执行"} />
        <GateChip label="人工审核" ok={Boolean(audit?.approved)} detail={audit?.approved ? "通过" : "待确认"} />
        <GateChip label="线上发布" ok={draft.published} detail={draft.published ? "已发布" : "未发布"} />
      </div>

      <div className="mt-6 rounded-[8px] border border-cyan-700/60 bg-cyan-950/20 p-4 text-base leading-8 text-cyan-100">
        {reviewSummary}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ArticleActionButton label="查看/编辑" onClick={onView} />
        {draft.published ? <ArticleActionButton label="生成修订稿" disabled={disabled || busy === "generate"} onClick={onGenerate} /> : null}
        {draft.published ? <ArticleActionButton label="事实源资料包" onClick={onFactSource} /> : null}
        {draft.published || audit ? <ArticleActionButton label="质检报告" disabled={!audit} onClick={onReviewReport} /> : null}
        <ArticleActionButton label="生成文章" busy={busy === "generate"} disabled={disabled} onClick={onGenerate} />
        <ArticleActionButton label="刷新配图" busy={busy === "images"} disabled={disabled} onClick={onRefreshImages} />
        <ArticleActionButton label="AI质检" busy={busy === "review"} disabled={disabled} onClick={onReview} />
        <ArticleActionButton label="AI重写" busy={busy === "rewrite"} disabled={disabled} onClick={onRewrite} />
        <ArticleActionButton label="校验草稿" busy={busy === "validate"} disabled={disabled} onClick={onValidate} />
        <ArticleActionButton label="审核通过" busy={busy === "approve"} disabled={disabled || !audit?.reviewPassed} onClick={onApprove} />
        <ArticleActionButton label="发布网站" busy={busy === "publish"} disabled={disabled || !audit?.approved} onClick={onPublish} />
      </div>
    </article>
  );
}

function draftStage(draft: DraftMeta, audit?: AuditMeta) {
  if (draft.published) return "已发布";
  if (audit?.approved) return "已审核";
  if (audit?.reviewPassed && audit.revisionCount > 0) return "AI已重写";
  if (audit?.reviewPassed) return "AI已质检";
  if (audit && !audit.reviewPassed) return "待重写";
  if (draft.contentMode === "fact-source" && draft.visualCount >= 3) return "事实源已配图";
  if (draft.coverImage) return "已配图";
  return "草稿";
}

function contentModeLabel(mode: string) {
  return mode === "fact-source" ? "Fact Source / 事实源" : "Standard / 标准长文";
}

function ArticleActionButton({ busy, disabled, label, onClick }: { busy?: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      className="rounded-[6px] border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? "执行中..." : label}
    </button>
  );
}

function GateChip({ detail, label, ok }: { detail: string; label: string; ok: boolean }) {
  return (
    <div className={`rounded-[8px] border px-3 py-2 ${ok ? "border-emerald-500/25 bg-emerald-950/15" : "border-slate-700 bg-slate-900/70"}`}>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${ok ? "text-emerald-200" : "text-slate-300"}`}>{detail}</p>
    </div>
  );
}

function AuditCard({ audit }: { audit: AuditMeta }) {
  return (
    <div className="rounded-[8px] border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-white">{audit.slug}</p>
        <div className="flex gap-2">
          <StatusPill tone={audit.reviewPassed ? "green" : "rose"}>{audit.reviewPassed ? "AI 质检通过" : "已阻断"}</StatusPill>
          {audit.approved ? <StatusPill tone="green">已审核</StatusPill> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
        <p>种子词：{audit.seed}</p>
        <p>重写次数：{audit.revisionCount}</p>
        <p>问题数：{audit.findingsCount}</p>
        <p>审核：{audit.approved ? formatDate(audit.approvedAt) : "待审核"}</p>
        <p>模型：{audit.provider || "-"} / {audit.model || "-"}</p>
        <p>更新时间：{formatDate(audit.updatedAt)}</p>
      </div>
      <p className="mt-3 break-all rounded-[6px] bg-slate-900 px-3 py-2 text-xs text-slate-500">{audit.filePath}</p>
    </div>
  );
}

function LogItem({ item }: { item: { time: string; step: string; message: string } }) {
  const tone = logTone(item);
  return (
    <div className={`rounded-[8px] border p-4 ${tone === "error" ? "border-rose-500/30 bg-rose-950/20" : tone === "success" ? "border-emerald-500/25 bg-emerald-950/15" : "border-slate-800 bg-slate-950"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{formatDate(item.time)}</p>
        <StatusPill tone={tone === "error" ? "rose" : tone === "success" ? "green" : "slate"}>{tone === "error" ? "异常" : tone === "success" ? "完成" : "事件"}</StatusPill>
      </div>
      <p className="mt-2 font-medium text-white">{item.step}</p>
      <p className="mt-2 text-sm text-slate-300">{item.message}</p>
    </div>
  );
}

function logTone(item: { step: string; message: string }) {
  const text = `${item.step} ${item.message}`.toLowerCase();
  if (/fail|failed|error|blocked|阻断|失败|异常|forbidden/u.test(text)) return "error";
  if (/completed|success|passed|saved|generated|发布|完成|通过|成功/u.test(text)) return "success";
  return "neutral";
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[8px] border border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-500">{text}</div>;
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
