import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, insightArticles } from "../../../content/insights";
import { getInsightTopicByCategory } from "../../../content/insight-topics";
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
  const imageUrl = article.ogImage || article.coverImage;
  const absoluteImageUrl = imageUrl ? `${siteUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}` : undefined;

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
      images: absoluteImageUrl ? [{ url: absoluteImageUrl, alt: article.imageAlt || article.title }] : undefined,
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      section: article.category,
      tags: [...article.relatedKeywords, article.category, article.market, article.riskLevel],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: absoluteImageUrl ? [absoluteImageUrl] : undefined,
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
  const relatedArticles = scoreRelatedArticles(article)
    .slice(0, 3);
  const recommendedArticles = insightArticles
    .filter(
      (item) =>
        item.slug !== article.slug &&
        !relatedArticles.some((related) => related.slug === item.slug),
    )
    .sort((first, second) => {
      const firstRisk = first.riskLevel === "Critical" ? 0 : first.riskLevel === "High" ? 1 : 2;
      const secondRisk = second.riskLevel === "Critical" ? 0 : second.riskLevel === "High" ? 1 : 2;
      return firstRisk - secondRisk || second.updatedAt.localeCompare(first.updatedAt);
    })
    .slice(0, 3);
  const imageUrl = article.ogImage || article.coverImage;
  const absoluteImageUrl = imageUrl ? `${siteUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}` : undefined;
  const topic = getInsightTopicByCategory(article.category);

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
    image: absoluteImageUrl,
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Insights",
        item: `${siteUrl}/insights`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: topic?.title || article.category,
        item: topic ? `${siteUrl}/insights/topics/${topic.slug}` : `${siteUrl}/insights`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: article.title,
        item: `${siteUrl}/insights/${article.slug}`,
      },
    ],
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
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
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

function scoreRelatedArticles(article: NonNullable<ReturnType<typeof getArticle>>) {
  return insightArticles
    .filter((item) => item.slug !== article.slug)
    .map((item) => {
      const keywordOverlap = item.relatedKeywords.filter((keyword) =>
        article.relatedKeywords.some((sourceKeyword) => sourceKeyword.toLowerCase() === keyword.toLowerCase()),
      ).length;
      const score =
        (item.category === article.category ? 8 : 0) +
        (item.market === article.market ? 3 : 0) +
        (item.riskLevel === article.riskLevel ? 2 : 0) +
        keywordOverlap;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || second.item.updatedAt.localeCompare(first.item.updatedAt))
    .map(({ item }) => item);
}
