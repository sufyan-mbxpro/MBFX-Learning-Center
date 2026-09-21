// The `#latest` band every article listing shares (changes-38): the cards and
// the pager in the main column, `ArticleSidebar` beside them.
//
// /news, /analysis, /news/category/* and /news/tag/* each composed this grid
// by hand until the tag and category archives dropped the sidebar and went
// full width — so a reader who clicked a tag lost search, the category rail
// and the tag cloud at exactly the moment they had shown they wanted to
// browse. One component is how the four stay the same shape; what differs
// between them (the heading, the pager's base path, which facet is current)
// is a prop.
//
// The `id` is load-bearing: `NewsMasthead`'s "Read the latest" action
// anchors to it on every listing.
import { getTranslations } from "next-intl/server";

import type { ArticleFacets, ArticleListEntry } from "@repo/core";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";

import { ArticleCardsSkeleton } from "./article-card-skeleton.tsx";
import { ArticleCards } from "./article-list.tsx";
import { ArticleSidebar } from "./article-sidebar.tsx";
import { ListingNavigationProvider, ListingPendingRegion } from "./listing-navigation.tsx";
import { NumberedPagination } from "./numbered-pagination.tsx";

export async function ArticleListing({
  locale,
  heading,
  entries,
  total,
  page,
  pageCount,
  paginationBasePath,
  searchBasePath,
  query,
  facets,
  showKind = false,
  showAuthor,
  tone = "default",
  activeCategorySlug,
  activeTagSlug,
}: {
  locale: string;
  /** Rendered above the cards when the reader is not searching. */
  heading: React.ReactNode;
  entries: ArticleListEntry[];
  total: number;
  page: number;
  pageCount: number;
  /** Where the pager's links point — the page's own path. */
  paginationBasePath: string;
  /** Where the sidebar's search submits — /news or /analysis. */
  searchBasePath: string;
  query?: string;
  facets: ArticleFacets;
  showKind?: boolean;
  showAuthor: boolean;
  tone?: "default" | "muted";
  activeCategorySlug?: string;
  activeTagSlug?: string;
}) {
  const t = await getTranslations("news");

  return (
    <Section id="latest" spacing="md" tone={tone} className="scroll-mt-(--header-offset)">
      {/* Paging and searching swap this band in place (changes-39) — see
          `listing-navigation.tsx`. The provider renders no element, so the
          grid's two columns are still the Container's direct children. */}
      <ListingNavigationProvider>
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-(--grid-main-aside)">
          <div className="flex min-w-0 flex-col gap-8">
            {query ? (
              <p className="text-sm text-muted-foreground">
                {t("searchResults", { query, count: total })}
              </p>
            ) : (
              heading
            )}
            {/* The band's scroll reveal stays OUTSIDE the region, so it is
                not remounted by each new page of results — the region plays
                its own arrival (changes-45). */}
            <Reveal variant="up">
              <ListingPendingRegion
                resultsKey={`${page}:${query ?? ""}`}
                busyLabel={t("loadingResults")}
                skeleton={<ArticleCardsSkeleton count={Math.max(3, entries.length)} />}
              >
                <ArticleCards
                  entries={entries}
                  locale={locale}
                  variant="standard"
                  showKind={showKind}
                  showAuthor={showAuthor}
                />
              </ListingPendingRegion>
            </Reveal>
            <NumberedPagination
              basePath={paginationBasePath}
              page={page}
              pageCount={pageCount}
              query={query}
            />
          </div>
          <ArticleSidebar
            facets={facets}
            locale={locale}
            basePath={searchBasePath}
            query={query}
            activeCategorySlug={activeCategorySlug}
            activeTagSlug={activeTagSlug}
          />
        </Container>
      </ListingNavigationProvider>
    </Section>
  );
}
