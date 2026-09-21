// Homepage imagery — the same pattern the About section (ADR-047 §3) and the
// economic calendar (ADR-050) already use, third instance, unchanged.
//
// A `null` entry is not a defect. `HomeMedia` renders a toned panel carrying
// the destination's own glyph instead, so the homepage ships complete with no
// photography committed to the repo, and real assets land later without
// touching a single component.
//
// Every explore card now carries OWNER-SUPPLIED PHOTOGRAPHY, and that is what
// the pattern was built for: the swap was this file plus one conditional in
// `HomeMedia`, and no card, section or test knew the difference. The files
// were fitted to `HOME_MEDIA_SIZE` (1440×900, 16:10 — exactly `HomeMedia`'s
// box, so nothing reflows) and written as WebP.
//
// The generated vector set that used to fill these slots is gone with them.
// `markets` was the last holdout — no photograph was supplied for a section
// that is still `soon` — and changes-32 removed that card from the carousel
// altogether, so `apps/web/scripts/generate-home-art.mjs` now emits the video
// posters and nothing else. A generator that keeps writing files nothing reads
// is how `public/` fills with orphans that look maintained.
//
// TODO(owner): to replace a photograph, fit it to 1440×900 and drop it in
// `public/home/` under the destination's key. The only thing that is NOT
// automatic is the alt text: everything here is decorative today (the card's
// own heading names the destination), so `HomeMedia` renders `alt=""`. A
// picture that carries a fact the copy does not would need a catalog string
// and an `alt` prop on that component.

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

  /**
   * `in_practice`'s middle column (owner, 2026-09-17).
   *
   * Static footage, not a `VideoTopic` — the owner asked for this clip in the
   * column between the quotes and the tools, playing on its own. Re-encoded
   * from `storage/uploads/The platform/308077_medium.mp4` (2560x1440, 10.4 MB)
   * to 1280x720 H.264 CRF 28, no audio track, `+faststart`: ~0.96 MB. The
   * column is at most ~430px wide, so 720p is already twice what it paints.
   * The poster is that file's own first frame.
   */
  practiceVideo: "/home/practice.mp4",
  practicePoster: "/home/practice-poster.webp",

  // Explore-carousel cards, in registry order. File names match these keys,
  // which match the destination keys — one string addresses the art, this
  // entry, the catalog copy and the card.
  //
  // Owner photography, fitted to 1440x900.
  learn: "/home/learn.webp",
  glossary: "/home/glossary.webp",
  tools: "/home/tools.webp",
  calendar: "/home/calendar.webp",
  analysis: "/home/analysis.webp",
  news: "/home/news.webp",
} satisfies Record<string, HomeImage>;

export type HomeMediaKey = keyof typeof HOME_MEDIA;

/**
 * Intrinsic size of a generated card piece (16:10), so `next/image` never
 * guesses and the toned fallback panel occupies identical space. Matches
 * `ART_SIZES.card` in `apps/web/scripts/lib/art.mjs`.
 */
export const HOME_MEDIA_SIZE = { width: 1440, height: 900 } as const;
