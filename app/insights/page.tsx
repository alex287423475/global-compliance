"use client";

import { insightArticles } from "../../content/insights";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "../components/SiteHeader";

type Locale = "en" | "zh";

const PAGE_SIZE = 12;

const categoryDefs = [
  { value: "Payment Risk", en: "Payment Risk", zh: "支付风控" },
  { value: "Marketplace Appeal", en: "Marketplace Appeal", zh: "平台申诉" },
  { value: "Market Entry", en: "Market Entry", zh: "市场准入" },
  { value: "Supply Chain", en: "Supply Chain", zh: "供应链" },
  { value: "IP Defense", en: "IP Defense", zh: "知识产权" },
  { value: "Crisis PR", en: "Crisis PR", zh: "危机公关" },
  { value: "Capital Documents", en: "Capital Documents", zh: "资本文书" },
  { value: "B2B Contracts", en: "B2B Contracts", zh: "B2B 合同" },
  { value: "Tax & Audit", en: "Tax & Audit", zh: "税务审计" },
  { value: "Data Privacy", en: "Data Privacy", zh: "数据隐私" },
];

const copy = {
  en: {
    brand: "Global Bridge Compliance",
    back: "Back to site",
    eyebrow: "Compliance Intelligence Library",
    title: "Cross-border compliance intelligence library",
    body:
      "Long-form risk briefs for payment reviews, marketplace appeals, market entry, supply-chain declarations, IP defense, crisis response, and capital documentation. Each article is structured around risk context, evidence burden, redline language, and practical response files.",
    scopeLabel: "Coverage",
    featuredLabel: "Featured Brief",
    featuredTitle: "Start with the file most likely to create immediate commercial exposure",
    riskBoard: "Risk Board",
    redlineTerms: "Redline terms",
    searchLabel: "Search intelligence",
    searchPlaceholder: "Search PayPal, Stripe, POA, UFLPA, chargeback...",
    all: "All",
    articles: "Articles",
    briefCount: "Briefs",
    filterLabel: "Filter by Category",
    updated: "Updated",
    market: "Market",
    risk: "Risk",
    read: "Read brief",
    empty: "No intelligence briefs in this category yet.",
    noMatches: "No matching intelligence briefs. Clear the search or choose another category.",
    showing: "Showing",
    of: "of",
    page: "Page",
    previous: "Previous",
    next: "Next",
    ctaEyebrow: "Need a private read?",
    ctaTitle: "Turn a live notice, appeal, or policy file into a controlled response package.",
    ctaCopy:
      "The library explains common risk patterns. A private review maps those patterns against your actual evidence, platform notice, policy text, and submission deadline.",
    ctaPrimary: "Request diagnostic review",
    ctaSecondary: "Open intake forms",
  },
  zh: {
    brand: "全球博译合规",
    back: "返回官网",
    eyebrow: "Compliance Intelligence Library",
    title: "跨境合规情报库",
    body:
      "面向支付审核、平台申诉、市场准入、供应链声明、知识产权防御、危机回应和资本文书的深度风险文章。每篇围绕风险语境、证据负担、红线表达和可执行回应文件组织。",
    scopeLabel: "覆盖范围",
    featuredLabel: "精选简报",
    featuredTitle: "先看最可能造成即时商业暴露的文件类型",
    riskBoard: "风险看板",
    redlineTerms: "红线词",
    searchLabel: "搜索情报",
    searchPlaceholder: "搜索 PayPal、Stripe、POA、UFLPA、拒付...",
    all: "全部",
    articles: "篇文章",
    briefCount: "篇",
    filterLabel: "按分类筛选",
    updated: "更新",
    market: "市场",
    risk: "风险",
    read: "阅读简报",
    empty: "该分类下暂无情报文章。",
    noMatches: "没有匹配的情报文章。可以清空搜索，或切换其他分类。",
    showing: "显示",
    of: "共",
    page: "页",
    previous: "上一页",
    next: "下一页",
    ctaEyebrow: "需要私密判断？",
    ctaTitle: "把真实平台通知、申诉材料或政策文件，转化为可控回应文件包。",
    ctaCopy:
      "情报库解释常见风险模式。私密评估会把这些模式映射到你的真实证据、平台通知、政策文本和提交截止时间上。",
    ctaPrimary: "预约诊断",
    ctaSecondary: "打开资料收集表",
  },
};

export default function InsightsPage() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const t = copy[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem("gbc-locale");
    const nextLocale = saved === "en" || saved === "zh"
      ? saved
      : navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gbc-locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  function setCategory(nextCategory: string) {
    setActiveCategory(nextCategory);
    setCurrentPage(1);
  }

  const filteredArticles = useMemo(
    () => {
      const query = searchQuery.trim().toLowerCase();
      return insightArticles.filter((article) => {
        const categoryMatch = activeCategory === "All" || article.category === activeCategory;
        if (!categoryMatch) return false;
        if (!query) return true;
        const haystack = [
          article.title,
          article.zhTitle,
          article.summary,
          article.zhSummary,
          article.category,
          article.market,
          article.riskLevel,
          ...article.relatedKeywords,
          ...article.redlineTerms,
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    },
    [activeCategory, searchQuery],
  );

  const categoryCounts = useMemo(
    () =>
      new Map(
        categoryDefs.map((category) => [
          category.value,
          insightArticles.filter((article) => article.category === category.value).length,
        ]),
      ),
    [],
  );

  const riskCounts = useMemo(
    () =>
      ["Critical", "High", "Medium"].map((risk) => ({
        risk,
        count: insightArticles.filter((article) => article.riskLevel === risk).length,
      })),
    [],
  );

  const featuredArticle =
    insightArticles.find((article) => article.riskLevel === "Critical") ||
    insightArticles.find((article) => article.riskLevel === "High") ||
    insightArticles[0];

  const redlineTerms = Array.from(new Set(insightArticles.flatMap((article) => article.redlineTerms))).slice(0, 8);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedArticles = filteredArticles.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="grid gap-12 border-b border-blue-900/10 pb-14 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="max-w-4xl">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
              {t.eyebrow}
            </p>
            <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-6xl">
              {t.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">{t.body}</p>

            <div className="mt-8">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t.scopeLabel}
              </p>
              <div className="flex max-w-4xl flex-wrap gap-3">
                {categoryDefs.slice(0, 8).map((category) => (
                  <span
                    className="border border-blue-900/10 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700"
                    key={category.value}
                  >
                    {locale === "zh" ? category.zh : category.en}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-blue-900/10 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
              {t.riskBoard}
            </p>
            <p className="mt-6 font-[family-name:var(--font-serif)] text-5xl font-semibold text-blue-950">
              {insightArticles.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t.articles}</p>
            <div className="mt-6 space-y-3 border-t border-blue-900/10 pt-5">
              {riskCounts.map((item) => (
                <div className="flex items-center justify-between gap-4 text-sm" key={item.risk}>
                  <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{item.risk}</span>
                  <span className="font-bold text-blue-950">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {featuredArticle ? (
          <section className="mt-12 grid gap-6 border border-blue-900/10 bg-white lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-blue-900/10 p-7 lg:border-b-0 lg:border-r">
              <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
                {t.featuredLabel}
              </p>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950 md:text-4xl">
                {t.featuredTitle}
              </h2>
              <p className="mt-7 mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t.redlineTerms}
              </p>
              <div className="flex flex-wrap gap-3">
                {redlineTerms.map((term) => (
                  <span className="border border-slate-200 bg-slate-100 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-slate-700" key={term}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
            <a className="group p-7 transition-colors duration-300 hover:bg-slate-50" href={`/insights/${featuredArticle.slug}`}>
              <div className="flex flex-wrap gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
                  {getCategoryLabel(featuredArticle.category, locale)}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase text-red-800">
                  {featuredArticle.riskLevel}
                </span>
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
                {locale === "zh" ? featuredArticle.zhTitle : featuredArticle.title}
              </h3>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                {locale === "zh" ? featuredArticle.zhSummary : featuredArticle.summary}
              </p>
              <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">
                {t.read}
              </p>
            </a>
          </section>
        ) : null}

        <div className="mt-10">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1fr]">
            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{t.searchLabel}</span>
              <input
                className="border border-blue-900/10 bg-white px-4 py-3 text-sm text-blue-950 outline-none transition-colors duration-300 placeholder:text-slate-400 focus:border-blue-950"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t.searchPlaceholder}
                type="search"
                value={searchQuery}
              />
            </label>
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t.filterLabel}
              </p>
              <div className="flex flex-wrap gap-3">
                <CategoryButton active={activeCategory === "All"} count={insightArticles.length} label={t.all} onClick={() => setCategory("All")} />
                {categoryDefs.map((category) => (
                  <CategoryButton
                    active={activeCategory === category.value}
                    count={categoryCounts.get(category.value) || 0}
                    disabled={(categoryCounts.get(category.value) || 0) === 0}
                    key={category.value}
                    label={locale === "zh" ? category.zh : category.en}
                    onClick={() => setCategory(category.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-y border-blue-900/10 py-5 text-sm text-slate-600 sm:flex-row sm:items-center">
          <p>
            {t.showing} {filteredArticles.length === 0 ? 0 : pageStart + 1}-
            {Math.min(pageStart + PAGE_SIZE, filteredArticles.length)} {t.of} {filteredArticles.length}
          </p>
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.16em] text-slate-500">
            {t.page} {safePage} / {totalPages}
          </p>
        </div>

        <div className="mt-10 border border-blue-900/10 bg-white">
          {paginatedArticles.length === 0 ? (
            <div className="p-8 text-sm leading-7 text-slate-600">{searchQuery.trim() ? t.noMatches : t.empty}</div>
          ) : (
            paginatedArticles.map((article) => (
              <a
                className="grid gap-6 border-b border-blue-900/10 p-8 transition-colors duration-300 last:border-b-0 hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_280px]"
                href={`/insights/${article.slug}`}
                key={article.slug}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
                      {getCategoryLabel(article.category, locale)}
                    </span>
                    <span className="border border-slate-200 bg-slate-100 px-3 py-1 font-[family-name:var(--font-mono)] text-xs text-slate-700">
                      {article.market}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase text-red-800">
                      {article.riskLevel}
                    </span>
                  </div>

                  <h2 className="mt-6 font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
                    {locale === "zh" ? article.zhTitle : article.title}
                  </h2>
                  <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">
                    {locale === "zh" ? article.zhSummary : article.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {article.relatedKeywords.slice(0, 4).map((keyword) => (
                      <span className="border border-blue-900/10 bg-slate-50 px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] text-slate-600" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between border-t border-blue-900/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <div className="grid grid-cols-2 gap-5 text-sm lg:grid-cols-1">
                    <Meta label={t.updated} value={article.updatedAt} />
                    <Meta label={t.market} value={article.market} />
                    <Meta label={t.risk} value={article.riskLevel} />
                  </div>
                  <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">
                    {t.read}
                  </p>
                </div>
              </a>
            ))
          )}
        </div>

        <Pagination
          currentPage={safePage}
          labels={{ next: t.next, previous: t.previous }}
          onPageChange={setCurrentPage}
          totalPages={totalPages}
        />

        <section className="mt-16 grid gap-8 border-y border-blue-900/10 py-12 lg:grid-cols-[0.7fr_1fr]">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.ctaEyebrow}</p>
            <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
              {t.ctaTitle}
            </h2>
          </div>
          <div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">{t.ctaCopy}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a className="inline-flex items-center justify-center border border-blue-950 px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white" href="/#checkout">
                {t.ctaPrimary}
              </a>
              <a className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-bold uppercase tracking-widest text-slate-700 transition-colors duration-300 hover:border-blue-950 hover:text-blue-950" href="/intake">
                {t.ctaSecondary}
              </a>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function CategoryButton({
  active,
  count,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors duration-300 ${
        active
          ? "border-blue-950 bg-blue-950 text-white"
          : "border-blue-900/10 bg-white text-slate-700 hover:border-blue-950 hover:text-blue-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-200"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label} <span className={active ? "text-white/70" : disabled ? "text-slate-300" : "text-slate-400"}>{count}</span>
    </button>
  );
}

function Pagination({
  currentPage,
  labels,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  labels: { next: string; previous: string };
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
      <button
        className="border border-blue-900/10 bg-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-950 transition-colors duration-300 disabled:cursor-not-allowed disabled:text-slate-300 enabled:hover:border-blue-950"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        {labels.previous}
      </button>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button
            className={`h-10 w-10 border text-xs font-bold transition-colors duration-300 ${
              page === currentPage
                ? "border-blue-950 bg-blue-950 text-white"
                : "border-blue-900/10 bg-white text-blue-950 hover:border-blue-950"
            }`}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}
      </div>
      <button
        className="border border-blue-900/10 bg-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-950 transition-colors duration-300 disabled:cursor-not-allowed disabled:text-slate-300 enabled:hover:border-blue-950"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        {labels.next}
      </button>
    </div>
  );
}

function getCategoryLabel(categoryValue: string, locale: Locale) {
  const category = categoryDefs.find((item) => item.value === categoryValue);
  if (!category) return categoryValue;
  return locale === "zh" ? category.zh : category.en;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-slate-700">{value}</p>
    </div>
  );
}
