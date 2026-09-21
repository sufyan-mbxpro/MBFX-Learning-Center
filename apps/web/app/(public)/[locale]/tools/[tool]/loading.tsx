// A tool page's pending shape (changes-41, ADR-135).
//
// It mirrors `tool-shell.tsx`'s first two bands and nothing below them: the
// compact masthead, then the calculator beside its explainer in the same
// `--grid-3-2` split, so the page does not jump sideways when it lands. The
// calculator card keeps the widget's own inputs | results split.
//
// The highlights, reviews and related bands are NOT reserved. Each renders
// only when it has something to show, and a placeholder for a band that may
// not arrive is the jump this file exists to prevent.
//
// `aria-hidden`, like every public loader: Next announces the navigation, and
// a public fallback reads no translations.
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonText } from "@repo/ui/components/skeleton";

export default function ToolLoading() {
  return (
    <div aria-hidden>
      <Section spacing="sm" className="bg-muted/60">
        <Container className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-6 w-full max-w-2xl" />
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-(--grid-3-2)">
            <Card>
              <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-4 rounded-lg bg-muted/40 p-5">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="flex flex-col gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-7 w-32" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <SkeletonText lines={4} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <Skeleton className="h-6 w-48" />
                  <SkeletonText lines={5} />
                </CardContent>
              </Card>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
