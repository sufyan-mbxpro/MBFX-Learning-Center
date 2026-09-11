// The Learn INDEX's loading skeleton (design pass 2026-09-09).
//
// It used to be one skeleton for the whole area, because the index, course and
// lesson pages all opened with the same muted header over a content column.
// They no longer do — the index has a masthead and a stat strip, the course
// page has a two-column header with a sticky rail — so each route now owns the
// skeleton that matches it (`[course]/loading.tsx`, `[course]/[lesson]/`).
// One shared skeleton across three different layouts is a guaranteed jump on
// two of them.
//
// It mirrors the real layout's proportions rather than showing a spinner: a
// skeleton that matches what arrives keeps the page from moving when it does.
// The section tab strip is NOT skeletoned — it lives in the layout, which
// renders before this boundary, so it is already on screen.
//
// `shimmer` layers a directional sweep over Skeleton's own pulse (globals.css).
// Both are inside the reduced-motion guarantee: a visitor who asked for less
// motion gets plain tinted blocks, not stilled ones.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function LearnLoading() {
  return (
    <div aria-hidden>
      {/* The masthead. Taller and darker than the old header band, because
          that is what lands here. */}
      <Section spacing="lg" className="bg-muted/60">
        <Container className="flex flex-col gap-5">
          <Skeleton className="shimmer h-4 w-20" />
          <Skeleton className="shimmer h-12 w-full max-w-2xl" />
          <Skeleton className="shimmer h-6 w-full max-w-xl" />
          <div className="flex flex-wrap gap-3 pt-1">
            <Skeleton className="shimmer h-12 w-44 rounded-full" />
            <Skeleton className="shimmer h-12 w-36 rounded-full" />
          </div>
        </Container>
      </Section>

      {/* The counted-figures strip. */}
      <Section spacing="sm" tone="muted">
        <Container>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="shimmer size-10 rounded-full" />
                <Skeleton className="shimmer h-8 w-20" />
                <Skeleton className="shimmer h-4 w-24" />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* The filter toolbar. */}
      <Section spacing="sm">
        <Container className="flex flex-col gap-4">
          <Skeleton className="shimmer h-[4.5rem] w-full rounded-2xl" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="shimmer h-8 w-24 rounded-full" />
            ))}
          </div>
        </Container>
      </Section>

      {/* One track band of cards, in the shelf's own two-across grid. */}
      <Section spacing="md">
        <Container className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="shimmer h-9 w-48" />
            <Skeleton className="shimmer h-5 w-full max-w-lg" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}

/** The card's own anatomy — square cover beside a copy column from sm. */
function CourseCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card ring-1 ring-foreground/10 sm:flex-row">
      <Skeleton className="shimmer aspect-video w-full rounded-t-2xl sm:aspect-square sm:w-44 sm:rounded-s-2xl sm:rounded-e-none" />
      <div className="flex flex-1 flex-col gap-2.5 p-4 ps-0 max-sm:ps-4 max-sm:pt-0">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="shimmer h-5 w-40" />
          <Skeleton className="shimmer h-8 w-20 rounded-md" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="shimmer h-5 w-20 rounded-full" />
          <Skeleton className="shimmer h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="shimmer h-4 w-full" />
        <Skeleton className="shimmer h-4 w-3/4" />
      </div>
    </div>
  );
}
