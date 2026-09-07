// Generates the About section's artwork (ADR-051 §5).
//
//   node apps/web/scripts/generate-about-art.mjs
//
// Writes `apps/web/public/about/*.svg`. Output is COMMITTED — this script is
// how the set is re-emitted when the brand moves, not a build step. Nothing
// at runtime runs it, and `next build` does not depend on it.
//
// Why generated vector art rather than photography (ADR-051 §5): no licensing
// provenance to defend on every page, a few KB against the public Lighthouse
// budget instead of megabytes, and one palette that reads correctly on both
// the light and the dark page background without a <picture> fork per slot.
//
// The one place hex literals are allowed to accumulate in this repo outside
// `@repo/theme` is here, because an external SVG cannot read a CSS custom
// property — the file is a sibling of the document, not part of it. The
// palette is therefore declared ONCE below and mirrors the theme's own brand
// hue (ADR-018's --primary, #E8B98C) so the art and the UI agree. If the
// brand moves, edit PALETTE and re-run; do not hand-edit the SVGs.
//
// Every piece is deterministic: the PRNG is seeded from the file name, so
// re-running produces byte-identical output and a diff means a real change.
//
// The palette, PRNG, scaffolding and motifs moved to `lib/art.mjs` when the
// homepage needed the same system (`generate-home-art.mjs`). Because each
// piece is seeded from its own file name, that move re-emits this set
// byte-identical — a diff here would mean a real change, not a refactor.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ART_SIZES, renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "about");
// coordinates nobody can review, where a 72×32 land mask is legible as source
// and edits in one character. The projection is plain equirectangular over
// longitude -180..180 and latitude 84..-56 — the SAME crop `about-facts.demo`
// converts its pin coordinates with, which is what keeps every pin on land.
// ---------------------------------------------------------------------------
const MAP_COLS = 72;
const MAP_ROWS = 32;

/** Inclusive [startCol, endCol] land spans per row, north to south. */
const LAND = [
  [
    [16, 22],
    [24, 31],
    [39, 40],
  ],
  [
    [14, 22],
    [24, 31],
    [38, 41],
    [46, 52],
  ],
  [
    [12, 22],
    [24, 31],
    [38, 41],
    [44, 60],
    [62, 66],
  ],
  [
    [10, 22],
    [25, 31],
    [38, 39],
    [43, 68],
  ],
  [
    [9, 22],
    [26, 30],
    [32, 33],
    [36, 70],
  ],
  [
    [8, 22],
    [32, 33],
    [35, 70],
  ],
  [
    [8, 22],
    [34, 70],
  ],
  [
    [8, 22],
    [34, 70],
  ],
  [
    [9, 22],
    [34, 70],
  ],
  [
    [10, 22],
    [34, 70],
  ],
  [
    [11, 22],
    [34, 44],
    [46, 70],
  ],
  [
    [12, 21],
    [34, 45],
    [47, 66],
  ],
  [
    [13, 20],
    [33, 45],
    [47, 60],
    [62, 63],
  ],
  [
    [14, 20],
    [33, 46],
    [48, 58],
    [60, 61],
  ],
  [
    [15, 20],
    [33, 47],
    [49, 52],
    [55, 58],
  ],
  [
    [16, 21],
    [33, 47],
    [49, 51],
    [55, 59],
  ],
  [
    [17, 22],
    [33, 46],
    [49, 50],
    [56, 59],
  ],
  [
    [19, 24],
    [34, 45],
    [56, 60],
  ],
  [
    [19, 25],
    [35, 46],
    [56, 61],
  ],
  [
    [20, 26],
    [36, 46],
    [56, 62],
  ],
  [
    [20, 27],
    [36, 46],
    [57, 63],
  ],
  [
    [21, 28],
    [37, 46],
    [58, 64],
    [65, 66],
  ],
  [
    [21, 28],
    [37, 46],
    [60, 65],
  ],
  [
    [21, 28],
    [37, 45],
    [58, 66],
  ],
  [
    [22, 28],
    [37, 45],
    [58, 66],
  ],
  [
    [22, 28],
    [38, 45],
    [58, 66],
  ],
  [
    [22, 27],
    [38, 44],
    [58, 66],
  ],
  [
    [23, 26],
    [39, 42],
    [59, 65],
    [69, 70],
  ],
  [
    [23, 26],
    [62, 64],
    [69, 71],
  ],
  [
    [23, 26],
    [70, 71],
  ],
  [[24, 25]],
  [[24, 25]],
];

function worldMap() {
  // A 720×320 box keeps every coordinate three digits or fewer, and rows are
  // grouped under one translate so a dot costs ~24 bytes instead of ~48. The
  // whole map is inlined into the page, so its byte count is DOM weight on a
  // public route, not a cached asset.
  const w = 720;
  const h = 320;
  const cell = w / MAP_COLS;
  const rowH = h / MAP_ROWS;
  const r = Math.round(Math.min(cell, rowH) * 0.32 * 10) / 10;
  const rows = LAND.map((spans, row) => {
    const dots = [];
    for (const [from, to] of spans) {
      for (let col = from; col <= to; col += 1) {
        dots.push(`<circle cx="${Math.round(cell * (col + 0.5))}" r="${r}"/>`);
      }
    }
    return `<g transform="translate(0 ${Math.round(rowH * (row + 0.5))})">${dots.join("")}</g>`;
  }).join("");
  // currentColor, not a palette hex: this one renders INLINE inside the page
  // (HotspotMap's mapSlot), so it can and should inherit the theme's ink.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="presentation" aria-hidden="true"><g fill="currentColor">${rows}</g></svg>
`;
}

// ---------------------------------------------------------------------------
// The pieces. `wide` is a 16:9 page masthead; the rest are 4:3 callout media,
// matching SplitCallout's own aspect box so a real file and the gradient
// fallback occupy identical space.

// ---------------------------------------------------------------------------
// The pieces. `wide` is a 16:9 page masthead; the rest are 4:3 callout media,
// matching SplitCallout's own aspect box so a real file and the gradient
// fallback occupy identical space.
// ---------------------------------------------------------------------------
const PIECES = [
  { name: "overview-hero", motif: "globe", size: "wide" },
  { name: "overview-strength", motif: "bars" },
  { name: "why-us-hero", motif: "dashboard", size: "wide" },
  { name: "why-us-platforms", motif: "dashboard" },
  { name: "why-us-data", motif: "candles" },
  { name: "why-us-analysis", motif: "line" },
  { name: "why-us-tools", motif: "gauge" },
  { name: "why-us-support", motif: "bubbles" },
  { name: "transparency-hero", motif: "flow", size: "wide" },
  { name: "transparency-sources", motif: "network" },
  { name: "transparency-funding", motif: "flow" },
  { name: "transparency-corrections", motif: "line" },
  { name: "security-hero", motif: "shield", size: "wide" },
  { name: "security-trust", motif: "shield" },
  { name: "security-data", motif: "layers" },
  { name: "support-hero", motif: "orbit", size: "wide" },
  { name: "support-mentors", motif: "orbit" },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const piece of PIECES) {
  writeFileSync(join(OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}
writeFileSync(join(OUT_DIR, "world-dots.svg"), worldMap());
console.log(
  `Wrote ${PIECES.length + 1} files to ${OUT_DIR} (sizes: ${Object.keys(ART_SIZES).join(", ")})`,
);
