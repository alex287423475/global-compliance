"use client";

import type { InsightArticle } from "../../../content/insights";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";

type Locale = "en" | "zh";

const copy = {
  en: {
    brand: "Global Bridge Compliance",
    back: "Back to insights",
    redline: "Redline Terms",
    nextStep: "Next Step",
    nextStepTitle: "Need this risk reviewed against your own materials",
    requestReview: "Request Diagnostic Review",
    previous: "Previous Brief",
    next: "Next Brief",
    related: "Related Intelligence",
    recommended: "Recommended Briefs",
    read: "Read brief",
  },
  zh: {
    brand: "全球博译合规",
    back: "返回情报库",
    redline: "红线词",
    nextStep: "下一步",
    nextStepTitle: "需要基于你的材料做一次风险诊断",
    requestReview: "预约诊断",
    previous: "上一篇",
    next: "下一篇",
    related: "关联情报",
    recommended: "推荐阅读",
    read: "阅读简报",
  },
};

export default function InsightArticleClient({
  article,
  nextArticle,
  previousArticle,
  recommendedArticles,
  relatedArticles,
}: {
  article: InsightArticle;
  nextArticle?: InsightArticle;
  previousArticle?: InsightArticle;
  recommendedArticles: InsightArticle[];
  relatedArticles: InsightArticle[];
}) {
  const [locale, setLocaleState] = useState<Locale>("en");
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

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <article className="mx-auto max-w-3xl px-6 py-20 lg:px-0">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          {article.category} / {article.market}
        </p>
        <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-6xl">
          {locale === "zh" ? article.zhTitle : article.title}
        </h1>
        <p className="mt-8 text-base leading-8 text-slate-600">
          {locale === "zh" ? article.zhSummary : article.summary}
        </p>

        <div className="mt-12 border-l-2 border-red-800 bg-red-50/50 py-5 pl-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-800">
            {t.redline}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {article.redlineTerms.map((term) => (
              <span className="border border-slate-200 bg-slate-100 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-slate-700" key={term}>
                {term}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-14 space-y-12">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
                {locale === "zh" ? section.zhHeading : section.heading}
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                {locale === "zh" ? section.zhBody : section.body}
              </p>
            </section>
          ))}
        </div>

        <ArticlePager
          labels={{ next: t.next, previous: t.previous }}
          locale={locale}
          nextArticle={nextArticle}
          previousArticle={previousArticle}
        />

        <ArticleRail articles={relatedArticles} label={t.related} locale={locale} readLabel={t.read} />
        <ArticleRail articles={recommendedArticles} label={t.recommended} locale={locale} readLabel={t.read} />

        <div className="mt-16 border-t border-blue-900/10 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {t.nextStep}
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-serif)] text-3xl font-medium text-blue-950">
            {t.nextStepTitle}
          </h2>
          <a
            className="mt-7 inline-flex border border-blue-950 bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white"
            href="/#checkout"
          >
            {t.requestReview}
          </a>
        </div>
      </article>
    </main>
  );
}

function ArticlePager({
  labels,
  locale,
  nextArticle,
  previousArticle,
}: {
  labels: { next: string; previous: string };
  locale: Locale;
  nextArticle?: InsightArticle;
  previousArticle?: InsightArticle;
}) {
  if (!previousArticle && !nextArticle) return null;

  return (
    <nav className="mt-16 grid gap-4 border-y border-blue-900/10 py-6 md:grid-cols-2">
      <PagerLink article={previousArticle} label={labels.previous} locale={locale} />
      <PagerLink article={nextArticle} label={labels.next} locale={locale} alignRight />
    </nav>
  );
}

function PagerLink({
  alignRight,
  article,
  label,
  locale,
}: {
  alignRight?: boolean;
  article?: InsightArticle;
  label: string;
  locale: Locale;
}) {
  if (!article) {
    return <div className="hidden md:block" />;
  }

  return (
    <a
      className={`block border border-blue-900/10 bg-white p-5 transition-colors duration-300 hover:border-blue-950 ${
        alignRight ? "md:text-right" : ""
      }`}
      href={`/insights/${article.slug}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-sm font-bold leading-6 text-blue-950">
        {locale === "zh" ? article.zhTitle : article.title}
      </p>
    </a>
  );
}

function ArticleRail({
  articles,
  label,
  locale,
  readLabel,
}: {
  articles: InsightArticle[];
  label: string;
  locale: Locale;
  readLabel: string;
}) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-14">
      <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{label}</p>
      <div className="grid gap-4">
        {articles.map((article) => (
          <a
            className="block border border-blue-900/10 bg-white p-5 transition-colors duration-300 hover:border-blue-950"
            href={`/insights/${article.slug}`}
            key={article.slug}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                {article.category}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase text-red-800">
                {article.riskLevel}
              </span>
            </div>
            <h3 className="mt-4 text-base font-bold leading-7 text-blue-950">
              {locale === "zh" ? article.zhTitle : article.title}
            </h3>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">
              {readLabel}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
