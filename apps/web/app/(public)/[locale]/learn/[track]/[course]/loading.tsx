// The COURSE page's loading skeleton (design pass 2026-09-09).
//
// Its own file rather than the area-wide one, because the two layouts no
// longer rhyme: this route opens with a wide header image over a two-column
// grid whose right column is a sticky card, and the index opens with a
// masthead over a stat strip. Reusing one skeleton across both would move the
// page on arrival at exactly the moment the reader is deciding whether to
// stay.
//
// Only the LAYOUT is claimed here. Nothing in a skeleton should imply a fact
// the page might not have — no counts, no level, no title width that suggests
// a particular course.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function CourseLoading() {
  return (
    <div aria-hidden>
      <Section spacing="sm" tone="muted">
        <Container className="flex flex-col gap-5">
          <Skeleton className="shimmer h-4 w-40" />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-4">
              <Skeleton className="shimmer aspect-[16/6] w-full rounded-2xl" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="shimmer h-5 w-24 rounded-full" />
                <Skeleton className="shimmer h-5 w-20 rounded-full" />
                <Skeleton className="shimmer h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="shimmer h-10 w-full max-w-lg" />
              <Skeleton className="shimmer h-6 w-full max-w-md" />
            </div>

            {/* The sticky rail: progress bar, CTA, then the meta list. */}
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
              <Skeleton className="shimmer h-2 w-full rounded-full" />
              <Skeleton className="shimmer h-11 w-full rounded-md" />
              <div className="flex flex-col gap-2 border-t pt-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <Skeleton className="shimmer h-4 w-24" />
                    <Skeleton className="shimmer h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-4">
            <Skeleton className="shimmer h-7 w-40" />
            <Skeleton className="shimmer h-4 w-64" />
            {/* Curriculum sections, each a header over a few lesson rows. */}
            {Array.from({ length: 3 }, (_, section) => (
              <div key={section} className="flex flex-col gap-2 rounded-xl border p-4">
                <Skeleton className="shimmer h-5 w-52" />
                {Array.from({ length: 3 }, (_, row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="shimmer size-6 rounded-full" />
                    <Skeleton className="shimmer h-4 flex-1 max-w-sm" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            <Skeleton className="shimmer h-40 w-full rounded-2xl" />
            <Skeleton className="shimmer h-64 w-full rounded-2xl" />
          </div>
        </Container>
      </Section>
    </div>
  );
}
