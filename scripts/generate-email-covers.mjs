#!/usr/bin/env node
// Raster covers for announcement emails (ADR-171, changes-54 §7).
//
// A course with no uploaded cover falls back to its track's generated panel
// on the web — an SVG. Gmail and Outlook do not render an SVG `<img>`, so an
// email needs the same panel as a PNG. This renders the committed SVGs once;
// the output is committed, like every other generated asset. Re-run it after
// `generate-home-art.mjs` changes a track panel, never hand-edit the PNGs.
//
//   node scripts/generate-email-covers.mjs
//
// 1120×840 is the 4:3 card cover at twice the 560px email column, so it is
// sharp on a high-density screen and small enough to arrive quickly.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "apps", "web", "public");
// sharp is a declared dependency of @repo/core (the upload pipeline), not of
// the root, so it is resolved from there — the og-default script's approach.
const sharp = createRequire(join(ROOT, "packages", "core", "package.json"))("sharp");

const TRACKS = ["forex", "crypto"];
const WIDTH = 1120;
const HEIGHT = 840;

mkdirSync(join(PUBLIC, "email"), { recursive: true });

for (const track of TRACKS) {
  const source = join(PUBLIC, "learn", `track-${track}.svg`);
  const target = join(PUBLIC, "email", `track-${track}.png`);
  await sharp(source, { density: 300 })
    .resize(WIDTH, HEIGHT, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(target);
  console.log(`wrote ${target}`);
}
