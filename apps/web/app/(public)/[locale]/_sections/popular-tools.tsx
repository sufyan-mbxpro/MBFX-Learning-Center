import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { toolPath } from "@repo/contracts";
import { getEnabledTools } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import { TOOL_ICONS } from "../tools/_components/tool-icons.ts";
import type { SectionProps } from "./registry.ts";

// The homepage's tools band (changes-25 T9; presentation pass changes-28 PR 2).
//
// **It reads the same `getEnabledTools` the section bar and the index do**, in
// the same `sortOrder`, so an admin who reorders the tools reorders this band
// too — from one edit, in one place.
//
// **Nothing renders when the flag is off or no tool is live.** A heading over
// an empty grid is worse than the section not being there, which is the rule
// every other homepage band already follows.
//
// ─── What changes-28 changed, and why ─────────────────────────────────────
//
// The band shipped as four flat cards with a `hover:shadow-md` and a 36px
// tinted icon square. Beside the glossary band above it, the two read as the
// same component twice (image 50 in the brief). A calculator is not a
// definition: it is something you OPERATE, and the card should look like it
// opens one.
//
// So: the icon tile is larger, ringed, and tints further on hover; the card
// picks up the design system's own `.card-hover .hover-lift .sheen` trio
// (ADR-072) rather than a bespoke shadow; and an arrow marks the card as a
// destination rather than a panel. No new colour is chosen — every value is a
// `--primary` alpha the theme already emits, so an admin rebrand carries it.
export async function PopularTools({ locale, limit }: SectionProps) {
  if (!(await isFeatureVisible("calculators", null))) return null;

  const [t, tools] = await Promise.all([
    getTranslations({ locale, namespace: "tools" }),
    getEnabledTools(locale),
  ]);

  const shown = tools.slice(0, limit ?? 4);
  if (shown.length === 0) return null;

  return (
    <Section>
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading eyebrow={t("eyebrow")} title={t("home.title")} lead={t("home.lead")} />
        <Reveal variant="up">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((tool) => {
              const Icon = TOOL_ICONS[tool.key];
              return (
                <li key={tool.key}>
                  {/* A whole-card stretched link: everything in it leads to the
                    same one place, so there is no second target to protect. */}
                  <Card className="group/tool card-hover hover-lift sheen relative h-full ring-1 ring-foreground/10 hover:ring-primary/30">
                    <CardContent className="flex h-full flex-col gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-interactive ring-1 ring-primary/15 transition-all duration-(--duration-base) ease-(--ease-out-quint) group-hover/tool:scale-105 group-hover/tool:bg-primary/15 group-hover/tool:ring-primary/30">
                        <Icon aria-hidden className="size-5.5" />
                      </span>
                      <Link
                        href={toolPath(tool.key)}
                        className="font-medium transition-colors duration-(--duration-base) after:absolute after:inset-0 group-hover/tool:text-primary-interactive"
                      >
                        {tool.title}
                      </Link>
                      {tool.tagline && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{tool.tagline}</p>
                      )}
                      {/* The card's own affordance. `mt-auto` pins it to the
                          bottom edge so a one-line and a two-line tagline
                          still produce the same card.

                          Always visible, never revealed on hover: a pointer
                          is not the only way onto this page, and an
                          `opacity-0` affordance is one a touch visitor never
                          sees at all. It BRIGHTENS on hover instead, which is
                          also what keeps axe able to measure its contrast —
                          the reason `lesson-nav.test.tsx` forbids an ancestor
                          opacity outright. */}
                      <span
                        aria-hidden
                        className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground transition-colors duration-(--duration-base) group-hover/tool:text-primary-interactive group-focus-within/tool:text-primary-interactive"
                      >
                        {t("home.open")}
                        <ArrowRight className="size-3.5 transition-transform duration-(--duration-base) ease-(--ease-out-quint) group-hover/tool:translate-x-0.5 rtl:rotate-180" />
                      </span>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <div className="flex justify-center">
          <Button variant="outline" render={<Link href="/tools" />}>
            {t("home.viewAll")}
            <ArrowRight aria-hidden data-icon="inline-end" className="rtl:rotate-180" />
          </Button>
        </div>
      </Container>
    </Section>
  );
}
