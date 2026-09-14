// One glossary term's pending shape (changes-21 Phase A). Without it the term
// page inherited `glossary/loading.tsx` — an A–Z browser standing in for a
// page of prose.
//
// It mirrors the term page: the PageHero band (breadcrumb, badges, title,
// lead), the four prose sections in the narrow measure, then the muted
// related-terms band. `aria-hidden`, like every public loader.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import {
  Skeleton,
  SkeletonCard,
  SkeletonHeading,
  SkeletonText,
} from "@repo/ui/components/skeleton";

export default function GlossaryTermLoading() {
  return (
    <div aria-hidden>
      <Section spacing="lg" className="bg-muted/60">
        <Container className="flex flex-col gap-5">
          <Skeleton className="h-4 w-56" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full max-w-lg" />
          <Skeleton className="h-6 w-full max-w-2xl" />
        </Container>
      </Section>

      <Section spacing="md">
        <Container size="narrow" className="flex flex-col gap-8">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <SkeletonHeading size="section" />
              <SkeletonText lines={index === 0 ? 4 : 3} />
            </div>
          ))}
        </Container>
      </Section>

      <Section spacing="md" tone="muted">
        <Container className="flex flex-col gap-6">
          <SkeletonHeading size="section" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={index} size="sm" lines={2} />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
