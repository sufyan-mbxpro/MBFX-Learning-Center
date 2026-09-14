// The pending shape of a homepage band (changes-28 PR 6, ADR-095).
//
// Every section below the fold renders inside its own `<Suspense>` with this
// as the fallback, so the page streams band by band instead of the whole
// document waiting on the slowest query in the list. Without a boundary a
// homepage is exactly as fast as its slowest section, and the reader sees
// nothing at all until then.
//
// ─── Why a shaped skeleton and not a spinner ──────────────────────────────
//
// The fallback occupies the band's real height. A zero-height fallback would
// let the page settle and then shove the footer down as each section resolved
// — layout shift at the bottom of every scroll, which is the thing streaming
// is supposed to avoid, not cause. The heading block plus a row of cards is a
// close-enough stand-in for every band on this page; a per-section skeleton
// per band would be twelve more components to keep in sync with twelve
// layouts, and would drift the first time one of them changed.
//
// `aria-hidden` throughout and no `role="status"`: the reader is not waiting
// on an action, they are scrolling a page that is still arriving, and a live
// region announcing "loading" twelve times is noise.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonText } from "@repo/ui/components/skeleton";

export function SectionSkeleton({
  tone = "default",
  cards = 3,
}: {
  tone?: React.ComponentProps<typeof Section>["tone"];
  /** How many card placeholders the row holds — 0 for a copy-only band. */
  cards?: number;
}) {
  return (
    <Section tone={tone} spacing="md" aria-hidden>
      <Container className="flex flex-col gap-(--section-gap)">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <SkeletonText lines={2} className="max-w-2xl" />
        </div>
        {cards > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cards }, (_, index) => (
              <Skeleton key={index} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
