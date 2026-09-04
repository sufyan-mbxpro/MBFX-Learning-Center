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
import { ArticleCards } from "./_components/article-list.tsx";
import { ArticleSidebar } from "./_components/article-sidebar.tsx";
import { ListingHeader } from "./_components/listing-header.tsx";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { NumberedPagination } from "./_components/numbered-pagination.tsx";

export async function generateMetadata({ params }: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("news"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("title")) };
}

export default async function NewsPage({ params, searchParams }: PageProps<"/[locale]/news">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Disabled feature → 404, not a blank page (ADR-015 #7: the news flag IS
  // the module switch).
  if (!(await isFeatureVisible("news", null))) notFound();

  // security.md #6 — searchParams are untrusted input, so `q`/`page` are
  // PARSED, never cast. A malformed value degrades to the unfiltered first
  // page rather than 500-ing the listing.
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

  const [result, facets] = await Promise.all([
    getPublishedArticles(locale, {
      kinds: ["NEWS"],
      page,
      perPage: perPage ?? 12,
      ...(q ? { q } : {}),
    }),
    getArticleFacets(locale, { kinds: ["NEWS"] }),
  ]);

  return (
    <main className="flex flex-col">
      <ListingHeader title={t("title")} intro={t("intro")} crumbs={[{ label: t("title") }]} />

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
                variant="standard"
                showAuthor={showAuthor !== false}
              />
            </Reveal>
            <NumberedPagination
              basePath="/news"
              page={page}
              pageCount={result.pageCount}
              query={q}
            />
          </div>
          <ArticleSidebar facets={facets} locale={locale} basePath="/news" query={q} />
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
