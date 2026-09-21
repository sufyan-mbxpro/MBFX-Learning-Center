import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal, RevealGroup } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { humanizeKey } from "@repo/utils";
import type { ToolRelatedItem } from "@repo/core";

// A tone per destination type (changes-42). The outline badge made a mixed list
// read as one kind of thing; a hue per TYPE lets a reader pick the glossary
// entry out of a row of articles before reading a word. An unknown type falls
// back to the neutral pill rather than borrowing a hue that means something
// else.
const TYPE_TONE: Record<string, "info" | "success" | "warning" | "eyebrow" | "secondary"> = {
  article: "info",
  course: "success",
  lesson: "warning",
  glossary: "eyebrow",
  video: "secondary",
};

// "More about this" (ADR-086 #4).
//
// **Curated first, topped up second, and badged by type.** The reference's own
// list is visibly automatic — it lands a Canada jobs headline under a
// gain/loss calculator — so ours puts the editor's picks first and only fills
// the remainder.
//
// The type badge is the small thing that makes a mixed list readable: without
// it, a glossary term and a lesson are two identical cards with different
// destinations.
export async function RelatedStrip({ items }: { items: ToolRelatedItem[] }) {
  const t = await getTranslations("tools");
  // Nothing renders at all when there is nothing to show. A heading over an
  // empty grid is worse than the page ending.
  if (items.length === 0) return null;

  return (
    <Section tone="muted">
      <Container>
        {/* The last band on a tool page to arrive rather than simply be there
            (changes-40). Every other band on the page enters — the calculator
            from the start edge, its explainer from the end, the highlights in a
            staggered row — and this one appeared fully formed under them.

            `RevealGroup` IS the grid (its own note says why: each child is
            wrapped, and the wrapper becomes the grid item), so the list
            semantics move onto it as roles. */}
        <Reveal variant="up">
          <SectionHeading eyebrow={t("related.eyebrow")} title={t("related.title")} />
        </Reveal>
        <RevealGroup
          variant="up"
          role="list"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item) => (
            // `h-full` on the list item too: `RevealGroup`'s wrapper fills the
            // track, and a card set to `h-full` inside an auto-height item
            // shrink-wraps, which is what left the rows ragged (changes-42).
            <div key={`${item.targetType}:${item.href}`} role="listitem" className="h-full">
              {/* The site's clickable-card recipe (changes-39): the whole card is
                  the link, as on the tools index, rather than the title alone. */}
              <Card className="group hover-lift sheen h-full">
                <CardContent className="flex h-full flex-col gap-1.5">
                  {/* ADR-044 #5's rule holds on the public side too: a stored
                      type key reaches the screen humanised, never raw. */}
                  <Badge
                    size="sm"
                    variant={TYPE_TONE[item.targetType] ?? "pill"}
                    // `eyebrow` is uppercase by design; a type label is not an
                    // eyebrow, so every tone reads in the same case.
                    className="self-start tracking-normal normal-case"
                  >
                    {t.has(`related.types.${item.targetType}`)
                      ? t(`related.types.${item.targetType}`)
                      : humanizeKey(item.targetType)}
                  </Badge>
                  <Link
                    href={item.href}
                    className="line-clamp-2 text-sm font-semibold transition-colors duration-(--duration-base) group-hover:text-primary-interactive after:absolute after:inset-0"
                  >
                    {item.title}
                  </Link>
                  {item.summary && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
