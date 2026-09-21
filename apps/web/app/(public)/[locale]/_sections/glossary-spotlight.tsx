// Glossary spotlight (changes-03-plan.md §6.2).
//
// Four variants, and the DEFAULT changed in changes-28 (PR 2). It was
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
//
// ─── `feature` — the browse band (changes-35, ADR-116 §1 band C) ──────────
//
// Three columns: what the set is (heading, lead, the browse button), the set
// itself on a track, and ONE pick — the term of the day. `getTermOfTheDay` has
// been built since changes-11 (D29) and no home band had ever called it; the
// day's term sat on `/glossary` alone, which is the page a reader only reaches
// once they already know they want a glossary.
//
// The card is `glossary/_components/term-of-the-day.tsx` rather than a second
// implementation of it. That import crosses into a route-private folder, which
// `home-media.tsx` warns about in general — the precedent for doing it anyway
// is `../news/_components/article-list.tsx`, which several surfaces share for
// the same reason. A copy of this card would be a second place for it to drift.
//
// Its LABELS come from the `glossary` namespace, not `home`: "Term of the day"
// already exists there, and a second copy in `home` would be one string for a
// translator to render two ways.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getPublishedGlossary, getTermOfTheDay, type GlossaryListEntry } from "@repo/core";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Carousel } from "@repo/ui/components/carousel";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { TermOfTheDay } from "../glossary/_components/term-of-the-day.tsx";
import type { SectionProps } from "./registry.ts";

/**
 * One term.
 *
 * `detailed` is what `variant === "cards"` used to test inline: the topic chip
 * and the plain-language line. `grid` keeps the title-only card it has always
 * had; `cards` and `feature` both explain.
 */
function TermCard({ entry, detailed }: { entry: GlossaryListEntry; detailed: boolean }) {
  return (
    // Card is a plain element (no `render` polymorphism — that's Badge/Button),
    // so the link wraps it.
    <Link href={`/glossary/${entry.slug}`} className="group/term block h-full">
      <Card variant="bordered" className="hover-lift sheen h-full">
        <CardHeader className="gap-2">
          {/* The topic, where the term has one. A term filed under an inactive
              topic reads as unfiled — that is already resolved upstream, in
              the loader. */}
          {detailed && entry.topicName && (
            <Badge variant="eyebrow" className="w-fit">
              {entry.topicName}
            </Badge>
          )}
          <CardTitle className="transition-colors duration-(--duration-base) group-hover/term:text-primary-interactive">
            {entry.term}
          </CardTitle>
          {/* `simpleExplanation` is plain TEXT here, not rich text — the loader
              strips it, which is what keeps tag names out of the copy and out
              of the A–Z search (ADR-069). */}
          {detailed && entry.simpleExplanation && (
            <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
              {entry.simpleExplanation}
            </p>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

export async function GlossarySpotlight({ locale, variant = "cards", limit }: SectionProps) {
  const isFeature = variant === "feature";

  const [t, tGlossary, entries, termOfTheDay] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "glossary" }),
    getPublishedGlossary(locale),
    // Cached on a daily profile and tagged `content`, so this costs one cache
    // entry rather than a query per render — and `/glossary` shares it.
    isFeature ? getTermOfTheDay(locale) : null,
  ]);
  if (entries.length === 0) return null;

  const shown = entries.slice(0, limit ?? 8);
  const browseButton = (
    <Button variant="outline" render={<Link href={ROUTE_PATHS.glossary} />}>
      {t("glossaryAll")}
      <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
    </Button>
  );

  if (isFeature) {
    return (
      <Section tone="muted" spacing="md">
        {/* Three tracks at `lg`, one below it — and the stacking order a phone
            gets is the reading order: what this is, the terms, then the pick.
            `grid-cols-1` is explicit (code-style #23).

            No `items-start` (owner, 2026-09-16): the three columns STRETCH, so
            the band is one block rather than three ragged ones. Start-aligned,
            the browse button hung ~90px below the cards it sits beside and the
            term card stopped ~100px short of the carousel's controls — the
            columns disagreed about where the band ended. Each column now fills
            the row and pins its own last element to the bottom edge, so the
            three bottoms land on one line. */}
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-(--grid-home-browse)">
          <Reveal variant="start" className="flex h-full flex-col gap-6">
            <SectionHeading
              eyebrow={t("glossaryEyebrow")}
              title={t("glossarySpotlight")}
              lead={t("glossaryLead")}
            />
            {/* `mt-auto` is what lands this on the carousel's control row
                rather than immediately under the lead. */}
            <div className="mt-auto">{browseButton}</div>
          </Reveal>

          <Reveal variant="up" className="h-full">
            <Carousel
              className="h-full"
              label={t("glossaryCarouselLabel")}
              previousLabel={t("glossaryCarouselPrevious")}
              nextLabel={t("glossaryCarouselNext")}
              // Two across in the middle column, which is ~800px on a 1400px
              // page. Three would put a definition in 255px, and a definition
              // that wraps to six lines is a paragraph, not a card.
              itemClassName="w-41/50 sm:w-29/50 lg:w-(--width-slide-2)"
              controls="arrows"
              slideLabels={shown.map((entry) => entry.term)}
            >
              {shown.map((entry) => (
                <TermCard key={entry.termId} entry={entry} detailed />
              ))}
            </Carousel>
          </Reveal>

          {/* The one pick. Absent, not empty, when nothing is published in this
              locale — `getTermOfTheDay` returns null and the band is two
              columns rather than a grid with a hole in it (ADR-116 §3). */}
          {termOfTheDay && (
            <Reveal variant="end" className="h-full">
              <TermOfTheDay
                className="h-full"
                term={termOfTheDay.term}
                slug={termOfTheDay.slug}
                explanation={termOfTheDay.simpleExplanation}
                labels={{
                  eyebrow: tGlossary("termOfTheDay"),
                  readMore: tGlossary("readMore"),
                }}
              />
            </Reveal>
          )}
        </Container>
      </Section>
    );
  }

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
                  <TermCard entry={entry} detailed={variant === "cards"} />
                </li>
              ))}
            </ul>
          )}
        </Reveal>
        <div>{browseButton}</div>
      </Container>
    </Section>
  );
}
