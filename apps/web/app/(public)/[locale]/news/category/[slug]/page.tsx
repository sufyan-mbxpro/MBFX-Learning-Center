import type { Metadata } from "next";
import { alternatesFor, descriptionFrom, pagedCanonical } from "../../../../../_lib/seo.ts";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  articleCategoryPath,
  getArticleCategoryBySlug,
  getArticleFacets,
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
}: PageProps<"/[locale]/news/category/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const search = await searchParams;
  const page = Math.max(0, Number.parseInt(String(search.page ?? "0"), 10) || 0);
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getArticleCategoryBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};
  const alternates = await alternatesFor({
    canonical: pagedCanonical(articleCategoryPath(locale, routing.defaultLocale, slug), page),
    languages: view.alternates.map((alt) => ({
      locale: alt.locale,
      href: articleCategoryPath(alt.locale, routing.defaultLocale, alt.slug),
    })),
  });
  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.name),
    ...descriptionFrom(view.seoDescription, view.description),
    alternates,
  };
}

// The category archive (design pass 2026-09-07). It is no longer a bare grid
// that dead-ends at its last article: the header carries the trail and the
// count, the tags OF THIS CATEGORY sit under it as a refinement row, and the
// section's whole taxonomy closes the page so a reader can move sideways
// without going back to /news.
//
// Facets are read with this category's id, which scopes `tags` to what
// actually occurs here while leaving the category counts global — see
// `ArticleFacetOptions`. One cached read serves both the chips and the band.
//
// changes-38: the refinement row moved INTO the masthead (`NewsMasthead`'s
// tag chips; changes-47 took them back out — the sidebar's panel and the
// closing band already list them), and the listing is `ArticleListing` with the sidebar beside it,
// this category marked current — the same shape as /news, /analysis and the
// tag archive.
export default async function ArticleCategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/news/category/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("news", null))) notFound();

  const view = await getArticleCategoryBySlug(locale, slug);
  if (!view) {
    const target = await getRedirect(articleCategoryPath(locale, routing.defaultLocale, slug));
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
      categoryId: view.id,
    }),
    getArticleFacets(locale, { kinds: [...kinds], categoryId: view.id }),
  ]);

  const count = facets.categories.find((category) => category.slug === slug)?.count ?? result.total;

  return (
    <main className="flex flex-col">
      {/* The category's own description is its lead when it has one; the
          count stands in otherwise, so the banner always says something the
          title does not. */}
      <NewsMasthead
        eyebrow={t("categoryArchive")}
        title={view.name}
        lead={view.description ?? t("topicsCount", { count })}
        crumbs={[{ label: t("title"), href: "/news" }, { label: view.name }]}
      />

      <ArticleListing
        locale={locale}
        heading={
          <SectionHeading
            eyebrow={t("latestEyebrow")}
            title={t("archiveLatestTitle", { name: view.name })}
            lead={view.description ? t("topicsCount", { count }) : undefined}
          />
        }
        entries={result.entries}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
        paginationBasePath={`/news/category/${slug}`}
        // An archive has no search of its own; the sidebar's box searches
        // the section.
        searchBasePath="/news"
        facets={facets}
        showKind
        showAuthor={showAuthor !== false}
        activeCategorySlug={slug}
      />

      <ArchiveTaxonomy
        categories={facets.categories}
        tags={facets.tags}
        activeCategorySlug={slug}
      />
    </main>
  );
}
