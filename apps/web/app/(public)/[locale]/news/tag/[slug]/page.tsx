import type { Metadata } from "next";
import { alternatesFor, pagedCanonical } from "../../../../../_lib/seo.ts";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  articleTagPath,
  getArticleFacets,
  getArticleTagBySlug,
  getPublishedArticles,
  getRedirect,
} from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { ArchiveTaxonomy } from "../../_components/archive-taxonomy.tsx";
import { ArticleListing } from "../../_components/article-listing.tsx";
import { NewsMasthead } from "../../_components/news-masthead.tsx";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/news/tag/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const search = await searchParams;
  const page = Math.max(0, Number.parseInt(String(search.page ?? "0"), 10) || 0);
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getArticleTagBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};
  const alternates = await alternatesFor({
    canonical: pagedCanonical(articleTagPath(locale, routing.defaultLocale, slug), page),
    languages: view.alternates.map((alt) => ({
      locale: alt.locale,
      href: articleTagPath(alt.locale, routing.defaultLocale, alt.slug),
    })),
  });
  const t = await getTranslations("news");
  return {
    title: (template ?? "%s").replace("%s", view.name),
    description: t("archiveLatestTitle", { name: view.name }),
    alternates,
  };
}

// The tag archive, given the same treatment as the category archive (design
// pass 2026-09-07): trail, count, and the section's taxonomy at the foot so
// the page leads somewhere.
//
// Facets here are NOT scoped — a tag cuts across categories, so the useful
// question at the bottom of a tag page is "which categories exist", answered
// with their real counts. Scoping them to this tag would give a category rail
// whose numbers meant "articles in this category AND this tag", which is not
// what a category card claims.
//
// changes-38: the page is the same shape as /news — `NewsMasthead` (which
// carried the popular tags until changes-47; the sidebar marks this tag
// current now), then `ArticleListing` with the
// sidebar beside the cards. It had gone full width, which took search, the
// category rail and the tag cloud away from the reader most likely to want
// them.
export default async function ArticleTagPage({
  params,
  searchParams,
}: PageProps<"/[locale]/news/tag/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("news", null))) notFound();

  const view = await getArticleTagBySlug(locale, slug);
  if (!view) {
    const target = await getRedirect(articleTagPath(locale, routing.defaultLocale, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  const search = await searchParams;
  const page = Math.max(0, Number.parseInt(String(search.page ?? "0"), 10) || 0);
  const [t, perPage, showAuthor] = await Promise.all([
    getTranslations("news"),
    getSetting("articles.perPage"),
    getSetting("articles.showAuthor"),
  ]);

  const kinds = ["NEWS", "ANALYSIS", "TRADE_IDEA"] as const;
  const [result, facets] = await Promise.all([
    getPublishedArticles(locale, {
      kinds: [...kinds],
      page,
      perPage: perPage ?? 12,
      tagId: view.id,
    }),
    getArticleFacets(locale, { kinds: [...kinds] }),
  ]);

  return (
    <main className="flex flex-col">
      <NewsMasthead
        eyebrow={t("tagArchive")}
        title={view.name}
        lead={t("topicsCount", { count: result.total })}
        crumbs={[{ label: t("title"), href: "/news" }, { label: view.name }]}
      />

      <ArticleListing
        locale={locale}
        heading={
          <SectionHeading
            eyebrow={t("latestEyebrow")}
            title={t("archiveLatestTitle", { name: view.name })}
          />
        }
        entries={result.entries}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
        paginationBasePath={`/news/tag/${slug}`}
        // An archive has no search of its own; the sidebar's box searches
        // the section, the way it does from an article page's trail.
        searchBasePath="/news"
        facets={facets}
        showKind
        showAuthor={showAuthor !== false}
        activeTagSlug={slug}
      />

      <ArchiveTaxonomy categories={facets.categories} tags={facets.tags} activeTagSlug={slug} />
    </main>
  );
}
