// The route-level pending state for the news section.
//
// Next applies a segment's loading.tsx to every route beneath it, so this
// covers /news, /news/category/* and /news/tag/* — all three open with a
// band, then a grid beside a sidebar, which is what this mirrors. The
// article DETAIL page has a different shape and brings its own
// `[slug]/loading.tsx`, which overrides this one for that segment.
//
// A skeleton of the real proportions, not a spinner: the page it is standing
// in for arrives in the same boxes, so nothing jumps when it does. The
// site-wide `SiteLoader` overlay (ADR-018 rule 4) is a different thing
// entirely — that one is a first-visit brand moment, this is what the reader
// sees on every navigation into the section, which is why it is a layout and
// not a logo.
//
// `aria-hidden` on the whole tree: it is decorative furniture, and Next's
// own navigation announcement already tells a screen reader the page is
// loading. Announcing forty empty boxes on top of that is noise.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      {/* 16/9, the ratio ArticleMedia gives a standard card — a skeleton at
          the wrong ratio is a layout shift with extra steps. */}
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-2 p-5 pt-0">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
    </div>
  );
}

export default function NewsLoading() {
  return (
    <div aria-hidden>
      {/* The masthead band. */}
      <Section spacing="lg" tone="inverted">
        <Container className="flex flex-col gap-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-44 rounded-full" />
            <Skeleton className="h-11 w-40 rounded-full" />
          </div>
        </Container>
      </Section>

      {/* The stat band. */}
      <Section spacing="sm" tone="muted">
        <Container className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </Container>
      </Section>

      {/* The spotlight: lead story beside two runners-up. */}
      <Section spacing="md">
        <Container className="flex flex-col gap-8">
          <Skeleton className="h-9 w-64" />
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="flex flex-col gap-3 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="flex flex-col gap-3 p-6 pt-0">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div
                  key={index}
                  className="flex flex-1 items-start gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
                >
                  <Skeleton className="aspect-[4/3] w-28 shrink-0 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* The listing: grid beside the facet sidebar. */}
      <Section spacing="md">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
            <div className="flex justify-center gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="size-9 rounded-md" />
              ))}
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
