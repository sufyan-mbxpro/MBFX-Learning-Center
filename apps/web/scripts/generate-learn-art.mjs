// Generates the Learn area's artwork (ADR-051 §5's system, applied to Module
// 12's learning surfaces).
//
//   node apps/web/scripts/generate-learn-art.mjs
//
// Writes `apps/web/public/learn/*.svg`. Output is COMMITTED — this script is
// how the set is re-emitted when the brand moves, not a build step. Nothing at
// runtime runs it, and `next build` does not depend on it.
//
// Everything that decides how a piece LOOKS (palette, PRNG, scaffolding,
// motifs) lives in `lib/art.mjs`, shared with the About, homepage and news
// generators. This file owns only the list.
//
// Two kinds of piece, and the distinction is the whole reason the list is not
// longer:
//
//   BACKDROPS (`wide`) sit behind copy under a scrim at low opacity —
//   `PageHero`'s `backdrop` slot. They are texture.
//
//   TRACK PANELS and QUIZ PANELS (`card`) stand in for a cover that does
//   not exist yet.
//   A course whose editor has uploaded artwork always renders that artwork;
//   these are what the shelf shows instead of an empty grey box, and they are
//   keyed by TRACK rather than by course so a new course inherits its track's
//   panel without anyone generating anything. They are not pretending to be
//   photographs of a course, and they carry `alt=""` for that reason.
//
// The motif on each track panel is a picture of what the track is about — a
// candlestick series for forex, a node network for crypto — so a shelf of
// cover-less courses still reads as two distinct subjects rather than as one
// repeated placeholder.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArt } from "./lib/art.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "learn");

const PIECES = [
  // A route through material — the same motif the homepage's `learn`
  // destination card carries, so the card that points here and the page it
  // lands on are visibly one family.
  { name: "banner", motif: "path", size: "wide" },
  // The course-detail masthead. `layers` is a picture of a curriculum:
  // stacked sections, one of them lit.
  { name: "course-banner", motif: "layers", size: "wide" },
  // Track panels. Names match the `LEARN_TRACKS` keys in @repo/contracts —
  // one string addresses the registry entry, the catalog copy and the art.
  { name: "track-forex", motif: "candles", size: "card" },
  { name: "track-crypto", motif: "network", size: "card" },
  // The quiz index's masthead. A dial, because a quiz ends in a score.
  { name: "quiz-banner", motif: "gauge", size: "wide" },
  // QUIZ PANELS. A quiz has no cover column and never will — it is a set of
  // questions, not a publication — so unlike a course it has no editor
  // artwork to fall back FROM. These four are the whole supply, and
  // `quizCoverUrl()` picks one per quiz by hashing its slug: deterministic
  // (the same quiz is always the same picture, on every render and every
  // machine) and varied — a shelf of six quizzes in one school does not show
  // one placeholder six times, which a track-keyed panel would.
  //
  // The motifs are pictures of what taking a quiz IS — a score dial, a
  // question and its answer, a set of results, a choice resolving to one
  // outcome — rather than of the subject, which the card's category badge
  // already names in words.
  { name: "quiz-gauge", motif: "gauge", size: "card" },
  { name: "quiz-bubbles", motif: "bubbles", size: "card" },
  { name: "quiz-bars", motif: "bars", size: "card" },
  { name: "quiz-flow", motif: "flow", size: "card" },
  // The video index's masthead. A feed, because the page is a shelf of
  // separate pieces rather than one sequence — a curriculum's "layers" would
  // promise an order that video topics deliberately do not have.
  { name: "video-banner", motif: "feed", size: "wide" },
  // VIDEO PANELS. Same reasoning as the quiz panels one block up, and the
  // same mechanism: a video topic has a cover COLUMN an editor can fill, so
  // unlike a quiz this is a fallback rather than the whole supply —
  // `videoCoverUrl()` prefers the editor's cover and hashes the slug only
  // when there is none. Four, so a shelf without covers still varies.
  //
  // Not keyed by track, for the reason the quiz panels are not: one school's
  // shelf showing a single placeholder down the whole grid reads as a
  // rendering fault rather than as a house style.
  //
  // Ordering is load-bearing — the index a slug hashes to must not move, or
  // every topic silently changes picture. Append; never reorder or remove.
  { name: "video-play", motif: "orbit", size: "card" },
  { name: "video-frames", motif: "layers", size: "card" },
  { name: "video-signal", motif: "line", size: "card" },
  { name: "video-reel", motif: "bubbles", size: "card" },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const piece of PIECES) {
  writeFileSync(join(OUT_DIR, `${piece.name}.svg`), renderArt(piece));
}
console.log(`Wrote ${PIECES.length} files to ${OUT_DIR}`);
