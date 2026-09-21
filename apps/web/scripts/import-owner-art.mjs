#!/usr/bin/env node
// changes-33 — turns the owner's supplied artwork into the committed WebP the
// public pages read.
//
// The same job `generate-home-art.mjs` and its siblings do for generated
// vector panels, for photography instead: a one-shot importer whose
// OUTPUT is committed, so a clone needs neither this script nor the source
// files. The sources live in `apps/web/storage/uploads/**`, which is
// git-ignored — that is exactly why the output has to be committed and why
// this is not part of any build.
//
// Two destinations, and the split matters:
//
//   - `public/banners/*.webp` — section mastheads, read through each area's
//     own `_content/*-media.ts` (the ADR-047 §3 pattern). Wide and
//     full-bleed: they sit behind a `PageHero`, under a scrim, so they are
//     encoded for size rather than for detail nobody can see.
//   - `public/home/*.webp` — the explore-carousel cards, which ARE looked at,
//     fitted to `HOME_MEDIA_SIZE` (1440×900) so nothing reflows when one is
//     swapped.
//
// Re-running it is safe and byte-stable: same inputs, same encoder settings,
// same output. Never hand-edit a file it writes.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// Resolved through `next`'s own resolution rather than declared as a
// dependency of `apps/web`: this is a one-shot authoring tool whose output is
// committed, and `check:phantom-deps` rightly objects to an import no shipped
// code path uses. `next` depends on sharp, so it is present in every install
// that can build the app — but pnpm's strict layout does not hoist it, hence
// the two-step resolve rather than a bare `require("sharp")`.
const require = createRequire(import.meta.url);
const sharp = require(createRequire(require.resolve("next/package.json")).resolve("sharp"));

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "storage", "uploads");
const BANNERS_OUT = join(ROOT, "public", "banners");
const HOME_OUT = join(ROOT, "public", "home");

/** Masthead backdrops. 1920 wide is the widest they are ever painted. */
const BANNERS = [
  // The two schools, named by the owner's own filenames.
  ["banners/learn forex.jpg", "learn-forex"],
  ["banners/crypto learning-home.png", "learn-crypto"],
  // The learning umbrella: a graduation cap among search, video and cloud
  // glyphs — the one piece in the set that is about LEARNING rather than
  // about markets.
  ["banners/i (2).png", "learn-hub"],
  ["banners/i (3).png", "quizzes"],
  ["banners/i (5).png", "videos"],
  // A magnifying glass over a data sheet: looking something up.
  ["banners/i (7).png", "glossary"],
  ["banners/i (9).png", "news"],
  // changes-40: the owner's own banner for /analysis, replacing the stock
  // piece this slot opened with. Same name, so nothing that reads
  // `/banners/analysis.webp` changes.
  ["banners/analysis.png", "analysis"],
  // The glossary's TOPIC pages (changes-40). Its own piece rather than
  // `glossary.webp` reused: /glossary and /glossary/topics are two banners a
  // reader sees one after the other, and the same photograph twice reads as a
  // page that did not navigate.
  ["banners/glossary-topics.png", "glossary-topics"],
  // World clocks on a trading desk — the only piece in the set that is about
  // TIME, which is what an economic calendar is.
  ["banners/i (1).png", "calendar"],
  ["banners/i (8).png", "tools"],
  ["banners/i.png", "support"],
  // changes-39: the owner's own banner for the reader's sitemap.
  ["banners/sitemap-banner.png", "sitemap"],
  // Spares, not dead entries. Having the art ready is what makes adding the
  // section that uses one a one-line change in its `_content/*-media.ts`.
  ["banners/i (4).png", "spare-crypto"],
  ["banners/i (6).png", "spare-sentiment"],
  ["banners/crypto-learning banner.jpg", "spare-digital"],
  ["banners/d013927268.jpg", "spare-forex"],
];

/**
 * 4:3 CALLOUTS — a media column beside a headline, not a backdrop behind one.
 *
 * Its own list because the crop is the whole difference: the calendar's hero
 * slot renders inside `ImageReveal` at ratio 4/3 with no `object-cover`, so a
 * 3:1 banner dropped into it is not cropped, it is STRETCHED. A separate
 * output at the box's own ratio is one line here and no special case anywhere
 * else.
 */
const CALLOUTS = [
  // changes-36: the calendar's "Using it" callout. The world map under release
  // figures is the picture the explore carousel already gives the calendar,
  // so a reader who arrived from that card sees the same subject again — and
  // it is a different picture from the clocks in the masthead above it.
  ["The platform/calendars.png", "calendar-how-to"],
];

/** Explore-carousel cards. Fitted to HOME_MEDIA_SIZE so nothing reflows. */
const HOME_CARDS = [
  ["The platform/news.png", "news"],
  ["The platform/Analysis.png", "analysis"],
];

const BANNER = { width: 1920, height: 640 };
const CALLOUT = { width: 1200, height: 900 };
const CARD = { width: 1440, height: 900 };

async function convert(from, to, size) {
  await sharp(join(SRC, from))
    // `cover`, not `contain`: a backdrop with letterbox bars is a broken
    // backdrop. `attention` puts the crop where the picture's subject is,
    // which for this set is usually off-centre.
    .resize(size.width, size.height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 78, effort: 6 })
    .toFile(to);
  return to;
}

mkdirSync(BANNERS_OUT, { recursive: true });
mkdirSync(HOME_OUT, { recursive: true });

for (const [from, name] of BANNERS) {
  const out = join(BANNERS_OUT, `${name}.webp`);
  await convert(from, out, BANNER);
  console.log(`banner  ${name}.webp  ← ${from}`);
}
for (const [from, name] of CALLOUTS) {
  const out = join(BANNERS_OUT, `${name}.webp`);
  await convert(from, out, CALLOUT);
  console.log(`callout ${name}.webp  ← ${from}`);
}
for (const [from, name] of HOME_CARDS) {
  const out = join(HOME_OUT, `${name}.webp`);
  await convert(from, out, CARD);
  console.log(`card    ${name}.webp  ← ${from}`);
}
