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
import type { ComponentProps, ComponentType } from "react";
import type { HomeSectionKey } from "@repo/contracts";
import type { Section } from "@repo/ui/components/section";
import { Connect } from "./connect.tsx";
import { Explore } from "./explore.tsx";
import { Facts } from "./facts.tsx";
import { FeatureHighlights } from "./feature-highlights.tsx";
import { Faq } from "./faq.tsx";
import { FeaturedLessons } from "./featured-lessons.tsx";
import { GlossarySpotlight } from "./glossary-spotlight.tsx";
import { Hero } from "./hero.tsx";
import { InPractice } from "./in-practice.tsx";
import { LatestAnalysis } from "./latest-analysis.tsx";
import { LatestNews } from "./latest-news.tsx";
import { LearningPaths } from "./learning-paths.tsx";
import { Newsletter } from "./newsletter.tsx";
import { PopularTools } from "./popular-tools.tsx";
import { Quotes } from "./quotes.tsx";
import { Testimonials } from "./testimonials.tsx";
import { TrustStrip } from "./trust-strip.tsx";
import { RiskDisclaimer } from "./risk-disclaimer.tsx";
import { VideoShowcase } from "./video-showcase.tsx";

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
  learning_videos: VideoShowcase,
  learning_paths: LearningPaths,
  featured_lessons: FeaturedLessons,
  hero: Hero,
  explore_platform: Explore,
  popular_tools: PopularTools,
  feature_highlights: FeatureHighlights,
  latest_news: LatestNews,
  latest_analysis: LatestAnalysis,
  glossary_spotlight: GlossarySpotlight,
  newsletter: Newsletter,
  faq: Faq,
  connect: Connect,
  quotes: Quotes,
  // changes-35 (ADR-116 §3). Three datasets, four rendered states — the first
  // band here that degrades per COLUMN rather than per band.
  in_practice: InPractice,
  risk_disclaimer: RiskDisclaimer,
  // changes-31 (ADR-103). Each renders null until the owner supplies its
  // data, so an unfilled install simply has a shorter home page.
  trust_strip: TrustStrip,
  facts: Facts,
  testimonials: Testimonials,
};

/**
 * The pending shape of each band (changes-28 PR 6, ADR-095).
 *
 * Every section below the fold streams behind its own `<Suspense>`, and the
 * fallback has to paint the band's OWN tone — a muted band whose placeholder
 * is white flashes the page a stripe that then disappears, which reads as a
 * bug rather than as loading. So the tone lives here, next to the component
 * whose tone it mirrors, rather than being guessed by the page.
 *
 * A key with no entry falls back to a default band, exactly as a key with no
 * component falls back to the "coming soon" stub: the seeded list is longer
 * than the built set and always will be.
 */
export interface SectionPending {
  tone?: ComponentProps<typeof Section>["tone"];
  /** Card placeholders in the row — 0 for a band that is copy only. */
  cards?: number;
}

export const SECTION_PENDING: Partial<Record<HomeSectionKey | string, SectionPending>> = {
  learning_videos: { cards: 5 },
  explore_platform: { cards: 3 },
  popular_tools: { cards: 4 },
  feature_highlights: { tone: "muted", cards: 3 },
  latest_news: { cards: 4 },
  latest_analysis: { tone: "muted", cards: 3 },
  glossary_spotlight: { tone: "muted", cards: 4 },
  featured_lessons: { tone: "muted", cards: 3 },
  connect: { tone: "inverted", cards: 1 },
  in_practice: { cards: 3 },
  quotes: { tone: "muted", cards: 0 },
  newsletter: { cards: 0 },
  faq: { cards: 0 },
  risk_disclaimer: { tone: "muted", cards: 0 },
  // A band that may render nothing still needs a pending shape — the
  // fallback paints while the boundary resolves, before anyone knows
  // whether there is data behind it.
  trust_strip: { cards: 0 },
  facts: { tone: "muted", cards: 0 },
  testimonials: { cards: 3 },
};
