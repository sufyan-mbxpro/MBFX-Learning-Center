// The assessment panel (ADR-084) — a course's final quiz, or the quiz that
// completes a `QUIZ_PASS` lesson.
//
// **It takes a finished `state` and decides nothing.** Whether a learner may
// start the assessment depends on a session, and this component is rendered
// inside a cached page that reads none: the app's island resolves the state
// (`_lib/assessment-state.ts`) and hands it here. That split is also what
// makes the rule testable — `apps/web`'s vitest has no DOM, so a decision
// living inside an app component is a decision no test can reach.
//
// **Why not `QuizCard`.** That card answers "which of these quizzes do I
// want" in a grid: portrait, artwork, a stretched whole-card link, a score
// meter. This answers "am I allowed to take THIS one yet", alone, at the end
// of a course page or a lesson. It is landscape, it has no artwork, and its
// link is an ordinary control sitting beside other controls — a stretched
// overlay here would swallow the column it lives in.
//
// **One shell, three states, one height.** The card is rendered on the server
// in `open` and may become `locked` or `passed` when the island answers. The
// eyebrow, title and facts row never move; only the state line and the CTA
// change, so the swap after hydrate shifts nothing (ADR-056 #1's discipline,
// the same one `course-progress.tsx` documents).
//
// **`locked` is a disabled Button, never dimmed text.** `opacity` on an
// ancestor is invisible to axe's contrast check and was exactly the defect
// ADR-082 #3 removed from `LessonNav` — so the locked state changes the
// ground and the glyph, and every string the reader is meant to READ stays
// at full ink. The one opacity left standing is the design system's own
// `disabled:opacity-50` on the CTA, which WCAG 1.4.3 exempts because the
// control is inactive; `assessment-card.test.tsx` allows exactly that one
// and nothing else.
import { Award, GraduationCap, ListChecks, Lock, RotateCcw, Target } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

/**
 * - `open` — takeable. The server's default paint, and what every unknown
 *   answer resolves to (ADR-084 #2): a lock we cannot justify is a lock we do
 *   not draw.
 * - `locked` — positively known to be out of reach: a signed-in learner with
 *   required lessons outstanding.
 * - `passed` — cleared, at least once.
 */
export type AssessmentState = "open" | "locked" | "passed";

export interface AssessmentCardLabels {
  /** Small caps above the title, e.g. "Final assessment". */
  eyebrow: string;
  /** Already pluralised, e.g. "12 questions". */
  questions: string;
  /** Already formatted, e.g. "Pass mark 80%". */
  passMark: string;
  /** Already resolved, e.g. "3 attempts" or "Unlimited attempts". */
  attempts: string;
  /** One line under the facts in `open`. */
  openBody: string;
  /** One line in `locked` — say what is left, not merely that it is locked. */
  lockedBody: string;
  /** The verdict chip in `passed`. */
  passedLabel: string;
  /** Already formatted, e.g. "Your best score: 90%". */
  bestLabel: string;
  start: string;
  retake: string;
}

export function AssessmentCard({
  href,
  title,
  state,
  labels,
  className,
}: {
  href: string;
  title: string;
  state: AssessmentState;
  labels: AssessmentCardLabels;
  className?: string;
}) {
  const StateIcon = state === "passed" ? Award : state === "locked" ? Lock : GraduationCap;

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 transition-colors duration-(--duration-base) sm:flex-row sm:items-center",
        state === "passed" && "border-success/40 bg-success/5",
        state === "open" && "border-primary/25 bg-primary/5",
        // Muted ground rather than faded ink: the card is still fully
        // legible, it simply is not an invitation yet.
        state === "locked" && "bg-muted/40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          state === "passed" && "bg-success/15 text-success-interactive",
          state === "open" && "bg-primary/15 text-primary-interactive",
          state === "locked" && "bg-muted text-muted-foreground",
        )}
      >
        <StateIcon className="size-5" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xs font-semibold tracking-caps text-muted-foreground uppercase">
            {labels.eyebrow}
          </p>
          {state === "passed" && (
            <Badge variant="success">
              <Award aria-hidden />
              {labels.passedLabel}
            </Badge>
          )}
        </div>

        <h3 className="min-w-0 text-lg font-semibold text-balance">{title}</h3>

        {/* The facts are a property of the QUIZ, so they render in every
            state — including for a guest, and including while locked. What
            the assessment is does not depend on who is reading. */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <ListChecks aria-hidden className="size-4" />
            {labels.questions}
          </li>
          <li className="flex items-center gap-1.5">
            <Target aria-hidden className="size-4" />
            {labels.passMark}
          </li>
          <li className="flex items-center gap-1.5">
            <RotateCcw aria-hidden className="size-4" />
            {labels.attempts}
          </li>
        </ul>

        {/* `aria-live` because this line is the one thing that changes after
            paint: a screen reader that has already read the card would
            otherwise never learn the assessment had unlocked. */}
        <p aria-live="polite" className="text-sm">
          {state === "passed"
            ? labels.bestLabel
            : state === "locked"
              ? labels.lockedBody
              : labels.openBody}
        </p>
      </div>

      <div className="shrink-0">
        {state === "locked" ? (
          // Disabled rather than absent: the reader can see what is coming,
          // and the line above says what is between them and it. Nothing is
          // being protected here — the quiz is published content and its own
          // endpoints are the boundary (ADR-084 #3).
          <Button size="lg" disabled>
            <Lock data-icon="inline-start" aria-hidden />
            {labels.start}
          </Button>
        ) : (
          <Button
            size="lg"
            variant={state === "passed" ? "outline" : "default"}
            render={<a href={href} />}
          >
            {state === "passed" ? labels.retake : labels.start}
          </Button>
        )}
      </div>
    </section>
  );
}
