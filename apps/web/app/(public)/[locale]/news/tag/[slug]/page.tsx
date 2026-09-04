import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { articleTagPath, getArticleTagBySlug, getPublishedArticles, getRedirect } from "@repo/core";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArticleCards } from "../../_components/article-list.tsx";
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
  const [t, perPage] = await Promise.all([getTranslations("news"), getSetting("articles.perPage")]);

  const result = await getPublishedArticles(locale, {
    kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"],
    page,
    perPage: perPage ?? 12,
    tagId: view.id,
  });

  return (
    <main className="flex flex-col">
      <Section tone="muted" spacing="sm">
        <Container className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">{t("tagArchive")}</p>
          <h1 className="text-display-sm font-semibold">{view.name}</h1>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="flex flex-col gap-8">
          <Reveal variant="up">
            <ArticleCards entries={result.entries} locale={locale} showKind />
          </Reveal>
          <NumberedPagination
            basePath={`/news/tag/${slug}`}
            page={page}
            pageCount={result.pageCount}
          />
        </Container>
      </Section>
    </main>
  );
}
