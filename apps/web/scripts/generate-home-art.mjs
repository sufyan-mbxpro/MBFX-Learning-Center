// Generates the homepage explore-carousel's artwork (ADR-051 §5's system,
// applied to Module 12's homepage).
//
//   node apps/web/scripts/generate-home-art.mjs
//
// Writes `apps/web/public/home/*.svg`. Output is COMMITTED — this script is
// how the set is re-emitted when the brand moves, not a build step. Nothing at
// runtime runs it, and `next build` does not depend on it.
//
// Everything that decides how a piece LOOKS (palette, PRNG, scaffolding,
// motifs) lives in `lib/art.mjs`, shared with `generate-about-art.mjs`. This
// file owns only the list: which destination gets which motif, and why.
//
// One motif per destination, chosen so the picture is ABOUT the thing rather
// than decorative — the same standard the About set holds itself to. Four of
// the motifs were added for this set (`path`, `calendar`, `feed`, `index`)
// because nothing existing said "a route through material", "a month with
// releases flagged", "a stack of articles" or "an A–Z of definitions".
//
// Every piece is `card` size (1440×900, 16:10) because that is exactly
// `HomeMedia`'s box — a real file and the toned fallback panel occupy
// identical space, so swapping one in never reflows the carousel.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "home");

/**
 * Names match the keys in `_content/home-media.ts`, which match the keys in
 * `_sections/explore-destinations.ts`. One string addresses the art, the
 * media entry, the four catalog keys and the card — which is what keeps a
 * new destination a one-line change in each of four places instead of a hunt.
 */
const PIECES = [
  // A route through material, with the early milestones filled in.
  { name: "learn", motif: "path", size: "card" },
  // A dial at three quarters — the calculators.
  { name: "tools", motif: "gauge", size: "card" },
  // A month grid with the high-impact releases ringed.
  { name: "calendar", motif: "calendar", size: "card" },
  // A stack of article cards, the lead one brand-filled.
  { name: "news", motif: "feed", size: "card" },
  // Candlesticks with a moving average — the analysis desk.
  { name: "analysis", motif: "candles", size: "card" },
  // An A–Z rail beside definition entries.
  { name: "glossary", motif: "index", size: "card" },
  // An area chart with a marked point — live rates.
  { name: "markets", motif: "line", size: "card" },
  // The globe the About section already opens with, so the card that points
  // at that section is visibly the same family as the page it leads to.
  { name: "about", motif: "globe", size: "card" },
];

/**
 * Video posters for the learning showcase, keyed to `_content/home-videos.ts`.
 *
 * `wide` (1600×900) rather than `card`, because a video tile is 16:9 — the
 * shape of the player that replaces it on play. A poster at the wrong ratio
 * would make the tile jump the moment someone pressed play, which is the one
 * thing a facade exists to avoid.
 *
 * Motifs are chosen to say what the lesson is ABOUT, so the rail reads as a
 * curriculum rather than six decorative rectangles: the market itself, then
 * the chart, then risk, then structure, then process, then the trader.
 */
const VIDEO_PIECES = [
  { name: "basics", motif: "globe", size: "wide" },
  { name: "candlesticks", motif: "candles", size: "wide" },
  { name: "risk", motif: "gauge", size: "wide" },
  { name: "levels", motif: "line", size: "wide" },
  { name: "plan", motif: "path", size: "wide" },
  { name: "psychology", motif: "flow", size: "wide" },
];

const VIDEO_OUT_DIR = join(OUT_DIR, "video");

mkdirSync(OUT_DIR, { recursive: true });
for (const piece of PIECES) {
  writeFileSync(join(OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}

mkdirSync(VIDEO_OUT_DIR, { recursive: true });
for (const piece of VIDEO_PIECES) {
  writeFileSync(join(VIDEO_OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}

console.log(
  `Wrote ${PIECES.length} files to ${OUT_DIR} and ${VIDEO_PIECES.length} to ${VIDEO_OUT_DIR}`,
);
