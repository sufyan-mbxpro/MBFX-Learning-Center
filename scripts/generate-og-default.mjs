#!/usr/bin/env node
// Builds apps/web/public/og-default.png: the share image a page without its
// own cover falls back to (`seo.defaultOgImage`, seeded as `/og-default.png`).
//
// The setting pointed at that path from Module 05 on, and nothing ever put a
// file there, so every coverless share card was a 404. The OUTPUT is committed;
// re-run this rather than editing the PNG by hand.
//
//   node scripts/generate-og-default.mjs
//
// 1200×630 is the Open Graph / `summary_large_image` shape. The owner's learn
// banner is cropped to it, darkened so the white logo reads on any crop, and
// written as a palette PNG so a photographic card stays a few hundred KB.
import { createRequire } from "node:module";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
// sharp is a declared dependency of @repo/core (the upload pipeline), not of
// the workspace root; resolve it from there rather than adding a root dep.
const sharp = createRequire(join(ROOT, "packages", "core", "package.json"))("sharp");

const PUBLIC = join(ROOT, "apps", "web", "public");
const WIDTH = 1200;
const HEIGHT = 630;
const LOGO_WIDTH = 520;

const background = await sharp(join(PUBLIC, "banners", "learn-hub.webp"))
  .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
  .toBuffer();

// A flat 55% black veil: the banner is pale, and the logo is white line art.
const veil = await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.55 } },
})
  .png()
  .toBuffer();

// `logo-dark` is the variant drawn for a dark ground (white strokes).
const logo = await sharp(join(PUBLIC, "brand", "logo-dark.png"))
  .resize({ width: LOGO_WIDTH })
  .toBuffer();
const logoMeta = await sharp(logo).metadata();

await sharp(background)
  .composite([
    { input: veil, top: 0, left: 0 },
    {
      input: logo,
      top: Math.round((HEIGHT - (logoMeta.height ?? 0)) / 2),
      left: Math.round((WIDTH - LOGO_WIDTH) / 2),
    },
  ])
  .png({ palette: true, quality: 90, compressionLevel: 9 })
  .toFile(join(PUBLIC, "og-default.png"));

console.log("wrote apps/web/public/og-default.png");
