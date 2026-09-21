// The quiz runner page's pending shape (changes-21 Phase A). Without it this
// route inherited `quizzes/loading.tsx` — a grid of six quiz cards standing in
// for one narrow column with a single runner in it.
//
// It mirrors the page: the breadcrumb, the display-size title and its lead,
// then the runner's start card, in the same `max-w-3xl` column.
// `aria-hidden`, like every public loader.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonButton, SkeletonCard, SkeletonText } from "@repo/ui/components/skeleton";

export default function QuizRunnerLoading() {
  return (
    <div aria-hidden>
      <Section spacing="md">
        <Container className="flex max-w-3xl flex-col gap-6">
          <Skeleton className="h-4 w-56" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full max-w-lg" />
            <Skeleton className="h-7 w-full max-w-xl" />
          </div>
          <SkeletonCard>
            <SkeletonText lines={3} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <SkeletonButton size="lg" className="mt-2" />
          </SkeletonCard>
        </Container>
      </Section>
    </div>
  );
}
