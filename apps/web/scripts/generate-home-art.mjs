// Generates the learning showcase's video posters (ADR-051 §5's system,
// applied to Module 12's homepage).
//
//   node apps/web/scripts/generate-home-art.mjs
//
// Writes `apps/web/public/home/video/*.svg`. Output is COMMITTED — this script
// is how the set is re-emitted when the brand moves, not a build step. Nothing
// at runtime runs it, and `next build` does not depend on it.
//
// It used to emit the explore carousel's eight cards too, which is what the
// file is named for. Seven of those became owner photography in changes-32 and
// the eighth (`markets`) left the carousel with the card, so the card set is
// gone from here: a generator that keeps writing files nothing reads is how
// `public/` fills with orphans that look maintained. Restoring one means a
// line in a `PIECES` array of its own, `size: "card"`, and a `.svg` in
// `_content/home-media.ts`.
//
// Everything that decides how a piece LOOKS (palette, PRNG, scaffolding,
// motifs) lives in `lib/art.mjs`, extracted when `generate-about-art.mjs`
// and this one needed the same engine (that generator left with the About
// section, changes-33 / ADR-109; the shared module stayed). This
// file owns only the list: which poster gets which motif, and why. All the
// motifs the card set used are still there (`path`, `gauge`, `calendar`,
// `feed`, `candles`, `index`, `globe`) — the About set and the posters below
// still use several.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "home");

/**
 * Video posters for the learning showcase — the pool `_content/video-covers.ts`
 * picks from for a topic with no cover asset of its own (ADR-092).
 *
 * `wide` (1600×900) rather than `card`, because a video tile is 16:9 — the
 * shape of the player that replaces it on play. A poster at the wrong ratio
 * would make the tile jump the moment someone pressed play, which is the one
 * thing a facade exists to avoid.
 *
 * Motifs cover the shapes a trading lesson takes, so whichever one a topic
 * hashes to still reads as being about markets: the market itself, the chart,
 * risk, structure, process, the trader. Since ADR-092 they are a POOL rather
 * than a per-lesson pairing — the rail's copy comes from the database, so no
 * poster is promised to any particular topic.
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

mkdirSync(VIDEO_OUT_DIR, { recursive: true });
for (const piece of VIDEO_PIECES) {
  writeFileSync(join(VIDEO_OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}

console.log(`Wrote ${VIDEO_PIECES.length} files to ${VIDEO_OUT_DIR}`);
