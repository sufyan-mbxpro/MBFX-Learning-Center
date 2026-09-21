"use client";

// The assessment card's island (ADR-084 #2, #4): the thin thing between the
// progress view and `@repo/ui`'s `AssessmentCard`.
//
// The QUIZ arrives from the page (`CourseView.finalQuiz` / `LessonView.quiz`,
// resolved in the cached content loader, ADR-084 #1) and the LEARNER's standing
// arrives from `useProgress()`. The decision between them is
// `_lib/assessment-state.ts`, so it can be tested without a DOM.
//
// The server paints the card `open` for everyone; the island may move it to
// `locked` or `passed` once the progress request answers. Only the state line
// and the button change, so the swap shifts nothing.
import { useFormatter, useTranslations } from "next-intl";
import type { QuizLinkView } from "@repo/contracts";
import { AssessmentCard, type AssessmentCardLabels } from "@repo/ui/components/assessment-card";
import {
  courseAssessmentState,
  lessonAssessmentState,
  quizHref,
} from "../_lib/assessment-state.ts";
import { useProgress } from "./progress-provider.tsx";

function useLabels(
  quiz: QuizLinkView,
  kind: "course" | "lesson",
  outstanding: number,
  best: number,
): AssessmentCardLabels {
  const t = useTranslations("learn.assessment");
  const format = useFormatter();
  return {
    eyebrow: kind === "course" ? t("courseEyebrow") : t("lessonEyebrow"),
    questions: t("questions", { count: quiz.questionCount }),
    passMark: t("passMark", { score: quiz.passingScore }),
    attempts:
      quiz.maxAttempts === null
        ? t("attemptsUnlimited")
        : t("attempts", { count: quiz.maxAttempts }),
    openBody: kind === "course" ? t("openBodyCourse") : t("openBodyLesson"),
    lockedBody: t("lockedBody", { count: outstanding }),
    passedLabel: t("passed"),
    // The lesson view carries no score: "passed" is the claim the lesson's own
    // completion supports, and the quiz page shows the number.
    bestLabel:
      kind === "course"
        ? t("best", { score: format.number(best / 100, { style: "percent" }) })
        : t("lessonPassedBody"),
    start: t("start"),
    retake: t("retake"),
  };
}

export function CourseAssessment({ quiz }: { quiz: QuizLinkView }) {
  const { status, view } = useProgress();
  const state = courseAssessmentState(status, view);
  const labels = useLabels(
    quiz,
    "course",
    view?.requiredOutstanding ?? 0,
    view?.finalQuiz?.bestPercentage ?? 0,
  );
  return <AssessmentCard href={quizHref(quiz)} title={quiz.title} state={state} labels={labels} />;
}

export function LessonAssessment({ quiz, lessonId }: { quiz: QuizLinkView; lessonId: string }) {
  const { status, stateFor } = useProgress();
  const state = lessonAssessmentState(status, stateFor(lessonId));
  const labels = useLabels(quiz, "lesson", 0, 0);
  return <AssessmentCard href={quizHref(quiz)} title={quiz.title} state={state} labels={labels} />;
}
