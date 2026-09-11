// Label maps shared by the three learn routes (changes-11 Phase 4).
//
// @repo/ui carries no catalog (code-style.md #2), so `CurriculumList`,
// `CourseCard` and `LessonStateIcon` all take already-translated strings. Three
// pages building the same six-key object by hand is three places for a key to
// drift, so it is built once here.
//
// ADR-044 #5's public counterpart: a difficulty enum member never renders raw.
// Unlike the admin, there is no `humanizeKey()` fallback — a missing key here
// would put an untranslated English identifier on a public page in every
// locale, so the map is exhaustive over `Difficulty` and a new member is a
// type error at the call site rather than a silent `ADVANCED` on screen.
import type { CourseLevelTone } from "@repo/ui/components/course-card";
import type { CurriculumLabels } from "@repo/ui/components/curriculum-list";

type Translate = (key: string) => string;

/**
 * Difficulty → badge tone (design pass 2026-09-09).
 *
 * @repo/ui carries no catalog and must not learn what "BEGINNER" means, so the
 * card takes a tone and this map is the one place that decides it. Every
 * surface that shows a level — the shelf, the course header, the sidebar, the
 * "continue" band — reads it, which is what keeps one level one colour.
 *
 * The ramp is a progression, not a judgement: green for the entry point,
 * blue for the middle, amber for the demanding end. Notably NOT
 * `destructive` for ADVANCED — red says "you did something wrong", and an
 * advanced course is not an error. All three tones are alpha tints of theme
 * hues with derived ink (see badge.tsx), so they hold in both modes.
 */
const DIFFICULTY_TONES: Record<string, CourseLevelTone> = {
  BEGINNER: "success",
  INTERMEDIATE: "info",
  ADVANCED: "warning",
};

/** The tonal Badge variant for a difficulty; `eyebrow` for anything unmapped. */
export function difficultyTone(difficulty: string): CourseLevelTone {
  return DIFFICULTY_TONES[difficulty] ?? "eyebrow";
}

export function difficultyLabels(t: Translate): Record<string, string> {
  return {
    BEGINNER: t("difficulty.BEGINNER"),
    INTERMEDIATE: t("difficulty.INTERMEDIATE"),
    ADVANCED: t("difficulty.ADVANCED"),
  };
}

/** The state names + markers every curriculum surface needs. */
export function curriculumLabels(t: Translate): CurriculumLabels {
  return {
    states: {
      completed: t("lesson.stateCompleted"),
      "in-progress": t("lesson.stateInProgress"),
      "not-started": t("lesson.stateNotStarted"),
      locked: t("lesson.stateLocked"),
    },
    externalBadge: t("external.badge"),
    opensInNewTab: t("external.opensInNewTab"),
    optionalBadge: t("course.optionalBadge"),
  };
}
