import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

// Route-level loading UI for one topic (changes-18 PR 7). Mirrors the page's
// own shape — masthead band, then a card grid — so the swap to real content is
// a fill rather than a re-layout.
export default function GlossaryTopicLoading() {
  return (
    <>
      <Section spacing="sm" tone="muted">
        <Container className="flex flex-col gap-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-full max-w-2xl" />
          <Skeleton className="h-10 w-24" />
        </Container>
      </Section>

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
