// Learning paths (changes-11 PR 5.4). One card per registered track, showing
// how much is actually published in it.
//
// The section key `learning_paths` has been seeded since Module 12 and has
// rendered the "coming soon" placeholder ever since, because there were no
// courses to point at. Phase 4 built `/learn`; this is the homepage door to it.
//
// **Composition is code, data is the database** (ADR-042). Which tracks exist,
// in what order, with which copy, is `LEARN_TRACKS` + the catalog; how many
// courses each one holds is `getLearnIndex`. An admin adds a course and this
// section updates; nobody edits a homepage block.
//
// A track with no published courses is ABSENT, not rendered empty — the same
// rule `/learn` itself follows (ADR-055 #2), enforced in the same place: the
// loader omits the group, so this template cannot get it wrong.
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getLearnIndex } from "@repo/core";
import { learnTrackPath, LEARN_TRACKS, type LearnTrackKey } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

/**
 * `HOME_SECTION_VARIANTS.learning_paths` and `Card`'s variants share a
 * vocabulary but are separate registries, so the mapping is written out rather
 * than cast. An unknown value falls back instead of rendering an unstyled card.
 */
const CARD_VARIANTS = ["default", "elevated", "bordered", "featured"] as const;
type CardVariant = (typeof CARD_VARIANTS)[number];

function cardVariant(variant: string | undefined): CardVariant {
  return CARD_VARIANTS.find((known) => known === variant) ?? "elevated";
}

export async function LearningPaths({ locale, variant }: SectionProps) {
  // The homepage is cached and shared, so the flag is evaluated with a null
  // subject — the same call `/learn` makes. A section pointing at a route that
  // 404s is worse than a missing section.
  if (!(await isFeatureVisible("courses", null))) return null;

  const [t, groups] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getLearnIndex(locale),
  ]);
  if (groups.length === 0) return null;

  const learnT = await getTranslations({ locale, namespace: "learn" });

  return (
    <Section spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading title={t("learningPaths.title")} lead={t("learningPaths.description")} />
        <Reveal variant="up">
          <ul className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => {
              const spec = LEARN_TRACKS[group.track as LearnTrackKey];
              return (
                <li key={group.track}>
                  <Card variant={cardVariant(variant)} className="h-full">
                    <CardHeader>
                      <CardTitle>{learnT(spec.titleKey)}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">{learnT(spec.descriptionKey)}</p>
                      <p className="text-sm font-medium tabular-nums">
                        {t("learningPaths.courseCount", { count: group.courses.length })}
                      </p>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          // The card IS a track, so "Open the track" opens
                          // that track's school (ADR-065 §1) rather than the
                          // umbrella index it used to land on.
                          render={<Link href={learnTrackPath(group.track as LearnTrackKey)} />}
                        >
                          {t("learningPaths.action")}
                          <ArrowRight
                            data-icon="inline-end"
                            aria-hidden
                            className="rtl:rotate-180"
                          />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
