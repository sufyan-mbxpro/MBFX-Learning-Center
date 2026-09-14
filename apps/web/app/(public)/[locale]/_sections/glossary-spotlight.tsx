// Glossary spotlight (changes-03-plan.md §6.2).
//
// Three variants, and the DEFAULT changed in changes-28 (PR 2). It was
// `chips`: a wrapped row of term pills under a heading and a lead. On a
// 1400px page that is one line of eight small words under two lines of large
// ones — a band whose heading is three times the height of its content, which
// is what the brief's screenshot caught (image 50). A chip also says nothing:
// "Arbitrage" is only useful to a reader who already knows what arbitrage is,
// and this section exists for the reader who does not.
//
// `cards` shows the term WITH its plain-language line, which `GlossaryListEntry`
// already carries (`loadPublishedGlossary` strips the rich text to text for
// exactly this kind of use). `chips` and `grid` are kept — a site with three
// hundred published terms may well want the dense row back.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getPublishedGlossary } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

export async function GlossarySpotlight({ locale, variant = "cards", limit }: SectionProps) {
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
          {variant === "chips" ? (
            <ul className="flex flex-wrap gap-2">
              {shown.map((entry) => (
                <li key={entry.termId}>
                  <Badge variant="pill" render={<Link href={`/glossary/${entry.slug}`} />}>
                    {entry.term}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((entry) => (
                <li key={entry.termId}>
                  {/* Card is a plain element (no `render` polymorphism —
                      that's Badge/Button), so the link wraps it. */}
                  <Link href={`/glossary/${entry.slug}`} className="group/term block h-full">
                    <Card
                      variant="bordered"
                      className="card-hover h-full transition-colors duration-(--duration-base) hover:border-primary/30"
                    >
                      <CardHeader className="gap-2">
                        {/* The topic, where the term has one. A term filed
                            under an inactive topic reads as unfiled — that is
                            already resolved upstream, in the loader. */}
                        {variant === "cards" && entry.topicName && (
                          <Badge variant="eyebrow" className="w-fit">
                            {entry.topicName}
                          </Badge>
                        )}
                        <CardTitle className="transition-colors duration-(--duration-base) group-hover/term:text-primary-interactive">
                          {entry.term}
                        </CardTitle>
                        {/* `grid` keeps its original title-only card; `cards`
                            is the one that explains. `simpleExplanation` is
                            plain TEXT here, not rich text — the loader strips
                            it, which is what keeps tag names out of the copy
                            and out of the A–Z search (ADR-069). */}
                        {variant === "cards" && entry.simpleExplanation && (
                          <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
                            {entry.simpleExplanation}
                          </p>
                        )}
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
        <div>
          <Button variant="outline" render={<Link href={ROUTE_PATHS.glossary} />}>
            {t("glossaryAll")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
      </Container>
    </Section>
  );
}
