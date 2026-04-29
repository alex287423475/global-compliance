"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import { insightArticles } from "../../../content/insights";
import { getArticlesForTopic, insightTopics } from "../../../content/insight-topics";

type Locale = "en" | "zh";

const copy = {
  en: {
    eyebrow: "Compliance Topic Map",
    title: "Navigate the compliance intelligence library by commercial risk",
    body:
      "Use this topic map when the archive grows beyond a few articles. Each topic is organized around a buyer-facing risk pattern rather than a generic content category.",
    totalTopics: "Topics",
    totalArticles: "Articles",
    highRisk: "Critical / High",
    searchIntent: "Search intent",
    articleCount: "Published files",
    openTopic: "Open topic",
    openLead: "Read lead brief",
    noArticles: "No public article yet",
    topicMethod: "How to use the map",
    methodItems: [
      "Start with the crisis the client already recognizes",
      "Use the topic page to inspect redline terms and evidence gaps",
      "Move from public article to private intake only when a live file exists",
    ],
  },
  zh: {
    eyebrow: "合规主题地图",
    title: "按商业风险导航合规情报库",
    body:
      "当文章库超过少数几篇后，需要一个主题地图。这里按客户已经感知到的商业风险组织，而不是按泛泛内容分类。",
    totalTopics: "主题",
    totalArticles: "文章",
    highRisk: "Critical / High",
    searchIntent: "搜索意图",
    articleCount: "已发布文件",
    openTopic: "打开主题",
    openLead: "阅读主文章",
    noArticles: "暂无公开文章",
    topicMethod: "使用方法",
    methodItems: [
      "先从客户已经意识到的危机场景进入",
      "用主题页检查红线词和证据缺口",
      "只有当客户存在真实文件时，再从公开文章转入私密资料收集",
    ],
  },
};

export default function TopicsPageClient() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const t = copy[locale];

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

  const topicCards = useMemo(
    () =>
      insightTopics.map((topic) => {
        const articles = getArticlesForTopic(topic);
        const leadArticle = articles[0];
        const highRiskCount = articles.filter((article) => article.riskLevel === "Critical" || article.riskLevel === "High").length;
        const redlineTerms = Array.from(new Set(articles.flatMap((article) => article.redlineTerms))).slice(0, 4);
        return { articles, highRiskCount, leadArticle, redlineTerms, topic };
      }),
    [],
  );

  const highRiskTotal = insightArticles.filter((article) => article.riskLevel === "Critical" || article.riskLevel === "High").length;

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <a
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors duration-300 hover:text-blue-950"
          href="/insights"
        >
          / Insights
        </a>

        <div className="mt-10 grid gap-12 border-b border-blue-900/10 pb-14 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-4xl">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.eyebrow}</p>
            <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-6xl">
              {t.title}
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">{t.body}</p>
          </div>

          <aside className="grid gap-4 border border-blue-900/10 bg-white p-6">
            <Metric label={t.totalTopics} value={String(insightTopics.length)} />
            <Metric label={t.totalArticles} value={String(insightArticles.length)} />
            <Metric label={t.highRisk} value={String(highRiskTotal)} />
          </aside>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          {topicCards.map(({ articles, highRiskCount, leadArticle, redlineTerms, topic }) => (
            <article className="border border-blue-900/10 bg-white p-7" key={topic.slug}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{topic.category}</p>
                  <h2 className="mt-4 font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
                    {locale === "zh" ? topic.zhTitle : topic.title}
                  </h2>
                </div>
                <span className="border border-slate-200 bg-slate-100 px-3 py-2 font-[family-name:var(--font-mono)] text-xs font-bold text-slate-700">
                  {articles.length}
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-600">{locale === "zh" ? topic.zhDescription : topic.description}</p>

              <div className="mt-6 grid gap-4 border-y border-blue-900/10 py-5 sm:grid-cols-2">
                <SmallMeta label={t.searchIntent} value={locale === "zh" ? topic.zhSearchIntent : topic.searchIntent} />
                <SmallMeta label={t.articleCount} value={`${articles.length} / ${highRiskCount} ${t.highRisk}`} />
              </div>

              {redlineTerms.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {redlineTerms.map((term) => (
                    <span className="border border-slate-200 bg-slate-100 px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] text-slate-600" key={term}>
                      {term}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center justify-center border border-blue-950 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white"
                  href={`/insights/topics/${topic.slug}`}
                >
                  {t.openTopic}
                </a>
                {leadArticle ? (
                  <a
                    className="inline-flex items-center justify-center border border-slate-300 bg-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700 transition-colors duration-300 hover:border-blue-950 hover:text-blue-950"
                    href={`/insights/${leadArticle.slug}`}
                  >
                    {t.openLead}
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center border border-slate-200 bg-slate-100 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {t.noArticles}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-14 border border-blue-900/10 bg-white p-8">
          <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.topicMethod}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {t.methodItems.map((item, index) => (
              <div className="border-l-2 border-red-800 bg-red-50/50 p-5" key={item}>
                <p className="font-[family-name:var(--font-mono)] text-xs font-bold text-red-800">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-4 text-sm leading-7 text-blue-950">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-blue-900/10 bg-slate-50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-serif)] text-4xl font-semibold text-blue-950">{value}</p>
    </div>
  );
}

function SmallMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{value}</p>
    </div>
  );
}
