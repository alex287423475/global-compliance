import type { Metadata } from "next";
import { insightArticles } from "../../../content/insights";
import { insightTopics } from "../../../content/insight-topics";
import TopicsPageClient from "./TopicsPageClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

export const metadata: Metadata = {
  title: "Compliance Topic Map | Global Bridge Compliance",
  description:
    "Browse the compliance intelligence library by payment risk, marketplace appeal, market entry, supply chain, IP defense, crisis PR, capital documents, B2B contracts, tax audit, and data privacy.",
  alternates: {
    canonical: "/insights/topics",
  },
  openGraph: {
    title: "Compliance Topic Map | Global Bridge Compliance",
    description:
      "Navigate cross-border compliance intelligence by commercial risk pattern and evidence burden.",
    url: "/insights/topics",
    siteName: "Global Bridge Compliance",
    type: "website",
  },
};

export default function TopicsPage() {
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Compliance Topic Map",
    description: metadata.description,
    url: `${siteUrl}/insights/topics`,
    hasPart: insightTopics.map((topic) => ({
      "@type": "CollectionPage",
      name: topic.title,
      url: `${siteUrl}/insights/topics/${topic.slug}`,
      about: topic.category,
    })),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: insightArticles.length,
      itemListElement: insightArticles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/insights/${article.slug}`,
        name: article.title,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Insights", item: `${siteUrl}/insights` },
      { "@type": "ListItem", position: 3, name: "Topics", item: `${siteUrl}/insights/topics` },
    ],
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} type="application/ld+json" />
      <TopicsPageClient />
    </>
  );
}
