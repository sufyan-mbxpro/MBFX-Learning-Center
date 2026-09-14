// Cover art for a video topic that has none of its own.
//
// The fourth use of the ADR-047 §3 media pattern, after `courseCoverUrl`,
// `quizCoverUrl` and the learn track panels: generated, committed, byte-
// deterministic art (`scripts/generate-home-art.mjs`), picked by hashing a
// slug so a topic keeps the same panel across renders, locales and deploys.
//
// A topic with a real `coverAssetId` never reaches this — the caller falls
// back to it, it does not override. The panels are abstract by design: they
// illustrate "a lesson about markets", which is true of every topic here, and
// they assert nothing about the recording behind the tile.
//
// This is deliberately NOT a MediaAsset seed. Seeding asset rows means
// seeding BYTES, and a `MediaAsset` whose file does not exist 404s in every
// picker and every `next/image` request — the failure mode the videos seed
// already refuses for uploaded video sources. A public path needs neither.

/** The panels emitted under `apps/web/public/home/video/`. */
const VIDEO_COVERS = [
  "/home/video/basics.svg",
  "/home/video/candlesticks.svg",
  "/home/video/risk.svg",
  "/home/video/levels.svg",
  "/home/video/plan.svg",
  "/home/video/psychology.svg",
] as const;

/** Intrinsic size of every panel (16:9) — `ART_SIZES.wide`. */
export const VIDEO_COVER_SIZE = { width: 1600, height: 900 } as const;

/**
 * A stable panel for `slug`.
 *
 * FNV-1a over the slug's code units. Not a cryptographic hash and not trying
 * to be one — it needs to be stable and cheap, and `String.prototype.hashCode`
 * does not exist. The same function `quizCoverUrl` uses, for the same reason.
 */
export function videoTopicCoverUrl(slug: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return VIDEO_COVERS[hash % VIDEO_COVERS.length] as string;
}
