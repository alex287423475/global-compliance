"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../../../components/SiteHeader";
import type { InsightArticle } from "../../../../content/insights";
import type { InsightTopic } from "../../../../content/insight-topics";

type Locale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Topic Archive",
    allInsights: "All Insights",
    searchIntent: "Search Intent",
    liveFiles: "Live Files",
    articles: "Articles",
    updated: "Updated",
    market: "Market",
    risk: "Risk",
    redline: "Redline Watchlist",
    read: "Read brief",
    empty: "No public intelligence brief has been published in this topic yet.",
    methodEyebrow: "Use this topic when",
    methodTitle: "The file is no longer just a translation or copywriting task.",
    methodBody:
      "Use this topic when language, evidence, platform rules, and commercial exposure are already connected. The public article gives context; a private diagnostic review maps the same logic against your actual notice, policy page, screenshots, and deadline.",
    diagnostic: "Request diagnostic review",
    intake: "Open intake forms",
  },
  zh: {
    eyebrow: "主题归档",
    allInsights: "全部情报",
    searchIntent: "搜索意图",
    liveFiles: "已发布文件",
    articles: "篇文章",
    updated: "更新",
    market: "市场",
    risk: "风险",
    redline: "红线词",
    read: "阅读简报",
    empty: "该主题下暂时还没有公开情报文章。",
    methodEyebrow: "何时使用该主题",
    methodTitle: "当问题不再只是翻译或文案任务时，就进入合规情报范围。",
    methodBody:
      "当语言、证据、平台规则和商业风险已经连在一起时，应使用该主题。公开文章提供风险语境；私密诊断会把同一套逻辑映射到你的真实通知、政策页、截图和截止时间上。",
    diagnostic: "预约合规风险诊断",
    intake: "打开资料收集表",
  },
};

export default function TopicPageClient({
  articles,
  topic,
}: {
  articles: InsightArticle[];
  topic: InsightTopic;
}) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const t = copy[locale];
  const redlineTerms = Array.from(new Set(articles.flatMap((article) => article.redlineTerms))).slice(0, 12);

  useEffect(() => {
    const saved = window.localStorage.getItem("gbc-locale");
    const nextLocale =
      saved === "en" || saved === "zh" ? saved : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gbc-locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <a
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors duration-300 hover:text-blue-950"
          href="/insights"
        >
          {t.allInsights}
        </a>

        <div className="mt-10 grid gap-10 border-b border-blue-900/10 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="max-w-4xl">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.eyebrow}</p>
            <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-6xl">
              {locale === "zh" ? topic.zhTitle : topic.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">
              {locale === "zh" ? topic.zhDescription : topic.description}
            </p>
          </div>

          <aside className="border border-blue-900/10 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.liveFiles}</p>
            <p className="mt-6 font-[family-name:var(--font-serif)] text-5xl font-semibold text-blue-950">{articles.length}</p>
            <p className="mt-2 text-sm text-slate-600">{t.articles}</p>
            <div className="mt-6 border-t border-blue-900/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{t.searchIntent}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{locale === "zh" ? topic.zhSearchIntent : topic.searchIntent}</p>
            </div>
          </aside>
        </div>

        {redlineTerms.length > 0 ? (
          <section className="mt-10 border border-blue-900/10 bg-white p-6">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-red-800">{t.redline}</p>
            <div className="flex flex-wrap gap-3">
              {redlineTerms.map((term) => (
                <span className="border border-slate-200 bg-slate-100 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-slate-700" key={term}>
                  {term}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10 border border-blue-900/10 bg-white">
          {articles.length === 0 ? (
            <div className="p-8 text-sm leading-7 text-slate-600">{t.empty}</div>
          ) : (
            articles.map((article) => (
              <a
                className="grid gap-6 border-b border-blue-900/10 p-8 transition-colors duration-300 last:border-b-0 hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_260px]"
                href={`/insights/${article.slug}`}
                key={article.slug}
              >
                <div>
                  <div className="flex flex-wrap gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{article.category}</span>
                    <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase text-red-800">{article.riskLevel}</span>
                  </div>
                  <h2 className="mt-5 font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
                    {locale === "zh" ? article.zhTitle : article.title}
                  </h2>
                  <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">
                    {locale === "zh" ? article.zhSummary : article.summary}
                  </p>
                </div>
                <div className="border-t border-blue-900/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <Meta label={t.updated} value={article.updatedAt} />
                  <Meta label={t.market} value={article.market} />
                  <Meta label={t.risk} value={article.riskLevel} />
                  <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">{t.read}</p>
                </div>
              </a>
            ))
          )}
        </section>

        <section className="mt-14 grid gap-8 border-y border-blue-900/10 py-12 lg:grid-cols-[0.7fr_1fr]">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.methodEyebrow}</p>
            <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
              {t.methodTitle}
            </h2>
          </div>
          <div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">{t.methodBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center border border-blue-950 px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white"
                href="/#checkout"
              >
                {t.diagnostic}
              </a>
              <a
                className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-bold uppercase tracking-widest text-slate-700 transition-colors duration-300 hover:border-blue-950 hover:text-blue-950"
                href="/intake"
              >
                {t.intake}
              </a>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-slate-700">{value}</p>
    </div>
  );
}
