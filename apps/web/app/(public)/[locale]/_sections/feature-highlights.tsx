// "Why learn here" — the homepage's feature highlights.
//
// Six promises about HOW the material is written, not claims about how many
// people read it. That distinction is deliberate and load-bearing: ADR-047 §
// the About section's `about-facts.ts` exists because a number on a marketing
// surface is a factual claim that has to be true, and nothing here is gated
// on facts because nothing here asserts one. "Every lesson states its risk"
// is a description of the editorial standard, checkable by reading the site.
// If a metric is ever wanted in this section it belongs behind the facts
// gate, not inline.
//
// Composition is code (ADR-042). Copy is catalog keys derived from `key`
// (code-style.md #2).
import { getTranslations } from "next-intl/server";
import {
  BookOpenCheck,
  Coins,
  Languages,
  ShieldAlert,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@repo/ui/components/container";
import { IconCard } from "@repo/ui/components/icon-card";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

/** `key` addresses both catalog entries; the icon is the only styling here. */
const HIGHLIGHTS: readonly { key: string; icon: LucideIcon }[] = [
  { key: "plainLanguage", icon: BookOpenCheck },
  { key: "workedExamples", icon: Coins },
  { key: "riskIncluded", icon: ShieldAlert },
  { key: "freeToRead", icon: Wallet },
  { key: "multilingual", icon: Languages },
  { key: "noHype", icon: Sparkles },
];

export async function FeatureHighlights({ locale, variant = "grid", limit }: SectionProps) {
  const t = await getTranslations({ locale, namespace: "home" });
  const shown = HIGHLIGHTS.slice(0, limit ?? HIGHLIGHTS.length);

  return (
    <Section spacing="lg" tone="muted">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          align="center"
          eyebrow={t("highlightsEyebrow")}
          title={t("highlightsTitle")}
          lead={t("highlightsLead")}
          className="mx-auto"
        />
        <Reveal variant="up">
          <ul
            className={
              variant === "compact"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {shown.map((highlight) => {
              const suffix = highlight.key.charAt(0).toUpperCase() + highlight.key.slice(1);
              return (
                <li key={highlight.key}>
                  {/*
                    `interactive` is forced ON even though these cards are not
                    links. IconCard's default ties the hover lift to `render`
                    precisely so a card cannot promise a click it does not
                    have — but this whole section is one visual block that
                    responds to the pointer, and none of its cards is a link,
                    so nothing is being promised inconsistently. The exception
                    is stated here rather than left to be rediscovered.
                  */}
                  <IconCard
                    interactive
                    icon={highlight.icon}
                    title={t(`highlight${suffix}Title` as "highlightPlainLanguageTitle")}
                    className="h-full"
                  >
                    {t(`highlight${suffix}Body` as "highlightPlainLanguageBody")}
                  </IconCard>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
