// Pending state for a single article, overriding the section's listing
// skeleton for this segment — the two pages share a section but not a shape,
// and a grid of card outlines standing in for a page of prose is worse than
// no skeleton at all.
//
// Mirrors the detail page's real proportions: the title band, then the
// cover, the meta row, the body column and the facet sidebar.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function ArticleLoading() {
  return (
    <div aria-hidden>
      <Section tone="muted" spacing="sm">
        <Container className="flex flex-col items-center gap-3">
          <Skeleton className="h-9 w-full max-w-2xl" />
          <Skeleton className="h-4 w-56" />
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-6">
            <Skeleton className="aspect-video w-full rounded-lg" />

            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Uneven widths on the last line of each block: a stack of
                identical full-width bars reads as a table, not as prose. */}
            <div className="flex flex-col gap-3">
              {["w-full", "w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-full", "w-2/3"].map(
                (width, index) => (
                  <Skeleton key={index} className={`h-4 ${width}`} />
                ),
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Skeleton className="h-9 w-full rounded-md" />
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-52 w-full rounded-xl" />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
