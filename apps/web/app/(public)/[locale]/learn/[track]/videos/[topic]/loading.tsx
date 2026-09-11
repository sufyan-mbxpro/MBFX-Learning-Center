// The video detail page's loading skeleton (changes-16 PR 8/10).
//
// Its own file rather than inheriting the index's: this route opens with a
// breadcrumb and a 16:9 player inside a NARROW column, where the index opens
// with a full-bleed masthead over a three-across grid. One skeleton across
// both shapes would guarantee a jump on one of them.
//
// The player block is the important part to get right — it is the tallest
// thing above the fold, and a placeholder of the wrong height moves everything
// under it when the real one arrives.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function VideoTopicLoading() {
  return (
    <div aria-hidden>
      <Section spacing="md">
        <Container size="narrow" className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            {/* Breadcrumb. */}
            <Skeleton className="shimmer h-4 w-56" />
            <div className="flex flex-col gap-3">
              <Skeleton className="shimmer h-5 w-32 rounded-full" />
              <Skeleton className="shimmer h-10 w-full max-w-xl" />
              <Skeleton className="shimmer h-6 w-full max-w-lg" />
            </div>
          </div>

          {/* The player — same aspect ratio as the real one, so nothing under
              it moves when it arrives. */}
          <Skeleton className="shimmer aspect-video w-full rounded-lg" />

          {/* The body. */}
          <div className="flex flex-col gap-3">
            <Skeleton className="shimmer h-6 w-48" />
            <Skeleton className="shimmer h-4 w-full" />
            <Skeleton className="shimmer h-4 w-full" />
            <Skeleton className="shimmer h-4 w-3/4" />
          </div>

          {/* The links block. */}
          <div className="flex flex-col gap-3">
            <Skeleton className="shimmer h-6 w-36" />
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="shimmer h-12 w-full rounded-lg" />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
