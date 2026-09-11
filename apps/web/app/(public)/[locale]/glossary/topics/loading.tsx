import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

// Route-level loading UI for the topic index (changes-18 PR 7 asked for one on
// both topic routes; only `[topic]/loading.tsx` shipped). Mirrors the page's
// three bands — masthead, the A–Z / Topics strip, then the card grid — so the
// swap to real content is a fill rather than a re-layout.
//
// The strip is a placeholder ROW, not two chip-shaped blocks: `GlossaryTabs`
// returns null when fewer than two tabs exist, and drawing tabs that may not
// arrive would be the re-layout this file exists to prevent. Its `border-b`
// and padding hold the band's height either way.
export default function GlossaryTopicsLoading() {
  return (
    <>
      <Section spacing="sm" tone="muted">
        <Container className="flex flex-col gap-1.5">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </Container>
      </Section>

      <div className="border-b">
        <Container>
          <div className="flex items-center gap-1 py-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
        </Container>
      </div>

      <Section spacing="md">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-36 w-full rounded-xl" />
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
