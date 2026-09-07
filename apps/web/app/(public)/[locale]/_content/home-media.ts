// Homepage imagery — the same pattern the About section (ADR-047 §3) and the
// economic calendar (ADR-050) already use, third instance, unchanged.
//
// A `null` entry is not a defect. `HomeMedia` renders a toned panel carrying
// the destination's own glyph instead, so the homepage ships complete with no
// photography committed to the repo, and real assets land later without
// touching a single component.
//
// The card slots are filled with generated vector art (ADR-051 §5's system,
// applied here), emitted by `apps/web/scripts/generate-home-art.mjs` and
// committed under `apps/web/public/home/`. It is not photography and is not
// pretending to be: brand-toned abstract artwork whose motif matches the
// destination it sits on — a route through material for the learning paths, a
// month with releases ringed for the calendar, an A–Z rail for the glossary.
//
// TODO(owner): to swap in real photography, drop the file into `public/home/`
// and point the entry at it. Nothing else changes — no component knows the
// difference between a photograph and a generated panel. A photograph that
// CARRIES meaning would also need a real alt string; see `HomeMedia`.

export type HomeImage = string | null;

/**
 * Keyed by the destination keys in `_sections/explore-destinations.ts`, plus
 * the hero. The two files are kept in step by `EXPLORE_DESTINATIONS`' own
 * `media` field being typed as `HomeMediaKey` — a destination pointing at an
 * entry that does not exist is a type error, not a broken image.
 */
export const HOME_MEDIA = {
  /** The hero's media column. The one entry with real artwork today. */
  hero: "/hero-app-mockup.jpg",

  // Explore-carousel cards, in registry order. File names match these keys,
  // which match the destination keys — one string addresses the art, this
  // entry, the catalog copy and the card.
  learn: "/home/learn.svg",
  glossary: "/home/glossary.svg",
  tools: "/home/tools.svg",
  markets: "/home/markets.svg",
  calendar: "/home/calendar.svg",
  analysis: "/home/analysis.svg",
  news: "/home/news.svg",
  about: "/home/about.svg",
} satisfies Record<string, HomeImage>;

export type HomeMediaKey = keyof typeof HOME_MEDIA;

/**
 * Intrinsic size of a generated card piece (16:10), so `next/image` never
 * guesses and the toned fallback panel occupies identical space. Matches
 * `ART_SIZES.card` in `apps/web/scripts/lib/art.mjs`.
 */
export const HOME_MEDIA_SIZE = { width: 1440, height: 900 } as const;
