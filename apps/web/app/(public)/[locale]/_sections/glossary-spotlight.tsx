// Glossary spotlight (changes-03-plan.md §6.2). Two variants: `chips` (the
// compact term cloud) and `grid` (cards with a little more room).
import { getTranslations } from "next-intl/server";
import { getPublishedGlossary } from "@repo/core";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

export async function GlossarySpotlight({ locale, variant = "chips", limit }: SectionProps) {
  const [t, entries] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getPublishedGlossary(locale),
  ]);
  if (entries.length === 0) return null;

  const shown = entries.slice(0, limit ?? 8);

  return (
    <Section tone="muted" spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          eyebrow={t("glossaryEyebrow")}
          title={t("glossarySpotlight")}
          lead={t("glossaryLead")}
        />
        <Reveal variant="up">
          {variant === "grid" ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((entry) => (
                <li key={entry.termId}>
                  {/* Card is a plain element (no `render` polymorphism —
                      that's Badge/Button), so the link wraps it. */}
                  <Link href={`/glossary/${entry.slug}`} className="block h-full">
                    <Card variant="bordered" className="h-full">
                      <CardHeader>
                        <CardTitle>{entry.term}</CardTitle>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {shown.map((entry) => (
                <li key={entry.termId}>
                  <Badge variant="pill" render={<Link href={`/glossary/${entry.slug}`} />}>
                    {entry.term}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </Container>
    </Section>
  );
}
