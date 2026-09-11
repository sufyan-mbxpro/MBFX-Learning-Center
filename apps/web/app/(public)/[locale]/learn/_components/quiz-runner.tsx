"use client";

// The quiz runner (Phase 6, ADR-058 #3/#4).
//
// One question at a time, and **every judgement is the server's**. The client
// holds which option is selected and nothing else: it does not know the correct
// answer, cannot compute a score, and submits an attempt id rather than a
// result. What it renders after each answer is whatever the server chose to
// tell it — a boolean when `showAnswersAfter` allows one, and nothing when it
// does not (ADR-058 #4), which is why the counter below reads "answered" under
// `NEVER` and "correct" otherwise.
//
// The quiz CONTENT arrives as props from a cached page. Only the attempt is
// client-driven, exactly as progress is (ADR-056 #1).
import { useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnswerValue, QuizResultView, QuizView } from "@repo/contracts";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";

type Phase =
  /** Nothing started yet — the cover card with the Start button. */
  | { kind: "idle" }
  | { kind: "starting" }
  /** A guest, or an account that has used every attempt. */
  | { kind: "blocked"; reason: "guest" | "limit" | "error" }
  | { kind: "running"; attemptId: string; index: number }
  | { kind: "result"; result: QuizResultView };

interface Feedback {
  /** Null under `showAnswersAfter: NEVER` — recorded, not judged. */
  correct: boolean | null;
}

export function QuizRunner({ quiz, locale }: { quiz: QuizView; locale: string }) {
  const t = useTranslations("learn");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selection, setSelection] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const question = phase.kind === "running" ? quiz.questions[phase.index] : undefined;
  const showsCorrectness = quiz.showAnswersAfter !== "NEVER";

  async function start() {
    setPhase({ kind: "starting" });
    setBusy(true);
    try {
      const response = await fetch("/api/learn/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id }),
      });
      if (response.status === 401) return setPhase({ kind: "blocked", reason: "guest" });
      if (response.status === 409) return setPhase({ kind: "blocked", reason: "limit" });
      if (!response.ok) return setPhase({ kind: "blocked", reason: "error" });
      const attempt = (await response.json()) as { id: string; answers: Record<string, unknown> };
      // Resume where the learner stopped: the server hands back the attempt it
      // already had, so a refresh mid-quiz is not a restart.
      const answered = Object.keys(attempt.answers).length;
      setAnsweredCount(answered);
      setPhase({
        kind: "running",
        attemptId: attempt.id,
        index: Math.min(answered, quiz.questions.length - 1),
      });
    } finally {
      setBusy(false);
    }
  }

  async function answer() {
    if (phase.kind !== "running" || !question || selection.length === 0) return;
    setBusy(true);
    try {
      const value: AnswerValue = question.multiple ? [...selection].sort() : selection[0]!;
      const response = await fetch("/api/learn/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: phase.attemptId,
          questionId: question.id,
          answer: value,
        }),
      });
      if (!response.ok) return setPhase({ kind: "blocked", reason: "error" });
      const body = (await response.json()) as Feedback;
      setFeedback(body);
      setAnsweredCount((count) => count + 1);
      if (body.correct === true) setCorrectCount((count) => count + 1);
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (phase.kind !== "running") return;
    setFeedback(null);
    setSelection([]);
    if (phase.index + 1 < quiz.questions.length) {
      setPhase({ ...phase, index: phase.index + 1 });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/learn/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: phase.attemptId, locale }),
      });
      if (!response.ok) return setPhase({ kind: "blocked", reason: "error" });
      setPhase({ kind: "result", result: (await response.json()) as QuizResultView });
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setPhase({ kind: "idle" });
    setSelection([]);
    setFeedback(null);
    setAnsweredCount(0);
    setCorrectCount(0);
  }

  function toggle(index: number) {
    if (feedback) return; // answered — the choice is with the server now
    setSelection((current) => {
      if (!question?.multiple) return [index];
      return current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index];
    });
  }

  if (quiz.questions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("quizzes.noQuestions")}</p>;
  }

  if (phase.kind === "result")
    return <Result result={phase.result} quiz={quiz} onRetake={retake} />;

  if (phase.kind === "blocked") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-semibold">
          {phase.reason === "guest"
            ? t("quizzes.guestTitle")
            : phase.reason === "limit"
              ? t("quizzes.limitTitle")
              : t("quizzes.errorTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {phase.reason === "guest"
            ? t("quizzes.guestBody")
            : phase.reason === "limit"
              ? t("quizzes.limitBody")
              : t("quizzes.errorBody")}
        </p>
        {phase.reason === "guest" && (
          <div>
            <Button size="sm" render={<Link href={ROUTE_PATHS["sign-in"]} />}>
              {t("progress.signInAction")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (phase.kind === "idle" || phase.kind === "starting") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <Fact label={t("quizzes.questionsLabel")} value={String(quiz.questionCount)} />
          <Fact
            label={t("quizzes.passMarkLabel")}
            value={t("course.progressPercent", { percent: quiz.passingScore })}
          />
          <Fact
            label={t("quizzes.attemptsLabel")}
            value={
              quiz.maxAttempts === null ? t("quizzes.attemptsUnlimited") : String(quiz.maxAttempts)
            }
          />
        </dl>
        <div>
          <Button size="lg" disabled={busy} onClick={() => void start()}>
            {t("quizzes.start")}
          </Button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const answered = feedback !== null;
  const position = phase.index + 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">
            {t("quizzes.questionPosition", { position, total: quiz.questions.length })}
          </span>
          {/* Under NEVER this counts ANSWERED, not correct — the server has not
              told us which is which, and inventing a score here is exactly the
              client-side judgement ADR-058 #3 forbids. */}
          <span className="text-muted-foreground tabular-nums">
            {showsCorrectness
              ? t("quizzes.runningScore", { correct: correctCount, answered: answeredCount })
              : t("quizzes.runningProgress", { answered: answeredCount })}
          </span>
        </div>
        <Progress
          value={Math.round((position / quiz.questions.length) * 100)}
          max={100}
          aria-label={t("quizzes.progressLabel")}
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold text-balance">{question.prompt}</legend>
        {question.multiple && (
          <p className="text-sm text-muted-foreground">{t("quizzes.chooseAll")}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option, index) => {
            const picked = selection.includes(index);
            return (
              <button
                key={option}
                type="button"
                // A real pressed state rather than a checkbox: these are
                // buttons that answer a question, and `aria-pressed` says
                // "selected" without claiming to be a form control.
                aria-pressed={picked}
                disabled={answered || busy}
                onClick={() => toggle(index)}
                className={cn(
                  "rounded-full border px-4 py-3 text-start text-sm transition-colors duration-(--duration-base) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  picked
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border bg-card hover:border-primary/30",
                  answered && "opacity-70",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* One live region for the verdict, so a screen reader hears the result
          of answering rather than discovering a changed button label. */}
      <p aria-live="polite" className="min-h-6 text-sm">
        {answered && feedback?.correct === true && (
          <span className="flex items-center gap-1.5 font-medium text-success-interactive">
            <Check aria-hidden className="size-4" />
            {t("quizzes.correct")}
          </span>
        )}
        {answered && feedback?.correct === false && (
          <span className="flex items-center gap-1.5 font-medium text-destructive">
            <X aria-hidden className="size-4" />
            {t("quizzes.incorrect")}
          </span>
        )}
        {answered && feedback?.correct === null && (
          <span className="text-muted-foreground">{t("quizzes.recorded")}</span>
        )}
      </p>

      <div>
        {answered ? (
          <Button disabled={busy} onClick={() => void next()}>
            {position === quiz.questions.length ? t("quizzes.finish") : t("quizzes.next")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        ) : (
          <Button disabled={busy || selection.length === 0} onClick={() => void answer()}>
            {t("quizzes.submitAnswer")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The result card, and the review when `showAnswersAfter` allowed one.
 *
 * `result.review` being null is not an error state and is not rendered as one:
 * `NEVER` means there is nothing to show, and `AFTER_PASS` on a failed attempt
 * means "not yet". Both simply omit the list.
 */
function Result({
  result,
  quiz,
  onRetake,
}: {
  result: QuizResultView;
  quiz: QuizView;
  onRetake: () => void;
}) {
  const t = useTranslations("learn");
  const promptById = new Map(quiz.questions.map((question) => [question.id, question]));
  const canRetake = result.attemptsRemaining === null || result.attemptsRemaining > 0;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border-2 p-6",
          result.passed
            ? "border-success/40 bg-success/5"
            : "border-destructive/40 bg-destructive/5",
        )}
      >
        <p className="text-sm font-medium uppercase">
          {result.passed ? t("quizzes.passed") : t("quizzes.failed")}
        </p>
        <p className="text-display-sm font-semibold tabular-nums">
          {t("course.progressPercent", { percent: result.percentage })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("quizzes.scoreDetail", {
            score: result.score,
            total: result.totalPoints,
            pass: result.passingScore,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("quizzes.attemptNumber", { number: result.attemptNumber })}
          {result.attemptsRemaining !== null && (
            <> · {t("quizzes.attemptsLeft", { count: result.attemptsRemaining })}</>
          )}
        </p>
      </div>

      {result.review && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t("quizzes.reviewTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {result.review.map((item) => {
              const question = promptById.get(item.questionId);
              if (!question) return null;
              const correctIndices = Array.isArray(item.correctAnswer)
                ? item.correctAnswer
                : [item.correctAnswer];
              return (
                <li key={item.questionId} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-2">
                    {item.correct ? (
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-success-interactive"
                      />
                    ) : (
                      <X aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <p className="font-medium">{question.prompt}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("quizzes.correctAnswerIs", {
                          answer: correctIndices
                            .map((index) => question.options[index] ?? "")
                            .filter(Boolean)
                            .join(", "),
                        })}
                      </p>
                      {correctIndices.map((index) =>
                        item.explanations[index] ? (
                          <p key={index} className="text-sm">
                            {item.explanations[index]}
                          </p>
                        ) : null,
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {canRetake && (
        <div>
          <Button variant="outline" onClick={onRetake}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            {t("quizzes.retake")}
          </Button>
        </div>
      )}
    </div>
  );
}
