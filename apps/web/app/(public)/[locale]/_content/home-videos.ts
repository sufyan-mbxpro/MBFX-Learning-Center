// The learning showcase's video registry.
//
// Composition is code (ADR-042), and this is the composition: which lessons
// the rail offers, in what order, on which poster. What it deliberately does
// NOT hold is copy — titles, blurbs and the level label are catalog keys
// derived from `key` (code-style.md #2), so the rail translates like
// everything else under `app/(public)/**` (ADR-043 #1).
//
// ─── `url` is null on purpose, and that is the whole design ───────────────
//
// A video URL is a FACTUAL CLAIM: it asserts "this specific recording exists
// and teaches this". Inventing eleven-character YouTube ids would fabricate
// exactly that, and the ids would resolve to whatever happened to occupy them.
// So this file ships with every `url` null, and follows the About section's
// rule (ADR-047 §3): the surface renders complete without the claim, and the
// claim is a data edit away.
//
// What `null` renders is NOT a hole — it is the finished poster tile with a
// "coming soon" badge and no play affordance, the same posture
// `explore-destinations.ts` takes for routes that do not exist yet. Nobody is
// invited to press a button that cannot do anything.
//
// TODO(owner): paste a real watch URL into `url` and the tile becomes
// playable — nothing else changes. Accepted forms are whatever
// `parseVideoUrl` (@repo/utils) accepts: YouTube (watch / youtu.be / shorts /
// live / embed), Vimeo, Dailymotion. It is parsed, never trusted: a malformed
// id yields null and the tile stays in its "coming soon" state rather than
// emitting a broken iframe. Raw URLs never reach an `src` (security.md #9).
//
// If EVERY entry is removed the section renders nothing at all, which is the
// honest outcome for a video rail with no videos.

/** A poster under `apps/web/public/home/video/`, emitted by `generate-home-art.mjs`. */
export type VideoPoster = `/home/video/${string}.svg`;

export interface LearningVideo {
  /** Catalog + poster + art key. `basics` → `home.videoBasicsTitle`. */
  key: string;
  /** A watch URL, or null until a real recording exists. Parsed, never trusted. */
  url: string | null;
  poster: VideoPoster;
}

export const LEARNING_VIDEOS = [
  { key: "basics", url: null, poster: "/home/video/basics.svg" },
  { key: "candlesticks", url: null, poster: "/home/video/candlesticks.svg" },
  { key: "risk", url: null, poster: "/home/video/risk.svg" },
  { key: "levels", url: null, poster: "/home/video/levels.svg" },
  { key: "plan", url: null, poster: "/home/video/plan.svg" },
  { key: "psychology", url: null, poster: "/home/video/psychology.svg" },
] as const satisfies readonly LearningVideo[];

/**
 * Intrinsic poster size (16:9) — the shape of the player that replaces it, so
 * pressing play never reflows the rail. Matches `ART_SIZES.wide`.
 */
export const VIDEO_POSTER_SIZE = { width: 1600, height: 900 } as const;
