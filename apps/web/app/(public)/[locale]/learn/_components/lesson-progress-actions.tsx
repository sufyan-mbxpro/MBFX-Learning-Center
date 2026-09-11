"use client";

// The lesson page's completion control (PR 5.3, ADR-056 #5).
//
// Completion is EXPLICIT: this button is the only thing that completes a
// lesson. There is no scroll-depth or video-percentage detection, deliberately
// — both are unreliable and both write completions the learner did not intend.
//
// The visit itself is recorded by `ProgressProvider`'s `touchLessonId`, not
// here: arriving is a fact about the page load, and pairing it with this
// control would mean two requests where the touch already returns the view.
import { Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { useProgress } from "./progress-provider.tsx";

export function LessonProgressActions({
  lessonId,
  completionRule,
}: {
  lessonId: string;
  /**
   * `QUIZ_PASS` hides the manual control entirely (ADR-056 #5) — the lesson is
   * completed by passing its quiz, and offering a button that claims otherwise
   * would be a second, contradictory completion mechanism. Unreachable until
   * Phase 6; handled here so it is not forgotten when quizzes land.
   */
  completionRule: string;
}) {
  const t = useTranslations("learn");
  const { status, stateFor, pending, write } = useProgress();

  if (completionRule === "QUIZ_PASS") return null;
  // `loading` renders the control in its not-started shape rather than nothing:
  // the row must occupy its space from first paint or the footer jumps.
  if (status === "guest" || status === "off") return null;

  const completed = stateFor(lessonId) === "completed";
  const busy = pending || status === "loading";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={completed ? "outline" : "default"}
        disabled={busy}
        onClick={() => void write(completed ? "incomplete" : "complete", lessonId)}
      >
        {completed ? (
          <RotateCcw data-icon="inline-start" aria-hidden />
        ) : (
          <Check data-icon="inline-start" aria-hidden />
        )}
        {completed ? t("progress.markIncomplete") : t("progress.markComplete")}
      </Button>

      {/* A live region, so a screen reader hears the result of a press that
          changes nothing but a button's own label. */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status === "error" ? t("progress.error") : completed ? t("progress.completedNote") : ""}
      </p>
    </div>
  );
}
