// RSS 2.0 feed (ADR-015 #11). Lives OUTSIDE the [locale] tree: the proxy's
// dotted-path exclusion means /news/rss.xml is never locale-rewritten, so a
// route handler at the literal path serves it. Default-locale feed at
// launch. Omitted entirely (404) when the news flag is off.
import { getTranslations } from "next-intl/server";
import { articlePath, loadArticleRssEntries } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { loadFeatureFlag, loadSetting } from "@repo/settings";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(): Promise<Response> {
  const flag = await loadFeatureFlag("news");
  if (!flag?.isEnabled) return new Response(null, { status: 404 });

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const locale = routing.defaultLocale;
  const [t, siteName, entries] = await Promise.all([
    getTranslations({ locale, namespace: "news" }),
    loadSetting("site.name"),
    loadArticleRssEntries(locale, 50),
  ]);
  const channelTitle = siteName ? `${siteName} — ${t("title")}` : t("title");

  const items = entries
    .map((entry) => {
      const url = `${base}${articlePath(locale, routing.defaultLocale, entry.slug)}`;
      return [
        "    <item>",
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        entry.excerpt ? `      <description>${escapeXml(entry.excerpt)}</description>` : null,
        entry.categoryName ? `      <category>${escapeXml(entry.categoryName)}</category>` : null,
        entry.publishedAt ? `      <pubDate>${entry.publishedAt.toUTCString()}</pubDate>` : null,
        "    </item>",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(`${base}/news`)}</link>`,
    `    <description>${escapeXml(t("intro"))}</description>`,
    `    <language>${locale}</language>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
