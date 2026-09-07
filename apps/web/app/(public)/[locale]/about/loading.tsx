// One loading skeleton for the whole About section — Next applies a
// segment's loading.tsx to every route beneath it, and all five pages open
// with the same hero-then-sections rhythm.
//
// It mirrors the real layout's proportions rather than showing a spinner:
// a skeleton that matches what arrives keeps the page from jumping when it
// does. The sub-nav strip is NOT skeletoned — it lives in the layout, which
// renders before this boundary, so it is already on screen.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function AboutLoading() {
  return (
    <div aria-hidden>
      <Section spacing="lg" tone="inverted">
        <Container className="flex flex-col gap-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full max-w-2xl" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-40 rounded-full" />
          </div>
        </Container>
      </Section>

      <Section spacing="lg">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-9 w-full max-w-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
