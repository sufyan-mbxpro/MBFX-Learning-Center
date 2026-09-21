// The glossary's right rail (changes-40).
//
// The owner asked for "news cards & tags cards on the right side of all the
// glossary pages", and the reason is a real one: the glossary is where a
// reader lands from a search engine, reads one definition, and leaves. It had
// no way onward except back up to the A–Z it came from.
//
// **It is the news sidebar's two panels, not a copy of them.**
// `LatestPostsPanel` and `PopularTagsPanel` live in the news folder because
// that is whose data they draw, and both surfaces import the same two — so a
// change to the cover fallback or the date format reaches both.
//
// **No category panel and no search box.** Those two belong to a listing: the
// search submits to `/news`, and a category list beside a definition offers a
// filter over articles the reader was not looking at. What survives is the
// half that reads as "here is more to read".
//
// **One cached read.** `loadArticleFacets` is the same cached function
// `/news` calls, tagged `content`, so a published article reaches the glossary
// rail and the news sidebar at the same moment — and costs the glossary no
// query of its own.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { ROUTE_PATHS } from "@repo/contracts";
import { getArticleFacets } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { RevealGroup } from "@repo/ui/components/reveal";
import { isFeatureVisible } from "@repo/settings";

import { LatestPostsPanel, PopularTagsPanel } from "../../news/_components/facet-panels.tsx";

export async function GlossarySidebar({ locale }: { locale: string }) {
  // The news flag, because every destination in this rail is a `/news` URL. A
  // rail of links to a section that 404s is worse than no rail (ADR-047 §2's
  // rule, applied to a whole component rather than to one band).
  if (!(await isFeatureVisible("news", null))) return null;

  const [t, facets] = await Promise.all([
    getTranslations("news"),
    // All three kinds: a reader here is being offered "something else to
    // read", and no reason to prefer a news item over an analysis piece.
    getArticleFacets(locale, { kinds: ["NEWS", "ANALYSIS", "TRADE_IDEA"], latestCount: 5 }),
  ]);

  // Nothing published: no rail, and the main column takes the width back —
  // the grid is `grid-cols-1` until `lg`, and an absent aside leaves one
  // track, not an empty one, because the aside is what declares the second.
  if (facets.latest.length === 0 && facets.tags.length === 0) return null;

  return (
    // Staggered in from the inline end like the news sidebar (changes-45);
    // the motion is on the panels, never on the sticky aside itself.
    <aside className="lg:sticky lg:top-(--header-offset) lg:self-start">
      <RevealGroup variant="end" step={80} className="flex flex-col gap-5">
        <LatestPostsPanel title={t("latestPosts")} entries={facets.latest} locale={locale} />
        <PopularTagsPanel title={t("popularTags")} tags={facets.tags} />
        <Button
          variant="outline"
          size="sm"
          className="group self-start"
          render={<Link href={ROUTE_PATHS.news} />}
        >
          {t("heroBrowse")}
          <ArrowRight data-icon="inline-end" aria-hidden className="hover-arrow rtl:rotate-180" />
        </Button>
      </RevealGroup>
    </aside>
  );
}
