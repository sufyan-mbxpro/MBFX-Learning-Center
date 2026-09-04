// Homepage section registry (changes-03-plan.md §4.3, §5.1).
//
// This is the OTHER half of the split described in @repo/contracts'
// HOME_SECTION_VARIANTS: that one owns the variant vocabulary (so a bad
// variant is rejected on write), this one owns the key → component map (so
// a shared package never reaches into app code, architecture.md #8).
//
// A key with no entry here still renders — as the honest "coming soon"
// stub the homepage already used, not a crash. That is deliberate: the
// seeded section list is longer than the set of features that have landed,
// and an admin can add a key ahead of its build.
import type { ComponentType } from "react";
import type { HomeSectionKey } from "@repo/contracts";
import { Faq } from "./faq.tsx";
import { GlossarySpotlight } from "./glossary-spotlight.tsx";
import { Hero } from "./hero.tsx";
import { LatestAnalysis } from "./latest-analysis.tsx";
import { Newsletter } from "./newsletter.tsx";
import { RiskDisclaimer } from "./risk-disclaimer.tsx";

/** What every section component receives — the descriptor, resolved. */
export interface SectionProps {
  locale: string;
  /** Validated against HOME_SECTION_VARIANTS on write; may still be absent. */
  variant?: string;
  limit?: number;
}

export const SECTION_COMPONENTS: Partial<
  Record<HomeSectionKey | string, ComponentType<SectionProps>>
> = {
  hero: Hero,
  latest_analysis: LatestAnalysis,
  glossary_spotlight: GlossarySpotlight,
  newsletter: Newsletter,
  faq: Faq,
  risk_disclaimer: RiskDisclaimer,
};
