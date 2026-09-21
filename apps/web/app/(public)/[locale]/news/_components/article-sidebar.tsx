// Listing sidebar (changes-03-plan.md §6.3, image-10.png): search,
// categories, latest posts and popular tags. All three facets come from ONE
// cached read (getArticleFacets) so they revalidate together with the
// articles they describe.
//
// The month archive the reference showed is GONE (changes-22). It listed
// months as plain text with a count and no destination — there is no
// `/news/archive/2026-09` route and never was — so it was a panel a reader
// could only look at. Removing it also removed the only facet query that had
// to scan every published row, which is why the facet itself went with it
// rather than being left computed and unread.
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import type { ArticleFacets } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { RevealGroup } from "@repo/ui/components/reveal";

import { LatestPostsPanel, Panel, PopularTagsPanel } from "./facet-panels.tsx";
import { ListingSearchForm, ListingSearchInput } from "./listing-navigation.tsx";

export async function ArticleSidebar({
  facets,
  locale,
  basePath,
  query,
  activeCategorySlug,
  activeTagSlug,
}: {
  facets: ArticleFacets;
  locale: string;
  /** Where the search form submits — /news or /analysis. */
  basePath: string;
  query?: string;
  /** On a category archive, that category's row is marked current, not linked. */
  activeCategorySlug?: string;
  /** On a tag archive, that tag's chip is marked current, not linked. */
  activeTagSlug?: string;
}) {
  const t = await getTranslations("news");

  return (
    // The panels arrive one after another from the inline end (changes-45),
    // the same stagger the listing's cards use. The ASIDE stays the sticky
    // element and carries no transform: a transform on a sticky box's own
    // element is how it stops sticking, so the motion is on its children.
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <RevealGroup variant="end" step={80} className="flex flex-col gap-5">
        {/* Still a GET form underneath: no JS needed, and the resulting URL is
          shareable and cacheable. With JS it navigates without reloading the
          document (changes-39). `q` is parsed server-side through
          publicArticleSearchSchema before it reaches @repo/core. */}
        <ListingSearchForm action={basePath} className="flex gap-2">
          {/* Controlled (changes-40). A soft navigation keeps this node
            mounted, so a changing `defaultValue` both warned and did nothing —
            see `ListingSearchInput`. */}
          <ListingSearchInput
            query={query}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="flex-1"
          />
          <Button type="submit" size="icon" aria-label={t("searchLabel")}>
            <Search aria-hidden className="size-4" />
          </Button>
        </ListingSearchForm>

        {facets.categories.length > 0 && (
          <Panel title={t("categories")}>
            <ul className="flex flex-col gap-2">
              {facets.categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-2">
                  {category.slug === activeCategorySlug ? (
                    // The archive being viewed is not a link to itself — the
                    // same rule `TagChips` follows, stated with aria-current so
                    // it is not purely visual.
                    <span aria-current="page" className="text-sm font-semibold text-foreground">
                      {category.name}
                    </span>
                  ) : (
                    <Link
                      href={`/news/category/${category.slug}`}
                      className="link-underline text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {category.name}
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">{category.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* Shared with the glossary's rail since changes-40 — one "Latest
          posts", one "Popular tags". */}
        <LatestPostsPanel title={t("latestPosts")} entries={facets.latest} locale={locale} />
        <PopularTagsPanel title={t("popularTags")} tags={facets.tags} activeSlug={activeTagSlug} />
      </RevealGroup>
    </aside>
  );
}
