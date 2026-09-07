// The /news listing's own imagery — the fourth instance of ADR-047 §3's
// media pattern, after About, the economic calendar and the homepage. Same
// contract, unchanged: a path renders a real image, `null` renders a
// designed panel, and the page reads as finished at either stage.
//
// Only the page's CHROME is listed here. The listing's real imagery is the
// articles' own cover images, which are content and live in the database —
// nothing about an editor's photograph belongs in a code registry.
//
// The two entries are filled with generated vector art (ADR-051 §5's
// system), emitted by `apps/web/scripts/generate-news-art.mjs` and committed
// under `apps/web/public/news/`. Re-run the generator; never hand-edit an
// SVG.
//
// TODO(owner): to swap in a photograph, drop the file into `public/news/`
// and point the entry at it. Nothing else changes — no component knows the
// difference. A photograph that CARRIES meaning would also need a real alt
// string; see `NewsBackdrop`.

export type NewsImage = string | null;

export const NEWS_MEDIA = {
  /** Behind the masthead's headline, under `PageHero`'s scrim. */
  banner: "/news/banner.svg",
  /** Behind the "browse by topic" band. */
  topics: "/news/topics.svg",
} satisfies Record<string, NewsImage>;

export type NewsMediaKey = keyof typeof NEWS_MEDIA;

/**
 * Intrinsic size of a generated backdrop (16:9). Matches `ART_SIZES.wide` in
 * `apps/web/scripts/lib/art.mjs` — stated so `next/image` never guesses.
 */
export const NEWS_MEDIA_SIZE = { width: 1600, height: 900 } as const;
