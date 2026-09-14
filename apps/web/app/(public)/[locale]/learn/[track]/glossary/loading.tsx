// The track glossary's pending shape (changes-21 Phase A). Without it this
// route inherited `learn/loading.tsx` — a masthead over a shelf of course
// cards standing in for a filtered list of terms.
//
// It mirrors the page: the muted header band (school eyebrow, title, intro),
// then the browser — search, the A–Z row and the term list. The section bar
// lives in the track layout, which renders before this boundary, so it is
// already on screen. `aria-hidden`, like every public loader.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonText } from "@repo/ui/components/skeleton";

export default function TrackGlossaryLoading() {
  return (
    <div aria-hidden>
      <Section spacing="sm" tone="muted">
        <Container className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-full max-w-xl" />
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="flex flex-col gap-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 26 }, (_, index) => (
              <Skeleton key={index} className="size-9" />
            ))}
          </div>
          <ul className="flex flex-col divide-y rounded-lg border">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-40" />
                <SkeletonText lines={1} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </div>
  );
}
