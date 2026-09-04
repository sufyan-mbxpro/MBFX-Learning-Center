import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { publicArticleSearchSchema } from "@repo/contracts";
import { getArticleFacets, getPublishedArticles } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { ArticleCards } from "../news/_components/article-list.tsx";
import { ArticleSidebar } from "../news/_components/article-sidebar.tsx";
import { ListingHeader } from "../news/_components/listing-header.tsx";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { NumberedPagination } from "../news/_components/numbered-pagination.tsx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/analysis">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("news"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("analysisTitle")) };
}

// Analysis + trade ideas share one feed (ADR-015 #11); the detail pages
// live under /news/[slug] alongside the news kind.
export default async function AnalysisPage({
  params,
  searchParams,
}: PageProps<"/[locale]/analysis">) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!(await isFeatureVisible("analysis", null))) notFound();

  // Parsed, not cast (security.md #6) — same treatment as /news.
  const search = await searchParams;
  const parsed = publicArticleSearchSchema.safeParse({ q: search.q, page: search.page });
  const { q, page = 0 } = parsed.success ? parsed.data : {};

  const [t, tFooter, perPage, showAuthor, newsletterEnabled] = await Promise.all([
    getTranslations("news"),
    getTranslations("footer"),
    getSetting("articles.perPage"),
    getSetting("articles.showAuthor"),
    getSetting("footer.newsletterEnabled"),
  ]);
  const kinds = ["ANALYSIS", "TRADE_IDEA"] as const;

  const [result, facets] = await Promise.all([
    getPublishedArticles(locale, {
      kinds: [...kinds],
      page,
      perPage: perPage ?? 12,
      ...(q ? { q } : {}),
    }),
    getArticleFacets(locale, { kinds: [...kinds] }),
  ]);

  return (
    <main className="flex flex-col">
      <ListingHeader
        title={t("analysisTitle")}
        intro={t("analysisIntro")}
        crumbs={[{ label: t("analysisTitle") }]}
      />

      <Section spacing="md">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            {q && (
              <p className="text-sm text-muted-foreground">
                {t("searchResults", { query: q, count: result.total })}
              </p>
            )}
            <Reveal variant="up">
              <ArticleCards
                entries={result.entries}
                locale={locale}
                showKind
                variant="standard"
                showAuthor={showAuthor !== false}
              />
            </Reveal>
            <NumberedPagination
              basePath="/analysis"
              page={page}
              pageCount={result.pageCount}
              query={q}
            />
          </div>
          <ArticleSidebar facets={facets} locale={locale} basePath="/analysis" query={q} />
        </Container>
      </Section>

      {newsletterEnabled && (
        <Section spacing="sm">
          <Reveal variant="up">
            <CtaBand title={t("subscribeTitle")} description={t("subscribeBody")}>
              <div className="w-full sm:w-80">
                <NewsletterForm
                  tone="onFill"
                  id="listing-newsletter"
                  placeholder={tFooter("newsletterPlaceholder")}
                  label={tFooter("newsletterLabel")}
                  submitLabel={tFooter("newsletterSubmit")}
                  unavailableLabel={tFooter("newsletterUnavailable")}
                />
              </div>
            </CtaBand>
          </Reveal>
        </Section>
      )}
    </main>
  );
}
