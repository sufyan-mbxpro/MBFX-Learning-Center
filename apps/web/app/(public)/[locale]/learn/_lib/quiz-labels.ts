// The quiz index's label map and its category colouring (design pass
// 2026-09-09) — `learn-labels.ts`'s counterpart for quizzes.
//
// Same division of responsibility as the difficulty tones there: @repo/ui
// carries no catalog and must not learn what a category means, so `QuizCard`
// takes finished strings and a tone, and this module is the one place that
// decides them. One category is then one colour on every card it appears on
// and on its own filter chip, which is the whole reason the mapping is not
// inline at the call site.
import { pickByHash } from "@repo/utils";
import type { QuizCardLabels, QuizCardTone } from "@repo/ui/components/quiz-card";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The tonal ramp a category is drawn from.
 *
 * Deliberately NOT a fixed key→tone table, because `Quiz.category` is free
 * text an editor typed: there is no registry to enumerate, no catalog key it
 * could have, and a table would leave every category an editor invents next
 * month rendering in the fallback colour while the four somebody thought of
 * first keep theirs.
 *
 * So the colour is derived from the STRING, which gives the two properties
 * that actually matter: it is stable (a category is the same colour on every
 * card, in every session, on server and client alike) and it is total (a new
 * category is coloured the moment it is typed, with no code change). Which of
 * the four a given category lands on is arbitrary, and it is meant to be —
 * these are labels being made distinguishable, not a scale being encoded. The
 * one place a tone MEANS something is the score meter, which does not use
 * this.
 */
const CATEGORY_TONES: readonly QuizCardTone[] = ["info", "success", "warning", "eyebrow"];

export function categoryTone(category: string): QuizCardTone {
  return pickByHash(category, CATEGORY_TONES);
}

/** The finished strings `QuizCard` needs, built once for the whole shelf. */
export function quizCardLabels(t: Translate): QuizCardLabels {
  return {
    start: t("quizzes.startShort"),
    retake: t("quizzes.retakeShort"),
    passMark: t("quizzes.passMarkLabel"),
    yourBest: t("quizzes.bestLabel"),
    passed: t("quizzes.passed"),
    meterLabel: t("quizzes.meterLabel"),
    noArtwork: t("quizzes.noArtwork"),
  };
}
