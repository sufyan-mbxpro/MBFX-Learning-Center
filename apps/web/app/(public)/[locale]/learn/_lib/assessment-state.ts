// The assessment card's lock rule (ADR-084 #2), kept out of the component so a
// test can reach it: `apps/web`'s vitest has no DOM.
//
// A lock needs POSITIVE evidence. Only a signed-in learner the progress API
// answered for (`ready`) can be locked, and only while required lessons are
// outstanding. Every other status (a guest, a request in flight, the feature
// switched off, an error) paints the card open, because a lock drawn on a guess
// would never lift for a guest and would be a false statement to exactly the
// reader ADR-058 #7 invites to read every question.
import {
  learnTrackQuizzesPath,
  type CourseProgressView,
  type LessonProgressState,
  type QuizLinkView,
} from "@repo/contracts";
import type { AssessmentState } from "@repo/ui/components/assessment-card";
import type { ProgressStatus } from "../_components/progress-provider.tsx";

/** A course's final assessment, from the course page's progress view. */
export function courseAssessmentState(
  status: ProgressStatus,
  view: Pick<CourseProgressView, "requiredOutstanding" | "finalQuiz"> | null,
): AssessmentState {
  if (status !== "ready" || !view) return "open";
  if (view.finalQuiz?.passed) return "passed";
  if (view.requiredOutstanding > 0) return "locked";
  return "open";
}

/**
 * The quiz that completes a `QUIZ_PASS` lesson (ADR-084 #4). Never locked: the
 * quiz IS the lesson's completion control, so it is always takeable. Passed
 * once the lesson itself is complete, which `applyQuizPass` writes the moment
 * an attempt passes.
 */
export function lessonAssessmentState(
  status: ProgressStatus,
  lessonState: LessonProgressState | undefined,
): AssessmentState {
  return status === "ready" && lessonState === "completed" ? "passed" : "open";
}

/**
 * A linked quiz's address, built from the QUIZ's own track (ADR-084 #1): a
 * forex course may point at a quiz filed under crypto. Locale-less, like every
 * other href on these pages (`LessonNav`, the curriculum).
 */
export function quizHref(quiz: Pick<QuizLinkView, "track" | "slug">): string {
  return `${learnTrackQuizzesPath(quiz.track)}/${quiz.slug}`;
}
