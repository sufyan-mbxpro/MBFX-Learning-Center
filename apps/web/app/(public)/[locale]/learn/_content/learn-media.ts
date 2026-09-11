// Learn-area imagery — the same pattern the About section (ADR-047 §3), the
// economic calendar (ADR-050), the homepage (`_content/home-media.ts`) and the
// news listing already use. Fourth instance, unchanged.
//
// A `null` entry is not a defect: the surface renders complete without it.
// `LearnBackdrop` returns null, the slot goes undefined, and `PageHero` falls
// back to its own tone. No page has to remember to check.
//
// The pieces are generated vector art (ADR-051 §5's system), emitted by
// `apps/web/scripts/generate-learn-art.mjs` and committed under
// `apps/web/public/learn/`. It is not photography and is not pretending to
// be: brand-toned abstract artwork whose motif matches the surface it sits on
// — a route through material for the section front, stacked sections for a
// course, a candlestick series for the forex track.
//
// TODO(owner): to swap in real photography, drop the file into `public/learn/`
// and point the entry at it. Nothing else changes — no component knows the
// difference between a photograph and a generated panel. A photograph that
// CARRIES meaning would also need a real alt string; see `LearnBackdrop`.
import { LEARN_TRACK_KEYS, type LearnTrackKey } from "@repo/contracts";
import { pickByHash } from "@repo/utils";

export type LearnImage = string | null;

/** Backdrops: full-bleed texture behind copy, never a framed image. */
export const LEARN_MEDIA = {
  /** `/learn`'s masthead. */
  banner: "/learn/banner.svg",
  /** `/learn/[course]`'s masthead, behind a course with no cover of its own. */
  courseBanner: "/learn/course-banner.svg",
  /** `/learn/[track]/quizzes`'s masthead. */
  quizBanner: "/learn/quiz-banner.svg",
  /** `/learn/[track]/videos`'s masthead. */
  videoBanner: "/learn/video-banner.svg",
} satisfies Record<string, LearnImage>;

export type LearnMediaKey = keyof typeof LEARN_MEDIA;

/**
 * Track panels: what a course with NO cover of its own shows on the shelf.
 *
 * Keyed by track rather than by course, deliberately — a new course inherits
 * its track's panel with no asset work, and the shelf never shows the same
 * placeholder twice in two different subjects. A course that HAS a cover
 * always renders that cover; this is the floor, not an override.
 *
 * Typed as a total map over `LearnTrackKey`, so registering a third track in
 * @repo/contracts is a type error here until its panel exists — which is the
 * point at which someone would otherwise ship a grey box.
 */
export const LEARN_TRACK_MEDIA: Record<LearnTrackKey, LearnImage> = {
  forex: "/learn/track-forex.svg",
  crypto: "/learn/track-crypto.svg",
};

/**
 * The cover a card should render: the course's own, else its track's panel,
 * else nothing (and the card draws its no-artwork state).
 *
 * One function so the three surfaces that show a course card — the shelf, the
 * "continue" band and the course sidebar — cannot disagree about which
 * picture a given course has.
 */
export function courseCoverUrl(coverUrl: string | null, track: string): string | null {
  if (coverUrl) return coverUrl;
  return (LEARN_TRACK_MEDIA as Record<string, LearnImage>)[track] ?? null;
}

/** True when a URL came from `LEARN_TRACK_MEDIA` rather than from an editor.
 *
 * The distinction matters at exactly one place: `next/image` is told
 * `unoptimized` for generated SVG (there is nothing for the optimizer to win,
 * and `dangerouslyAllowSVG` would relax handling for every admin-entered URL
 * too — the trade `NewsBackdrop` already refused). */
export function isGeneratedCover(url: string): boolean {
  return url.startsWith("/learn/");
}

/**
 * Intrinsic size of a generated track panel (16:10). Matches `ART_SIZES.card`
 * in `apps/web/scripts/lib/art.mjs`.
 */
export const LEARN_TRACK_MEDIA_SIZE = { width: 1440, height: 900 } as const;

/**
 * The quiz panels — what a quiz card shows where a course card shows a cover.
 *
 * A quiz has no cover column and is never getting one: it is a set of
 * questions, not a publication, so there is no editor artwork for
 * `quizCoverUrl` to prefer over these. That makes the choice a pure function
 * of the quiz's own identity, and this is deliberately NOT keyed by track the
 * way `LEARN_TRACK_MEDIA` is — one school's shelf would then repeat a single
 * placeholder down the whole grid, which reads as a rendering fault rather
 * than as a house style.
 *
 * Ordering is load-bearing: the index a slug hashes to must not move, or every
 * quiz silently changes picture. Append to the end; never reorder or remove.
 */
export const QUIZ_PANELS = [
  "/learn/quiz-gauge.svg",
  "/learn/quiz-bubbles.svg",
  "/learn/quiz-bars.svg",
  "/learn/quiz-flow.svg",
] as const;

/**
 * The panel a quiz shows, chosen from its slug.
 *
 * Deterministic on purpose, and for the same reason the glossary's term of the
 * day is (D29): a picture that changes when nothing about the quiz changed
 * makes the page look unstable, and a stored column would be an editor chore
 * for a decision no editor has an opinion about.
 *
 * Always returns a string — unlike `courseCoverUrl`, there is no null case,
 * because the supply is code and cannot be empty.
 */
export function quizCoverUrl(slug: string): string {
  return pickByHash(slug, QUIZ_PANELS);
}

/**
 * The video panels — what a video topic shows when it has no cover of its own.
 *
 * Unlike `QUIZ_PANELS`, this is a FALLBACK rather than the whole supply: a
 * `VideoTopic` has a `coverAssetId` column an editor can fill, so
 * `videoCoverUrl()` prefers that and reaches here only when it is empty —
 * `courseCoverUrl`'s shape, with a hashed panel where that one has a track
 * panel.
 *
 * Deliberately NOT keyed by track, for the reason `QUIZ_PANELS` is not: one
 * school's shelf showing a single placeholder down the whole grid reads as a
 * rendering fault rather than as a house style.
 *
 * Ordering is load-bearing: the index a slug hashes to must not move, or every
 * topic silently changes picture. Append to the end; never reorder or remove.
 */
export const VIDEO_PANELS = [
  "/learn/video-play.svg",
  "/learn/video-frames.svg",
  "/learn/video-signal.svg",
  "/learn/video-reel.svg",
] as const;

/**
 * The cover a video card should render: the topic's own, else a panel chosen
 * from its slug.
 *
 * Always returns a string — there is no null case, because the fallback supply
 * is code and cannot be empty. That is why the signature differs from
 * `courseCoverUrl`, which can legitimately return null and let the card draw
 * its no-artwork state.
 */
export function videoCoverUrl(coverUrl: string | null, slug: string): string {
  if (coverUrl) return coverUrl;
  return pickByHash(slug, VIDEO_PANELS);
}

/** Re-exported so a caller can iterate tracks without a second import. */
export { LEARN_TRACK_KEYS };
