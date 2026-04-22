"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { InsightArticle, InsightCard, InsightFaqItem, InsightTocItem } from "../../../content/insights";
import SiteHeader from "../../components/SiteHeader";

type Locale = "en" | "zh";

const copy = {
  en: {
    updated: "Updated",
    readTime: "Read Time",
    redline: "Redline Terms",
    cards: "Intelligence Cards",
    toc: "On This Page",
    faq: "FAQ",
    nextStep: "Next Step",
    nextStepTitle: "Need this risk reviewed against your own materials",
    requestReview: "Request Diagnostic Review",
    previous: "Previous Article",
    next: "Next Article",
    related: "Related Intelligence",
    recommended: "Recommended Reading",
    read: "Read Article",
    minutes: "min read",
    evidence: "Evidence",
    action: "Action",
    keywords: "Keywords",
  },
  zh: {
    updated: "更新日期",
    readTime: "阅读时长",
    redline: "红线词",
    cards: "情报卡",
    toc: "本文目录",
    faq: "常见问题",
    nextStep: "下一步",
    nextStepTitle: "需要结合你自己的材料做一轮风险诊断",
    requestReview: "预约合规风险诊断",
    previous: "上一篇",
    next: "下一篇",
    related: "关联情报",
    recommended: "推荐阅读",
    read: "阅读全文",
    minutes: "分钟阅读",
    evidence: "证据",
    action: "动作",
    keywords: "关键词",
  },
};

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2
      className="scroll-mt-28 font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950 md:text-4xl"
      id={headingId(children)}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="scroll-mt-28 font-[family-name:var(--font-serif)] text-2xl font-medium leading-tight text-blue-950"
      id={headingId(children)}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="text-base leading-8 text-slate-600">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-3 pl-5 text-base leading-8 text-slate-600">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-3 pl-5 text-base leading-8 text-slate-600">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-red-800 bg-red-50/50 py-4 pl-6 font-[family-name:var(--font-serif)] text-xl leading-9 text-slate-700">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto border border-blue-900/10 bg-white">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100 text-blue-950">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-blue-900/10">{children}</tbody>,
  th: ({ children }) => <th className="px-4 py-3 font-bold">{children}</th>,
  td: ({ children }) => <td className="px-4 py-4 align-top leading-7 text-slate-600">{children}</td>,
  a: ({ children, href }) => (
    <a className="underline decoration-blue-950/30 underline-offset-4 transition-colors hover:text-blue-950" href={href}>
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-bold text-blue-950">{children}</strong>,
  hr: () => <hr className="my-12 border-blue-900/10" />,
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
    const nextLocale =
      saved === "en" || saved === "zh"
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

  const title = localizedText(locale, article.zhTitle, article.title);
  const dek = localizedText(locale, article.zhDek, article.dek);
  const summary = localizedText(locale, article.zhSummary, article.summary);
  const markdownBody = localizedText(locale, article.zhBodyMarkdown, article.bodyMarkdown);
  const intelligenceCards = localizedCards(locale, article.intelligenceCards || []);
  const toc = localizedToc(locale, article.toc);
  const faq = localizedFaq(locale, article.faq);
  const readMinutes = useMemo(() => estimateReadMinutes(markdownBody), [markdownBody]);

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <article className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {article.category} / {article.market}
          </p>

          <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-7xl">
            {title}
          </h1>

          {dek ? <p className="mt-6 font-[family-name:var(--font-serif)] text-2xl leading-10 text-slate-700">{dek}</p> : null}

          <p className="mt-8 max-w-3xl text-base leading-8 text-slate-600">{summary}</p>

          <div className="mt-8 flex flex-wrap gap-6 border-y border-blue-900/10 py-5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <div>
              <span className="text-slate-400">{t.updated}</span>
              <div className="mt-2 text-blue-950">{article.updatedAt}</div>
            </div>
            <div>
              <span className="text-slate-400">{t.readTime}</span>
              <div className="mt-2 text-blue-950">
                {readMinutes} {t.minutes}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Risk</span>
              <div className="mt-2 text-red-800">{article.riskLevel}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="min-w-0">
            <div className="mb-10 border-l-2 border-red-800 bg-red-50/50 py-5 pl-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-800">{t.redline}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {article.redlineTerms.map((term) => (
                  <span
                    className="border border-slate-200 bg-slate-100 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-slate-700"
                    key={term}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>

            {intelligenceCards.length ? (
              <section className="mb-12 border border-blue-900/10 bg-white">
                <div className="border-b border-blue-900/10 px-6 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.cards}</p>
                </div>
                <div className="grid divide-y divide-blue-900/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                  {intelligenceCards.slice(0, 6).map((card) => (
                    <div className="p-6" key={`${card.label}-${card.finding}`}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                        <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase text-red-800">
                          {card.severity}
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-bold leading-7 text-blue-950">{card.finding}</p>
                      <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                        <p>
                          <span className="font-bold text-blue-950">{t.evidence}: </span>
                          {card.evidence}
                        </p>
                        <p>
                          <span className="font-bold text-blue-950">{t.action}: </span>
                          {card.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="prose prose-slate max-w-none space-y-8 prose-headings:scroll-mt-28">
              {markdownBody ? (
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {markdownBody}
                </ReactMarkdown>
              ) : (
                <FallbackSections article={article} locale={locale} />
              )}
            </div>

            {faq.length ? (
              <section className="mt-16 border-t border-blue-900/10 pt-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.faq}</p>
                <div className="mt-6 space-y-6">
                  {faq.map((item) => (
                    <div className="border border-blue-900/10 bg-white p-6" key={item.question}>
                      <h2 className="font-[family-name:var(--font-serif)] text-2xl font-medium text-blue-950">
                        {item.question}
                      </h2>
                      <div className="mt-4 space-y-4">
                        {splitParagraphs(item.answer).map((paragraph) => (
                          <p className="text-base leading-8 text-slate-600" key={paragraph}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <ArticlePager
              labels={{ next: t.next, previous: t.previous }}
              locale={locale}
              nextArticle={nextArticle}
              previousArticle={previousArticle}
            />

            <ArticleRail articles={relatedArticles} label={t.related} locale={locale} readLabel={t.read} />
            <ArticleRail articles={recommendedArticles} label={t.recommended} locale={locale} readLabel={t.read} />

            <div className="mt-16 border-t border-blue-900/10 pt-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.nextStep}</p>
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
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            {toc.length ? (
              <div className="border border-blue-900/10 bg-white p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.toc}</p>
                <nav className="mt-5 space-y-3">
                  {toc.map((item) => (
                    <a
                      className={`block text-sm leading-6 text-slate-600 transition-colors hover:text-blue-950 ${
                        item.level === 3 ? "pl-4" : ""
                      }`}
                      href={`#${item.id}`}
                      key={`${item.id}-${item.label}`}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            ) : null}

            <div className="border border-blue-900/10 bg-white p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.keywords}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {article.relatedKeywords.map((term) => (
                  <span className="border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700" key={term}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
}

function FallbackSections({ article, locale }: { article: InsightArticle; locale: Locale }) {
  return (
    <div className="space-y-12">
      {article.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="font-[family-name:var(--font-serif)] text-3xl font-medium leading-tight text-blue-950">
            {localizedText(locale, section.zhHeading, section.heading)}
          </h2>
          <div className="mt-5 space-y-5 text-base leading-8 text-slate-600">
            {splitParagraphs(localizedText(locale, section.zhBody, section.body)).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
      {article.conclusion ? (
        <section className="border-t border-blue-900/10 pt-10">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl font-medium text-blue-950">Conclusion</h2>
          <div className="mt-5 space-y-5 text-base leading-8 text-slate-600">
            {splitParagraphs(localizedText(locale, article.zhConclusion, article.conclusion)).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function localizedToc(locale: Locale, toc: InsightTocItem[]) {
  return toc.map((item) => ({
    ...item,
    label: localizedText(locale, item.zhLabel, item.label),
  }));
}

function localizedFaq(locale: Locale, faq: InsightFaqItem[]) {
  return faq.map((item) => ({
    question: localizedText(locale, item.zhQuestion, item.question),
    answer: localizedText(locale, item.zhAnswer, item.answer),
  }));
}

function localizedCards(locale: Locale, cards: InsightCard[]) {
  return cards.map((item) => ({
    label: localizedText(locale, item.zhLabel, item.label),
    finding: localizedText(locale, item.zhFinding, item.finding),
    evidence: localizedText(locale, item.zhEvidence, item.evidence),
    action: localizedText(locale, item.zhAction, item.action),
    severity: item.severity,
  }));
}

function localizedText(locale: Locale, localized: string | undefined, fallback: string) {
  if (locale === "zh" && localized && !looksMojibake(localized)) {
    return localized;
  }
  return fallback;
}

function looksMojibake(text?: string) {
  if (!text) return false;
  const markers = ["鍏", "鍚", "鏂", "鐨", "璇", "绔", "€", "鎺", "閫", "寮", "缁", "绾"];
  return markers.some((marker) => text.includes(marker));
}

function splitParagraphs(text?: string) {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function estimateReadMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 220));
}

function headingId(children: ReactNode) {
  const text = flattenChildren(children)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "section";
}

function flattenChildren(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(flattenChildren).join("");
  }
  if (node && typeof node === "object" && "props" in node) {
    return flattenChildren((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
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
        {localizedText(locale, article.zhTitle, article.title)}
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
              {localizedText(locale, article.zhTitle, article.title)}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">{localizedText(locale, article.zhDek, article.dek)}</p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">{readLabel}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
