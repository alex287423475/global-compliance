import { getArticle, insightArticles } from "../../../content/insights";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InsightArticleClient from "./InsightArticleClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytop.com";

export function generateStaticParams() {
  return insightArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return {};
  }

  const title = `${article.title} | Global Bridge Compliance`;
  const url = `${siteUrl}/insights/${article.slug}`;

  return {
    title,
    description: article.summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: article.summary,
      url,
      siteName: "Global Bridge Compliance",
      type: "article",
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      section: article.category,
      tags: [article.category, article.market, article.riskLevel],
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

  return (
    <InsightArticleClient
      article={article}
      nextArticle={nextArticle}
      previousArticle={previousArticle}
      recommendedArticles={recommendedArticles}
      relatedArticles={relatedArticles}
    />
  );
}
