// The video index's label map and its category colouring (changes-16 PR 7/10)
// — `quiz-labels.ts`'s counterpart for videos.
//
// Same division of responsibility: @repo/ui carries no catalog and must not
// learn what a category means, so `VideoCard` takes finished strings and a
// tone, and this module is the one place that decides them. One category is
// then one colour on every card it appears on and on its own chip.
import { pickByHash } from "@repo/utils";
import type { VideoCardLabels, VideoCardTone } from "@repo/ui/components/video-card";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The tonal ramp a category is drawn from.
 *
 * Derived from the category's SLUG rather than read from a table, exactly as
 * `categoryTone` in `quiz-labels.ts` is — but for a slightly different reason
 * worth writing down, because the data is not the same shape.
 *
 * `Quiz.category` is free text with no registry at all. A `VideoCategory` IS a
 * row, so a table keyed by id could exist. It still should not: the ids are
 * cuids nobody can read, the slugs are editor-chosen and unbounded, and a
 * table would leave every category created after the code was written
 * rendering in the fallback colour. Deriving keeps both properties that
 * matter: stable (same colour every render, server and client alike) and total
 * (a new category is coloured the moment it is created, with no code change).
 *
 * Which of the four a category lands on is arbitrary, and meant to be — these
 * are labels being made distinguishable, not a scale being encoded.
 */
const CATEGORY_TONES: readonly VideoCardTone[] = ["info", "success", "warning", "eyebrow"];

export function categoryTone(slug: string): VideoCardTone {
  return pickByHash(slug, CATEGORY_TONES);
}

/** The finished strings `VideoCard` needs, built once for the whole shelf. */
export function videoCardLabels(t: Translate): VideoCardLabels {
  return {
    play: t("videos.watch"),
    noArtwork: t("videos.noArtwork"),
    readGuide: t("videos.readGuide"),
  };
}
