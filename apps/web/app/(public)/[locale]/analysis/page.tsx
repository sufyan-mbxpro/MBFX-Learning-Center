import type { Metadata } from "next";
import { listingMetadata, titleTemplate, titleFrom } from "../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { publicArticleSearchSchema } from "@repo/contracts";
import { getArticleFacets, getPublishedArticles, isNewsletterPlacementEnabled } from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { ArchiveTaxonomy } from "../news/_components/archive-taxonomy.tsx";
import { ArticleListing } from "../news/_components/article-listing.tsx";
import { NewsMasthead } from "../news/_components/news-masthead.tsx";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { newsletterFormLabels } from "../_components/newsletter-labels.ts";
import { SIGNED_OUT_ONLY_CLASS } from "../../../_lib/session-hint.ts";
import { MarketNewsBand } from "./_components/market-news-band.tsx";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/analysis">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("news"), titleTemplate()]);
  const search = await searchParams;
  const parsed = publicArticleSearchSchema.safeParse({ q: search.q, page: search.page });
  const { q, page = 0 } = parsed.success ? parsed.data : {};
  return {
    title: titleFrom(template, t("analysisTitle")),
    description: t("analysisIntro"),
    ...listingMetadata(locale, "/analysis", page, q),
  };
}

// Analysis + trade ideas share one feed (ADR-015 #11); the detail pages
// live under /news/[slug] alongside the news kind.
//
// changes-38: the same shape as /news and both archives — `NewsMasthead`
// with the popular tags, then `ArticleListing` (cards beside the sidebar),
// then the taxonomy band the masthead's second action anchors to.
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

  const [t, tFooter, perPage, showAuthor, newsletterFlag, newsletterPlaced] = await Promise.all([
    getTranslations("news"),
    getTranslations("footer"),
    getSetting("articles.perPage"),
    getSetting("articles.showAuthor"),
    // Flag AND placement (ADR-080 #5) — the deleted `footer.newsletterEnabled`
    // conflated the two and lived in a group nobody could edit.
    isFeatureVisible("newsletter", null),
    isNewsletterPlacementEnabled("analysis"),
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
      <NewsMasthead
        eyebrow={t("analysisEyebrow")}
        title={t("analysisTitle")}
        lead={t("analysisIntro")}
        crumbs={[{ label: t("analysisTitle") }]}
        // The owner's own piece for this section (changes-40). /news keeps
        // the default.
        backdropSlot="analysisBanner"
      />

      <ArticleListing
        locale={locale}
        heading={
          <SectionHeading
            eyebrow={t("latestEyebrow")}
            title={t("analysisLatestTitle")}
            lead={t("analysisLatestLead")}
          />
        }
        entries={result.entries}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
        paginationBasePath="/analysis"
        searchBasePath="/analysis"
        query={q}
        facets={facets}
        showKind
        showAuthor={showAuthor !== false}
      />

      {/* The masthead's "Browse topics" anchor lands here, as it lands on
          `NewsTopics` on /news. */}
      <ArchiveTaxonomy categories={facets.categories} tags={facets.tags} />

      {/* The vendor's headline feed, after our own analysis (ADR-136 §6). */}
      <MarketNewsBand locale={locale} />

      {newsletterFlag && newsletterPlaced && (
        <Section spacing="sm" className={SIGNED_OUT_ONLY_CLASS}>
          <Reveal variant="up">
            <CtaBand title={t("subscribeTitle")} description={t("subscribeBody")}>
              <div className="w-full sm:w-80">
                <NewsletterForm
                  tone="onFill"
                  locale={locale}
                  source="analysis"
                  labels={newsletterFormLabels(tFooter)}
                />
              </div>
            </CtaBand>
          </Reveal>
        </Section>
      )}
    </main>
  );
}
