// Placeholders for `ArticleCards`' standard card, shared by the section's
// route skeleton (`news/loading.tsx`) and the listing's in-place pending state
// (changes-45, `ListingPendingRegion`). One definition, so the card a reader
// sees while the next page loads is the card the route skeleton draws.
//
// Decorative: every caller renders these under `aria-hidden` — the region's
// `aria-busy` is what tells assistive technology that results are changing.
import { Skeleton, SkeletonCard } from "@repo/ui/components/skeleton";

import { ARTICLE_CARDS_STANDARD_GRID } from "./article-list.tsx";

/** A standard ArticleCards card: `Card`'s shell (changes-20 Phase 5) with a
 * flush cover — the ratio ArticleMedia gives it, so the swap is a fill. */
export function ArticleCardSkeleton() {
  return (
    <SkeletonCard media="video">
      <Skeleton className="h-5 w-24 rounded-md" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-32" />
    </SkeletonCard>
  );
}

/**
 * A grid of card placeholders laid out with `ArticleCards`' OWN standard
 * grid classes — inside the same `@container` wrapper — so each placeholder
 * lands over the card it stands in for, at every width.
 */
export function ArticleCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="@container">
      <div className={ARTICLE_CARDS_STANDARD_GRID}>
        {Array.from({ length: count }, (_, index) => (
          <ArticleCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
