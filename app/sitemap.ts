import type { MetadataRoute } from "next";
import { insightArticles } from "../content/insights";
import { insightTopics } from "../content/insight-topics";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/insights`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/intake`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/intake/chargeback`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const insightRoutes: MetadataRoute.Sitemap = insightArticles.map((article) => ({
    url: `${siteUrl}/insights/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: "monthly",
    priority: article.riskLevel === "Critical" ? 0.85 : 0.75,
  }));

  const topicRoutes: MetadataRoute.Sitemap = insightTopics.map((topic) => ({
    url: `${siteUrl}/insights/topics/${topic.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...topicRoutes, ...insightRoutes];
}
