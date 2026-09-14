// The LESSON page's loading skeleton (design pass 2026-09-09).
//
// The lesson layout is the one that least resembles the other two: a narrow
// contents rail on the inline start from md, and a prose column beside it. The
// area-wide skeleton mirrored neither, so a reader clicking through a
// curriculum saw the page rebuild itself on every lesson. This one holds the
// same grid the lesson renders into.
//
// Prose is skeletoned as ragged lines rather than as blocks — a paragraph
// that arrives where a paragraph was drawn does not move the page, and a
// uniform grey slab reads as an image that failed to load.
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton } from "@repo/ui/components/skeleton";

/** Ragged-right widths, so the block reads as text rather than as a slab. */
const LINE_WIDTHS = ["w-full", "w-11/12", "w-full", "w-4/5", "w-full", "w-2/3"] as const;

export default function LessonLoading() {
  return (
    <div aria-hidden>
      <Section spacing="md">
        <Container className="grid grid-cols-1 gap-8 pb-24 md:grid-cols-(--grid-rail-main) md:items-start md:pb-0">
          {/* The contents rail — hidden below md, exactly as the real one is. */}
          <aside className="hidden md:flex md:flex-col md:gap-3">
            {/* The panel the rail became in changes-24: a header band, a rule,
                then rows whose meta sits under the title. */}
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5">
                <Skeleton className="shimmer h-3 w-20" />
                <Skeleton className="shimmer h-3 w-12" />
              </div>
              <div className="flex flex-col gap-3 p-3">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <Skeleton className="shimmer mt-0.5 size-5 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="shimmer h-4 w-full" />
                      <Skeleton className="shimmer h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="shimmer h-28 w-full rounded-xl" />
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Skeleton className="shimmer h-4 w-56" />
              <Skeleton className="shimmer h-10 w-full max-w-xl" />
              <Skeleton className="shimmer h-4 w-32" />
              <Skeleton className="shimmer h-6 w-full max-w-lg" />
            </div>

            {/* The hero/video box. Drawn at the same 16:9 the page uses, so a
                lesson that has one does not push the prose down on arrival. */}
            <Skeleton className="shimmer aspect-video w-full rounded-xl" />

            <div className="flex flex-col gap-3">
              {LINE_WIDTHS.map((width, index) => (
                <Skeleton key={index} className={`shimmer h-4 ${width}`} />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {LINE_WIDTHS.slice(0, 4).map((width, index) => (
                <Skeleton key={index} className={`shimmer h-4 ${width}`} />
              ))}
            </div>

            <div className="flex flex-wrap gap-3 border-t pt-6">
              <Skeleton className="shimmer h-10 w-48 rounded-md" />
              <Skeleton className="shimmer h-10 w-32 rounded-md" />
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
