import type { Metadata } from "next";
import { listingMetadata, titleTemplate, titleFrom } from "../../../_lib/seo.ts";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { publicArticleSearchSchema } from "@repo/contracts";
import {
  getArticleFacets,
  getCategoryDigests,
  getPublishedArticles,
  getSpotlightArticles,
  isNewsletterPlacementEnabled,
} from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { ArticleListing } from "./_components/article-listing.tsx";
import { CategorySections } from "./_components/category-sections.tsx";
import { NewsMasthead } from "./_components/news-masthead.tsx";
import { NewsSpotlight } from "./_components/news-spotlight.tsx";
import { NewsTopics } from "./_components/news-topics.tsx";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { newsletterFormLabels } from "../_components/newsletter-labels.ts";
import { SIGNED_OUT_ONLY_CLASS } from "../../../_lib/session-hint.ts";

// ADR-042 (2026-09-07): the CMS switch that used to run ahead of this listing
// is gone. Plan v2.2 §12 PR 4.4 had made `/news` a COLLECTION page resolved by
// `resolveCollectionPage("news", …)`, with this coded listing as its fallback —
// so the cancelled Website Builder was serving the live listing with its admin
// UI permanently hidden. The Website Builder programme is cancelled (site
// design is code; only content data is dynamic), so the coded listing is the
// only path again. The `news-collection` CMS page rows are retained, not
// deleted (ADR-042 Decision #2) — they are simply no longer resolved here.
//
// Design pass 2026-09-07: the section front is a composed PAGE rather than a
// bare listing. Composition is fixed HERE, in code, per ADR-042; what is
// dynamic is the content flowing through it (which articles, which are
// Featured, which categories exist), never the arrangement.
//
// The page reads like a newspaper front, top to bottom:
//
//   masthead → spotlight (Featured first) → LATEST, all categories together
//   → one band PER CATEGORY, newest first → every topic as a tile → subscribe
//
// The general feed comes first because most readers arrive without a section
// in mind; the per-category bands come after, for the reader who only follows
// one of them. The tile band closes the page because it lists EVERY category,
// including those with too few articles to have earned a band of their own —
// which is why it is not a duplicate of the bands above it.
//
// Reads, all cached and all tagged `content`, so an editor's publish
// invalidates the whole page at once and no part of it can disagree with
// another: `getSpotlightArticles` for the lead block, `getPublishedArticles`
// for the paginated feed (excluding the spotlight's ids),
// `getCategoryDigests` for the per-category bands, and `getArticleFacets`
// feeding the tiles, the sidebar AND the masthead's tag row from one
// materialisation.
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("news"), titleTemplate()]);
  const search = await searchParams;
  const parsed = publicArticleSearchSchema.safeParse({ q: search.q, page: search.page });
  const { q, page = 0 } = parsed.success ? parsed.data : {};
  return {
    title: titleFrom(template, t("title")),
    description: t("latestLead"),
    ...listingMetadata(locale, "/news", page, q),
  };
}

/** The lead block's size — one large story plus three runners-up (changes-46). */
const SPOTLIGHT_COUNT = 4;

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

  const [t, tFooter, perPage, showAuthor, newsletterFlag, newsletterPlaced] = await Promise.all([
    getTranslations("news"),
    getTranslations("footer"),
    getSetting("articles.perPage"),
    getSetting("articles.showAuthor"),
    // Flag AND placement (ADR-080 #5) — the deleted `footer.newsletterEnabled`
    // conflated the two and lived in a group nobody could edit.
    isFeatureVisible("newsletter", null),
    isNewsletterPlacementEnabled("news"),
  ]);

  // A search is a different page: the reader asked a question, and a lead
  // block that ignores the question is furniture in the way of the answer.
  // With no spotlight there is also nothing to exclude, so a search sees the
  // complete result set.
  const [facets, candidates] = await Promise.all([
    getArticleFacets(locale, { kinds: ["NEWS"] }),
    q ? [] : getSpotlightArticles(locale, { kinds: ["NEWS"], limit: SPOTLIGHT_COUNT }),
  ]);

  // Every article has exactly one category, so the facet counts sum to the
  // visible total without a second count query.
  const totalVisible = facets.categories.reduce((sum, category) => sum + category.count, 0);

  // The spotlight has to leave something behind. Found on a real database
  // rather than in review: with two published articles the lead block took
  // both, the listing under it excluded both, and the page rendered a
  // full-width "Nothing published here yet" beneath three stories that were
  // plainly published. A section front with too little to say should just be
  // the list — so below the floor there is no spotlight and no exclusion, and
  // the same articles simply appear once, in the grid.
  const spotlight = totalVisible > SPOTLIGHT_COUNT ? candidates : [];
  const spotlightIds = spotlight.map((entry) => entry.articleId);

  // The composed bands render on EVERY page of the feed (changes-43). They
  // used to belong to page 1 only, so paging removed everything above the
  // grid and the page visibly rebuilt itself, which is the "reload" the owner
  // reported. Now a pager click changes the grid and nothing else. A search is
  // still a different page: the reader asked a question.
  const front = !q;

  const [result, digests] = await Promise.all([
    getPublishedArticles(locale, {
      kinds: ["NEWS"],
      page,
      perPage: perPage ?? 12,
      // Excluded on EVERY page of the run, not only the one that renders the
      // spotlight. Excluding on page 1 alone would shift the window under the
      // reader — page 2 would repeat rows page 1 had already pushed past —
      // because `total` and the offset are computed from the same `where`.
      // `getSpotlightArticles` is deterministic for a given content set,
      // which is what makes that safe.
      ...(spotlightIds.length > 0 ? { excludeIds: spotlightIds } : {}),
      ...(q ? { q } : {}),
    }),
    front
      ? getCategoryDigests(locale, {
          kinds: ["NEWS"],
          // Four across, matching the home page's platform cards (changes-36):
          // a full-width band draws `ArticleCards` four to a row, and a count
          // that fills exactly one row is never left with an orphan card.
          perCategory: 4,
          categoryLimit: 4,
          // NOT excluding the spotlight's ids here, unlike the general feed
          // above — and this one was decided at the browser, having been
          // written the other way first. Excluding them left bands rendering
          // two cards in a three-track grid, with the empty cell reading as a
          // loading failure. It also made the band lie: "Market News" that
          // silently omits the newest Market News story is not the section,
          // it is the section minus whatever the spotlight took.
          //
          // A story appearing in both Top stories and its own category band
          // is how a newspaper front works — the two say different things
          // about it. The general feed still excludes them, because there
          // "Latest news" sits directly under the block it would repeat.
        })
      : [],
  ]);

  return (
    <main className="flex flex-col">
      <NewsMasthead
        eyebrow={t("heroEyebrow")}
        title={t("title")}
        lead={t("intro")}
        crumbs={[{ label: t("title") }]}
      />

      {/* On every page of the feed (changes-43), so paging swaps the grid
          and leaves the page around it still. The ids stay excluded either
          way. */}
      {front && (
        <NewsSpotlight entries={spotlight} locale={locale} showAuthor={showAuthor !== false} />
      )}

      {/* Muted only when the spotlight is above it — the band is there to
          separate the two, and with nothing above it the tone would just be
          the page's own background wearing a different name. The band itself
          is `ArticleListing`, shared with /analysis and both archives. */}
      <ArticleListing
        locale={locale}
        tone={spotlight.length > 0 ? "muted" : "default"}
        heading={
          <SectionHeading
            eyebrow={t("latestEyebrow")}
            title={t("latestTitle")}
            lead={t("latestLead")}
          />
        }
        entries={result.entries}
        total={result.total}
        page={page}
        pageCount={result.pageCount}
        paginationBasePath="/news"
        searchBasePath="/news"
        query={q}
        facets={facets}
        showAuthor={showAuthor !== false}
      />

      <CategorySections digests={digests} locale={locale} showAuthor={showAuthor !== false} />

      <NewsTopics categories={facets.categories} />

      {newsletterFlag && newsletterPlaced && (
        <Section id="subscribe" spacing="sm" className={SIGNED_OUT_ONLY_CLASS}>
          <Reveal variant="up">
            <CtaBand title={t("subscribeTitle")} description={t("subscribeBody")}>
              <div className="w-full sm:w-80">
                <NewsletterForm
                  tone="onFill"
                  locale={locale}
                  source="news"
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
