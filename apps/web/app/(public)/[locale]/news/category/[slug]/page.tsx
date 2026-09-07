import type { Metadata } from "next";
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
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArchiveTaxonomy, TagChips } from "../../_components/archive-taxonomy.tsx";
import { ArticleCards } from "../../_components/article-list.tsx";
import { ListingCrumbs } from "../../_components/listing-crumbs.tsx";
import { NumberedPagination } from "../../_components/numbered-pagination.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news/category/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getArticleCategoryBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};
  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      articleCategoryPath(alt.locale, routing.defaultLocale, alt.slug),
    ]),
  );
  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.name),
    description: view.seoDescription ?? view.description ?? undefined,
    alternates: { languages },
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
      <Section tone="muted" spacing="sm">
        <Container className="flex flex-col items-center gap-3 text-center">
          <ListingCrumbs
            crumbs={[{ label: t("title"), href: "/news" }, { label: view.name }]}
            className="flex justify-center"
          />
          <p className="text-sm text-muted-foreground">{t("categoryArchive")}</p>
          <h1 className="text-display-sm font-semibold">{view.name}</h1>
          {view.description && (
            <p className="max-w-2xl text-muted-foreground">{view.description}</p>
          )}
          <Badge variant="pill">{t("topicsCount", { count })}</Badge>

          {/* The tags that occur IN this category, as a refinement row. Above
              the articles because it narrows what follows; the full taxonomy
              band at the foot of the page is for moving elsewhere entirely. */}
          {facets.tags.length > 0 && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("popularTags")}
              </p>
              <TagChips tags={facets.tags} />
            </div>
          )}
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="flex flex-col gap-8">
          <Reveal variant="up">
            <ArticleCards
              entries={result.entries}
              locale={locale}
              showKind
              showAuthor={showAuthor !== false}
            />
          </Reveal>
          <NumberedPagination
            basePath={`/news/category/${slug}`}
            page={page}
            pageCount={result.pageCount}
          />
        </Container>
      </Section>

      <ArchiveTaxonomy
        categories={facets.categories}
        tags={facets.tags}
        activeCategorySlug={slug}
      />
    </main>
  );
}
