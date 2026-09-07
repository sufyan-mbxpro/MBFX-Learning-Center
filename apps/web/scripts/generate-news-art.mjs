// Generates the /news masthead's artwork (ADR-051 §5's system, applied to
// Module 15's public listing).
//
//   node apps/web/scripts/generate-news-art.mjs
//
// Writes `apps/web/public/news/*.svg`. Output is COMMITTED — this script is
// how the set is re-emitted when the brand moves, not a build step. Nothing
// at runtime runs it, and `next build` does not depend on it.
//
// Everything that decides how a piece LOOKS (palette, PRNG, scaffolding,
// motifs) lives in `lib/art.mjs`, shared with the About and homepage
// generators. This file owns only the list, and it is deliberately short:
// the news listing's imagery is mostly the ARTICLES' own cover images, so
// the generated pieces here are the two backdrops the page's own chrome
// needs and nothing more. A generated panel that competes with a real
// editorial photograph is a worse page, not a richer one.
//
// Both pieces are `wide` (1600×900) because both are full-bleed backdrops
// behind copy — `PageHero`'s `backdrop` slot and the topics band — rendered
// `object-cover` under a scrim at low opacity, never as a framed image.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "news");

const PIECES = [
  // A stack of article cards with the lead one brand-filled — the same
  // motif the homepage's `news` destination card carries, so the card that
  // points here and the page it lands on are visibly one family.
  { name: "banner", motif: "feed", size: "wide" },
  // An A–Z rail beside entries: the topics band is a way IN to the archive,
  // and an index is what that is a picture of.
  { name: "topics", motif: "index", size: "wide" },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const piece of PIECES) {
  writeFileSync(join(OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}
console.log(`Wrote ${PIECES.length} files to ${OUT_DIR}`);
