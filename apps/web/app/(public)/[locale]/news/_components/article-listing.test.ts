// changes-38 — "the symmetry should be followed on all news, analysis & tags".
//
// The tag and category archives had drifted to a full-width grid with no
// sidebar and a plain header, because each listing page composed its own
// band. The fix is one masthead and one listing band shared by all four; this
// guard is what keeps a fifth hand-rolled copy from coming back.
//
// Read as source: the pages are async server components awaiting cached
// @repo/core reads, and the property under test is composition.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "app/(public)/[locale]");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

const LISTING_PAGES = [
  "news/page.tsx",
  "analysis/page.tsx",
  "news/tag/[slug]/page.tsx",
  "news/category/[slug]/page.tsx",
];

describe("every article listing shares one shape", () => {
  it.each(LISTING_PAGES)("%s opens on NewsMasthead", (page) => {
    const source = read(page);
    expect(source).toContain("<NewsMasthead");
    expect(source).not.toContain("<ListingHeader");
  });

  it.each(LISTING_PAGES)("%s renders the listing band with the sidebar", (page) => {
    const source = read(page);
    expect(source).toContain("<ArticleListing");
    // The band owns the grid and the sidebar; a page composing its own is
    // how the archives lost the sidebar in the first place.
    expect(source).not.toContain("<ArticleSidebar");
    expect(source).not.toContain("<ArticleCards");
  });

  it.each(LISTING_PAGES)("%s has a #topics band for the masthead's second action", (page) => {
    expect(read(page)).toMatch(/<NewsTopics|<ArchiveTaxonomy/);
  });

  it("marks the current tag and category", () => {
    expect(read("news/tag/[slug]/page.tsx")).toMatch(/activeTagSlug=\{slug\}/);
    expect(read("news/category/[slug]/page.tsx")).toMatch(/activeCategorySlug=\{slug\}/);
  });
});

describe("the shared pieces", () => {
  const listing = read("news/_components/article-listing.tsx");
  const masthead = read("news/_components/news-masthead.tsx");
  const sidebar = read("news/_components/article-sidebar.tsx");
  const taxonomy = read("news/_components/archive-taxonomy.tsx");

  it("the listing band carries the anchor and the sidebar", () => {
    expect(listing).toContain('id="latest"');
    expect(listing).toContain("<ArticleSidebar");
    expect(listing).toContain("grid grid-cols-1");
  });

  // changes-47: the banner carries no tags and is a notch shorter. The
  // sidebar's panel and the closing #topics band already list them.
  it("the masthead is medium height and draws no tag row", () => {
    expect(masthead).toContain('size="medium"');
    expect(masthead).not.toContain("<TagChips");
    expect(masthead).not.toContain("masthead-tags");
  });

  it("both masthead anchors have a target on every listing", () => {
    expect(masthead).toContain('href="#latest"');
    expect(masthead).toContain('href="#topics"');
    expect(taxonomy).toContain('id="topics"');
  });

  it("the sidebar marks the current category and tag", () => {
    expect(sidebar).toContain("activeCategorySlug");
    // The chips reach `TagChips` through `PopularTagsPanel` since changes-40,
    // which the glossary rail draws too. What matters here is unchanged: the
    // tag being viewed is forwarded so it renders as the current chip.
    expect(sidebar).toMatch(
      /<PopularTagsPanel[\s\S]*?tags=\{facets\.tags}[\s\S]*?activeSlug=\{activeTagSlug}/,
    );
    expect(sidebar).toContain('aria-current="page"');
  });
});

// changes-39 — "the filter & pagination should not reload the page". Paging was
// a soft navigation that jumped to the top with no feedback, and the search
// box was a plain `<form>`, i.e. a real document reload.
describe("the listing band navigates in place", () => {
  const listing = read("news/_components/article-listing.tsx");
  const pager = read("news/_components/numbered-pagination.tsx");
  const sidebar = read("news/_components/article-sidebar.tsx");
  const navigation = read("news/_components/listing-navigation.tsx");

  it("wraps the band in the provider and dims only the cards", () => {
    expect(listing).toContain("<ListingNavigationProvider>");
    expect(listing).toMatch(/<ListingPendingRegion[\s\S]*<ArticleCards/);
  });

  it("pages through ListingLink, never a bare Link", () => {
    expect(pager).toContain("render={<ListingLink");
    expect(pager).not.toContain("<Link ");
  });

  it("searches through ListingSearchForm, never a plain form", () => {
    expect(sidebar).toContain("<ListingSearchForm");
    expect(sidebar).not.toMatch(/<form[\s>]/);
  });

  it("keeps the scroll position and returns to the band", () => {
    expect(navigation).toContain("scroll: false");
    expect(navigation).toContain("startTransition");
    expect(navigation).toContain('LISTING_ANCHOR = "latest"');
  });
});

// changes-45 — "show the specific section loader as well when filters anything
// or pagination applying.. should be smooth appearance of the data".
describe("the results section shows its own pending state", () => {
  const listing = read("news/_components/article-listing.tsx");
  const navigation = read("news/_components/listing-navigation.tsx");
  const loading = read("news/loading.tsx");

  it("the region wraps the cards only, never the sidebar or the pager", () => {
    const region = listing.slice(
      listing.indexOf("<ListingPendingRegion"),
      listing.indexOf("</ListingPendingRegion>"),
    );
    expect(region).toContain("<ArticleCards");
    expect(region).not.toContain("<ArticleSidebar");
    expect(region).not.toContain("<NumberedPagination");
  });

  it("is busy, draws the progress line and lays placeholder cards over the results", () => {
    expect(navigation).toContain("aria-busy={pending || undefined}");
    expect(navigation).toContain("progress-sweep");
    expect(navigation).toContain('role="status"');
    expect(listing).toContain("skeleton={<ArticleCardsSkeleton");
  });

  it("keys the results so a new page mounts fresh and rises in, with travel behind motion-safe", () => {
    expect(navigation).toContain("key={resultsKey}");
    expect(listing).toMatch(/resultsKey=\{`\$\{page\}:\$\{query \?\? ""\}`\}/);
    expect(navigation).toContain("motion-safe:slide-in-from-bottom-4");
    expect(navigation).not.toMatch(/(?<!motion-safe:)slide-in-from/);
  });

  it("the route skeleton and the pending state draw the same placeholder card", () => {
    expect(loading).toContain("<ArticleCardSkeleton");
    expect(loading).not.toContain("function CardSkeleton");
  });
});
