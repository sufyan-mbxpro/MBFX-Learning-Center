// The placeholder a streaming About section occupies while it resolves
// (ADR-051 §6).
//
// Four shapes, one per rhythm the section uses, because the point of a
// skeleton is to reserve the RIGHT space: a generic box that is the wrong
// height moves the whole page when the real content lands, which is worse
// than no skeleton at all — the reader loses their place mid-sentence.
//
// `aria-hidden` throughout, and no live region. A screen reader gets the real
// content when it streams in; announcing "loading" four times on one page is
// noise, and the sections arrive in milliseconds on a warm cache.
//
// Distinct from `loading.tsx`, which covers the whole segment on a NAVIGATION
// into the section. This one covers a single section within an already-
// painted page.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

type FallbackVariant = "band" | "grid" | "split" | "list";

export function SectionFallback({
  variant,
  tone = "default",
}: {
  variant: FallbackVariant;
  tone?: "default" | "muted";
}) {
  return (
    <Section
      aria-hidden
      spacing={variant === "band" ? "md" : "lg"}
      tone={tone}
      // Not `animate-pulse` on every child: one pulsing surface reads as
      // "this area is loading", where a dozen independently pulsing blocks
      // read as an error state. Skeleton already carries the shimmer.
      className="opacity-70"
    >
      <Container className={cn("flex flex-col gap-10")}>
        {variant === "band" && (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        )}

        {variant === "grid" && (
          <>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          </>
        )}

        {variant === "split" && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-16">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full max-w-sm" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-6 w-full max-w-lg" />
              ))}
            </div>
          </div>
        )}

        {variant === "list" && (
          <>
            <Skeleton className="h-9 w-64" />
            <div className="flex flex-col gap-8">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex gap-4">
                  <Skeleton className="size-3 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-full max-w-sm" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
