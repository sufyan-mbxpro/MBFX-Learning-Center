// Generates the glossary's artwork (ADR-051 §5's system, applied to the
// glossary surfaces — ADR-069's public half).
//
//   node apps/web/scripts/generate-glossary-art.mjs
//
// Writes `apps/web/public/glossary/*.svg`. Output is COMMITTED — this script is
// how the set is re-emitted when the brand moves, not a build step. Nothing at
// runtime runs it, and `next build` does not depend on it.
//
// Everything that decides how a piece LOOKS (palette, PRNG, scaffolding,
// motifs) lives in `lib/art.mjs`, shared with the About, homepage, news and
// learn generators. This file owns only the list.
//
// Three pieces, all `wide` backdrops — texture behind copy under a scrim, in
// `PageHero`'s `backdrop` slot. There are no card panels here because a
// glossary term has no cover to fall back FROM: a term is a definition, and
// the A–Z list is text by design.
//
// The `index` motif already existed and was written for exactly this surface
// ("an A–Z rail beside definition entries"). It had never been emitted,
// because until now no glossary page had a backdrop slot to put it in.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "glossary");

const PIECES = [
  // `/glossary` — the A–Z rail itself.
  { name: "banner", motif: "index", size: "wide" },
  // `/glossary/[term]` — one entry rather than the index of them. `layers`
  // reads as a single definition opened out into its levels, which is what
  // the page below it now is: simple, detailed, advanced, example.
  { name: "term-banner", motif: "layers", size: "wide" },
  // `/glossary/topics` — a network, because a topic is terms related to each
  // other rather than terms in alphabetical order.
  { name: "topics-banner", motif: "network", size: "wide" },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const piece of PIECES) {
  writeFileSync(join(OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}
console.log(`Wrote ${PIECES.length} files to ${OUT_DIR}`);
