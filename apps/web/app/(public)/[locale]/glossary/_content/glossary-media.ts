// Glossary imagery — the same pattern the About section (ADR-047 §3), the
// economic calendar (ADR-050), the homepage (`_content/home-media.ts`), the
// news listing and the learn area already use. Fifth instance, unchanged.
//
// A `null` entry is not a defect: the surface renders complete without it.
// `GlossaryBackdrop` returns null, the slot goes undefined, and `PageHero`
// falls back to its own tone. No page has to remember to check.
//
// The pieces are generated vector art (ADR-051 §5's system), emitted by
// `apps/web/scripts/generate-glossary-art.mjs` and committed under
// `apps/web/public/glossary/`. Output is byte-deterministic — re-run the
// generator, never hand-edit an SVG.
//
// TODO(owner): to swap in real artwork, drop the file into `public/glossary/`
// and point the entry at it. Nothing else changes.

export type GlossaryImage = string | null;

/** Backdrops: full-bleed texture behind copy, never a framed image. */
export const GLOSSARY_MEDIA = {
  /** `/glossary` — the A–Z index. */
  banner: "/glossary/banner.svg",
  /** `/glossary/[term]` — one entry opened out into its levels. */
  termBanner: "/glossary/term-banner.svg",
  /** `/glossary/topics` and a topic's own page. */
  topicsBanner: "/glossary/topics-banner.svg",
} satisfies Record<string, GlossaryImage>;

export type GlossaryMediaKey = keyof typeof GLOSSARY_MEDIA;
