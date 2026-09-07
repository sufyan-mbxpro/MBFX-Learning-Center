// About-section imagery (ADR-047 §3, extended by ADR-051 §5).
//
// Every hero and callout takes its image path from here. A `null` entry is
// still not a defect: the component renders its gradient/tone panel instead —
// the same treatment the homepage `Hero`'s `background` variant uses. That
// guarantee is why a deleted file degrades rather than breaks the page.
//
// The slots are now filled with generated vector art (ADR-051 §5), emitted by
// `apps/web/scripts/generate-about-art.mjs` and committed under
// `apps/web/public/about/`. It is not photography and is not pretending to
// be: it is brand-toned abstract artwork whose motif matches what its section
// says — a candlestick series beside market data, a signed shield beside
// security, a mentor orbit beside support.
//
// TODO(owner): to swap in real photography, drop the file into
// `public/about/` and point the entry at it. Nothing else changes — no
// component knows the difference between a photograph and a generated panel.

export type AboutImage = string | null;

/**
 * Every piece is 16:9 for a hero, 4:3 for a callout — SplitCallout's own box.
 *
 * A few slots are not wired to a layout today (`overviewStrength`,
 * `securityData`, `supportMentors`). They are spares, not dead entries: this
 * is a lookup table, and having the art ready is what makes adding the section
 * that uses it a one-line change rather than a round trip through the
 * generator.
 */
export const ABOUT_MEDIA = {
  overviewHero: "/about/overview-hero.svg",
  overviewStrength: "/about/overview-strength.svg",
  whyUsHero: "/about/why-us-hero.svg",
  whyUsPlatforms: "/about/why-us-platforms.svg",
  whyUsData: "/about/why-us-data.svg",
  whyUsAnalysis: "/about/why-us-analysis.svg",
  whyUsTools: "/about/why-us-tools.svg",
  whyUsSupport: "/about/why-us-support.svg",
  transparencyHero: "/about/transparency-hero.svg",
  transparencySources: "/about/transparency-sources.svg",
  transparencyFunding: "/about/transparency-funding.svg",
  transparencyCorrections: "/about/transparency-corrections.svg",
  securityHero: "/about/security-hero.svg",
  securityTrust: "/about/security-trust.svg",
  securityData: "/about/security-data.svg",
  supportHero: "/about/support-hero.svg",
  supportMentors: "/about/support-mentors.svg",
} satisfies Record<string, AboutImage>;

export type AboutMediaKey = keyof typeof ABOUT_MEDIA;

/** Intrinsic size of a generated piece, so `next/image` never guesses. */
export const ABOUT_MEDIA_SIZE = {
  hero: { width: 1600, height: 900 },
  callout: { width: 1200, height: 900 },
} as const;
