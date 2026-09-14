import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { humanizeKey } from "@repo/utils";
import type { ToolRelatedItem } from "@repo/core";

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
        <SectionHeading eyebrow={t("related.eyebrow")} title={t("related.title")} />
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={`${item.targetType}:${item.href}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-2">
                  {/* ADR-044 #5's rule holds on the public side too: a stored
                      type key reaches the screen humanised, never raw. */}
                  <Badge variant="outline" className="self-start">
                    {t.has(`related.types.${item.targetType}`)
                      ? t(`related.types.${item.targetType}`)
                      : humanizeKey(item.targetType)}
                  </Badge>
                  <Link href={item.href} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  {item.summary && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
