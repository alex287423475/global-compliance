import { insightArticles } from "../../../content/insights";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

export const revalidate = 3600;

export function GET() {
  const sortedArticles = [...insightArticles].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  const latestDate = sortedArticles[0]?.updatedAt ? new Date(sortedArticles[0].updatedAt) : new Date();

  const items = sortedArticles
    .map((article) => {
      const url = `${siteUrl}/insights/${article.slug}`;
      const description = article.metaDescription || article.summary;
      return `
        <item>
          <title>${escapeXml(article.title)}</title>
          <link>${escapeXml(url)}</link>
          <guid isPermaLink="true">${escapeXml(url)}</guid>
          <description>${escapeXml(description)}</description>
          <pubDate>${new Date(article.updatedAt).toUTCString()}</pubDate>
          <category>${escapeXml(article.category)}</category>
        </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>Global Bridge Compliance Intelligence</title>
        <link>${escapeXml(`${siteUrl}/insights`)}</link>
        <atom:link href="${escapeXml(`${siteUrl}/insights/feed.xml`)}" rel="self" type="application/rss+xml" />
        <description>Cross-border compliance intelligence on payment risk, marketplace appeals, supply-chain evidence, policy language, and dispute response files.</description>
        <language>en</language>
        <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml.trim(), {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
