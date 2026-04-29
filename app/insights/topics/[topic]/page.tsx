import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticlesForTopic, getInsightTopicBySlug, insightTopics } from "../../../../content/insight-topics";
import TopicPageClient from "./TopicPageClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

type TopicPageProps = {
  params: Promise<{ topic: string }>;
};

export function generateStaticParams() {
  return insightTopics.map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topic: topicSlug } = await params;
  const topic = getInsightTopicBySlug(topicSlug);
  if (!topic) return {};

  const title = `${topic.title} Compliance Intelligence | Global Bridge Compliance`;
  const description = topic.description;

  return {
    title,
    description,
    alternates: {
      canonical: `/insights/topics/${topic.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/insights/topics/${topic.slug}`,
      siteName: "Global Bridge Compliance",
      type: "website",
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topic: topicSlug } = await params;
  const topic = getInsightTopicBySlug(topicSlug);
  if (!topic) notFound();

  const articles = getArticlesForTopic(topic);

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${topic.title} Compliance Intelligence`,
    description: topic.description,
    url: `${siteUrl}/insights/topics/${topic.slug}`,
    about: topic.category,
    hasPart: articles.map((article) => ({
      "@type": "Article",
      headline: article.title,
      url: `${siteUrl}/insights/${article.slug}`,
      dateModified: article.updatedAt,
      about: article.category,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Insights", item: `${siteUrl}/insights` },
      { "@type": "ListItem", position: 3, name: topic.title, item: `${siteUrl}/insights/topics/${topic.slug}` },
    ],
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} type="application/ld+json" />
      <TopicPageClient articles={articles} topic={topic} />
    </>
  );
}
