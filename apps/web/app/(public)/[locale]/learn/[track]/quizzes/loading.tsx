// The quiz index's loading skeleton (design pass 2026-09-09).
//
// Its own file rather than inheriting `learn/loading.tsx`, for the reason that
// file's own header gives: one shared skeleton across differently shaped
// routes is a guaranteed jump on all but one of them. This page opens with a
// masthead and a three-across grid of PORTRAIT cards; the learn index opens
// with the same masthead over a two-across grid of landscape ones.
//
// It mirrors the real layout's proportions rather than showing a spinner: a
// skeleton that matches what arrives keeps the page from moving when it does.
// The section tab strip is NOT skeletoned — it lives in the layout, which
// renders before this boundary, so it is already on screen.
//
// `shimmer` layers a directional sweep over Skeleton's own pulse
// (globals.css). Both are inside the reduced-motion guarantee: a visitor who
// asked for less motion gets plain tinted blocks, not stilled ones.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function QuizIndexLoading() {
  return (
    <div aria-hidden>
      {/* The masthead. */}
      <Section spacing="lg" className="bg-muted/60">
        <Container className="flex flex-col gap-5">
          <Skeleton className="shimmer h-4 w-24" />
          <Skeleton className="shimmer h-12 w-full max-w-2xl" />
          <Skeleton className="shimmer h-6 w-full max-w-xl" />
          <div className="pt-1">
            <Skeleton className="shimmer h-12 w-44 rounded-full" />
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
                <Skeleton className="shimmer h-8 w-16" />
                <Skeleton className="shimmer h-4 w-24" />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* The category chip row, then the grid. The sign-in prompt above them
          is deliberately absent: it renders nothing until it knows whether the
          reader has an account, so a placeholder for it would promise a band
          that most readers never see. */}
      <Section spacing="md">
        <Container className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="shimmer h-8 w-28 rounded-full" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <QuizCardSkeleton key={index} />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}

/** The card's own anatomy — a 16:9 panel over a copy column that ends in the
 * score meter and its CTA. */
function QuizCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl bg-card ring-1 ring-foreground/10">
      <Skeleton className="shimmer aspect-video w-full rounded-t-2xl" />
      <div className="flex flex-col gap-2.5 p-5">
        <Skeleton className="shimmer h-5 w-40" />
        <Skeleton className="shimmer h-4 w-full" />
        <Skeleton className="shimmer h-4 w-2/3" />
        <div className="flex flex-col gap-1.5 pt-3">
          <div className="flex justify-between gap-3">
            <Skeleton className="shimmer h-3 w-20" />
            <Skeleton className="shimmer h-3 w-10" />
          </div>
          <Skeleton className="shimmer h-2 w-full rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Skeleton className="shimmer h-3 w-16" />
          <Skeleton className="shimmer h-8 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
