import type { Metadata } from "next";
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
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArchiveTaxonomy } from "../../_components/archive-taxonomy.tsx";
import { ArticleCards } from "../../_components/article-list.tsx";
import { ListingCrumbs } from "../../_components/listing-crumbs.tsx";
import { NumberedPagination } from "../../_components/numbered-pagination.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/news/tag/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getArticleTagBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};
  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      articleTagPath(alt.locale, routing.defaultLocale, alt.slug),
    ]),
  );
  return { title: (template ?? "%s").replace("%s", view.name), alternates: { languages } };
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
      <Section tone="muted" spacing="sm">
        <Container className="flex flex-col items-center gap-3 text-center">
          <ListingCrumbs
            crumbs={[{ label: t("title"), href: "/news" }, { label: view.name }]}
            className="flex justify-center"
          />
          <p className="text-sm text-muted-foreground">{t("tagArchive")}</p>
          <h1 className="text-display-sm font-semibold">{view.name}</h1>
          <Badge variant="pill">{t("topicsCount", { count: result.total })}</Badge>
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
            basePath={`/news/tag/${slug}`}
            page={page}
            pageCount={result.pageCount}
          />
        </Container>
      </Section>

      <ArchiveTaxonomy categories={facets.categories} tags={facets.tags} activeTagSlug={slug} />
    </main>
  );
}
