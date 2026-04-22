import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, insightArticles } from "../../../content/insights";
import InsightArticleClient from "./InsightArticleClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

export function generateStaticParams() {
  return insightArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return {};
  }

  const title = `${article.metaTitle || article.title} | Global Bridge Compliance`;
  const description = article.metaDescription || article.summary;
  const url = `${siteUrl}/insights/${article.slug}`;

  return {
    title,
    description,
    keywords: article.relatedKeywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Global Bridge Compliance",
      type: "article",
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      section: article.category,
      tags: [...article.relatedKeywords, article.category, article.market, article.riskLevel],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function InsightArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const currentIndex = insightArticles.findIndex((item) => item.slug === article.slug);
  const previousArticle = currentIndex > 0 ? insightArticles[currentIndex - 1] : undefined;
  const nextArticle =
    currentIndex >= 0 && currentIndex < insightArticles.length - 1 ? insightArticles[currentIndex + 1] : undefined;
  const relatedArticles = insightArticles
    .filter((item) => item.slug !== article.slug && item.category === article.category)
    .slice(0, 3);
  const recommendedArticles = insightArticles
    .filter(
      (item) =>
        item.slug !== article.slug &&
        item.category !== article.category &&
        !relatedArticles.some((related) => related.slug === item.slug),
    )
    .slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.metaTitle || article.title,
    description: article.metaDescription || article.summary,
    datePublished: article.updatedAt,
    dateModified: article.updatedAt,
    inLanguage: ["en", "zh-CN"],
    mainEntityOfPage: `${siteUrl}/insights/${article.slug}`,
    keywords: article.relatedKeywords.join(", "),
    articleSection: article.category,
    about: article.redlineTerms,
    author: {
      "@type": "Organization",
      name: "Global Bridge Compliance",
    },
    publisher: {
      "@type": "Organization",
      name: "Global Bridge Compliance",
      url: siteUrl,
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd),
        }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd),
        }}
        type="application/ld+json"
      />
      <InsightArticleClient
        article={article}
        nextArticle={nextArticle}
        previousArticle={previousArticle}
        recommendedArticles={recommendedArticles}
        relatedArticles={relatedArticles}
      />
    </>
  );
}
