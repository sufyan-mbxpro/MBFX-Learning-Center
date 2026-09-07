import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { publicArticleSearchSchema } from "@repo/contracts";
import {
  getArticleFacets,
  getCategoryDigests,
  getPublishedArticles,
  getSpotlightArticles,
} from "@repo/core";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { CtaBand } from "@repo/ui/components/cta-band";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { ArticleCards } from "./_components/article-list.tsx";
import { CategorySections } from "./_components/category-sections.tsx";
import { ArticleSidebar } from "./_components/article-sidebar.tsx";
import { NewsMasthead } from "./_components/news-masthead.tsx";
import { NewsSpotlight } from "./_components/news-spotlight.tsx";
import { NewsTopics } from "./_components/news-topics.tsx";
import { NewsletterForm } from "../_components/newsletter-form.tsx";
import { NumberedPagination } from "./_components/numbered-pagination.tsx";

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
// feeding the tiles AND the sidebar from one materialisation.
export async function generateMetadata({ params }: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("news"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("title")) };
}

/** The lead block's size — one large story plus two runners-up. */
const SPOTLIGHT_COUNT = 3;

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

  // Only the section FRONT gets the composed bands. Page 2 of an archive is
  // a different reading task — a reader who is paging has already chosen the
  // chronological feed — and a search is a third one again.
  const front = page === 0 && !q;

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
          // Three across on the widest track the container gives a full-width
          // band, so a row is never left with one orphan card.
          perCategory: 3,
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
      <NewsMasthead />

      {/* The lead block belongs to the section FRONT: page 2 of an archive is
          a different reading task, and repeating three stories the reader
          already scrolled past is noise. The ids stay excluded either way. */}
      {page === 0 && (
        <NewsSpotlight entries={spotlight} locale={locale} showAuthor={showAuthor !== false} />
      )}

      {/* `id` on the Section, not the heading: the masthead's "browse" action
          should land above the band rather than with its first row already
          scrolled off. */}
      {/* Muted only when the spotlight is above it — the band is there to
          separate the two, and with nothing above it the tone would just be
          the page's own background wearing a different name. */}
      <Section id="latest" spacing="md" tone={spotlight.length > 0 ? "muted" : "default"}>
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            {q ? (
              <p className="text-sm text-muted-foreground">
                {t("searchResults", { query: q, count: result.total })}
              </p>
            ) : (
              <SectionHeading
                eyebrow={t("latestEyebrow")}
                title={t("latestTitle")}
                lead={t("latestLead")}
              />
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

      <CategorySections digests={digests} locale={locale} showAuthor={showAuthor !== false} />

      <NewsTopics categories={facets.categories} />

      {newsletterEnabled && (
        <Section id="subscribe" spacing="sm">
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
