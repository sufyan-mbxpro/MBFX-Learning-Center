// The glossary index's pending shape (changes-21 Phase A). Before this file
// `/glossary` had no loading boundary at all, so a navigation into it showed
// the previous page with no sign anything was happening.
//
// It mirrors the page's bands: the PageHero masthead, then the browser — a
// search field, the A–Z anchor row and the term list. The "term of the day"
// band is NOT reserved: it renders only when a term qualifies, and a
// placeholder for a band that may not arrive is the jump this file prevents.
//
// `aria-hidden`, like every public loader: Next announces the navigation, and
// a public fallback reads no translations.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonButton, SkeletonText } from "@repo/ui/components/skeleton";

export default function GlossaryLoading() {
  return (
    <div aria-hidden>
      <Section spacing="lg" className="bg-muted/60">
        <Container className="flex flex-col gap-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full max-w-xl" />
          <Skeleton className="h-6 w-full max-w-2xl" />
          <SkeletonButton size="xl" shape="pill" />
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
            {Array.from({ length: 8 }, (_, index) => (
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
