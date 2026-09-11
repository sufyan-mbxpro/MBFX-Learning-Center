"use client";

// The quiz builder (changes-11 Phase 6, ADR-058).
//
// **Whole-set save.** The editor holds the entire question list in state and
// `saveQuiz` replaces it in one transaction. Per-question autosave would let a
// reorder land while a correct-answer index was still moving, which is the one
// failure that silently marks every future attempt wrong.
//
// **Editing the option list moves the correct-answer index with it.**
// `correctAnswer` is an INDEX into `options`, so `removeOption` re-maps every
// index that pointed past the removed one, and `changeType` reshapes the value
// when the arity changes. Skip either and the quiz still saves — and grades
// every attempt from then on against the wrong option, silently. That is the
// single most expensive bug available in this screen, which is why both are
// functions with a comment rather than inline splices.
//
// Reordering is keyboard-only, deliberately: plan §8.2 — drag and drop without
// a keyboard equivalent does not ship, and this repo has no DnD dependency.
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  AnswerValue,
  AnswerVisibilityInput,
  QuestionTypeInput,
  QuizInput,
} from "@repo/contracts";
import { isLearnTrack, LEARN_TRACK_KEYS } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import {
  ContentStatusPanel,
  type ContentStatusLabels,
} from "../../../_components/editor/content-status-panel.tsx";
import { EditorSection } from "../../../_components/editor/editor-section.tsx";
import { saveQuizAction, setQuizStatusAction } from "../../../_actions/quiz-actions.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { trackLabels } from "../../_lib/learn-labels.ts";

export interface EditorQuestion {
  /** Absent on a question added in this session; the server assigns one. */
  id?: string;
  type: QuestionTypeInput;
  points: number;
  prompt: string;
  options: string[];
  explanations: string[];
  correctAnswer: AnswerValue;
}

export interface QuizEditorState {
  quizId: string;
  status: string;
  legalTransitions: string[];
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  locale: string;
  title: string;
  slug: string;
  description: string;
  passingScore: number;
  maxAttempts: number | null;
  showAnswersAfter: AnswerVisibilityInput;
  /** The quiz's school — its URL segment, not a filter (ADR-065 §3). */
  track: string;
  isStandalone: boolean;
  category: string;
  questions: EditorQuestion[];
}

const TRUE_FALSE_OPTIONS = ["True", "False"];

/** Indices of the correct options, whichever shape the value is in. */
function correctIndices(value: AnswerValue): number[] {
  return Array.isArray(value) ? value : [value];
}

export function QuizEditor({
  initial,
  canPublish,
  canUpdate,
  statusLabels,
}: {
  initial: QuizEditorState;
  /** Holds `lessons.publish` (ADR-058 #8). The service re-checks it. */
  canPublish: boolean;
  canUpdate: boolean;
  statusLabels: ContentStatusLabels;
}) {
  const t = useTranslations("admin");
  const [state, setState] = useState(initial);
  const [removing, setRemoving] = useState<number | null>(null);
  const { run, pending } = useServerAction();

  const patch = (next: Partial<QuizEditorState>) => setState((s) => ({ ...s, ...next }));

  const patchQuestion = (index: number, next: Partial<EditorQuestion>) =>
    setState((s) => ({
      ...s,
      questions: s.questions.map((question, i) =>
        i === index ? { ...question, ...next } : question,
      ),
    }));

  function addQuestion() {
    setState((s) => ({
      ...s,
      questions: [
        ...s.questions,
        {
          type: "SINGLE_CHOICE",
          points: 1,
          prompt: "",
          options: ["", ""],
          explanations: [],
          correctAnswer: 0,
        },
      ],
    }));
  }

  function removeQuestion(index: number) {
    setState((s) => ({ ...s, questions: s.questions.filter((_, i) => i !== index) }));
  }

  function moveQuestion(index: number, delta: number) {
    setState((s) => {
      const target = index + delta;
      if (target < 0 || target >= s.questions.length) return s;
      const questions = [...s.questions];
      const [moved] = questions.splice(index, 1);
      questions.splice(target, 0, moved!);
      return { ...s, questions };
    });
  }

  /**
   * Switching type is not just a field change.
   *
   * TRUE_FALSE has exactly two options and the contract rejects anything else,
   * so switching to it replaces the list. Switching between the choice types
   * changes the SHAPE of `correctAnswer` — a number one way, an array the
   * other — and leaving it in the old shape is a save that fails validation
   * with a message about a field the editor never touched.
   */
  function changeType(index: number, type: QuestionTypeInput) {
    setState((s) => ({
      ...s,
      questions: s.questions.map((question, i) => {
        if (i !== index) return question;
        const options = type === "TRUE_FALSE" ? [...TRUE_FALSE_OPTIONS] : question.options;
        const first = correctIndices(question.correctAnswer)[0] ?? 0;
        const safeFirst = first < options.length ? first : 0;
        return {
          ...question,
          type,
          options,
          correctAnswer: type === "MULTIPLE_CHOICE" ? [safeFirst] : safeFirst,
        };
      }),
    }));
  }

  /** Toggle one option's correctness, respecting the type's arity. */
  function toggleCorrect(index: number, optionIndex: number) {
    setState((s) => ({
      ...s,
      questions: s.questions.map((question, i) => {
        if (i !== index) return question;
        if (question.type !== "MULTIPLE_CHOICE") {
          return { ...question, correctAnswer: optionIndex };
        }
        const current = correctIndices(question.correctAnswer);
        const next = current.includes(optionIndex)
          ? current.filter((value) => value !== optionIndex)
          : [...current, optionIndex].sort((a, b) => a - b);
        // Never leave a multiple-choice question with nothing correct: the
        // contract rejects an empty list, and an editor who unticked the last
        // one meant to move it, not to break the save.
        return { ...question, correctAnswer: next.length === 0 ? current : next };
      }),
    }));
  }

  function addOption(index: number) {
    patchQuestion(index, {
      options: [...(state.questions[index]?.options ?? []), ""],
    });
  }

  /**
   * Remove an option AND move every correct-answer index that pointed past it.
   *
   * Without the re-index, deleting option 1 of four leaves `correctAnswer: 3`
   * pointing at an option that has shifted to position 2 — the quiz still
   * saves, and every attempt from then on is graded against the wrong answer.
   */
  function removeOption(index: number, optionIndex: number) {
    setState((s) => ({
      ...s,
      questions: s.questions.map((question, i) => {
        if (i !== index) return question;
        const options = question.options.filter((_, o) => o !== optionIndex);
        const explanations = question.explanations.filter((_, o) => o !== optionIndex);
        const remapped = correctIndices(question.correctAnswer)
          .filter((value) => value !== optionIndex)
          .map((value) => (value > optionIndex ? value - 1 : value));
        const fallback = remapped.length === 0 ? [0] : remapped;
        return {
          ...question,
          options,
          explanations,
          correctAnswer: question.type === "MULTIPLE_CHOICE" ? fallback : (fallback[0] ?? 0),
        };
      }),
    }));
  }

  function buildPayload(): QuizInput {
    return {
      quizId: state.quizId,
      meta: {
        passingScore: state.passingScore,
        maxAttempts: state.maxAttempts,
        showAnswersAfter: state.showAnswersAfter,
        ...(isLearnTrack(state.track) ? { track: state.track } : {}),
        isStandalone: state.isStandalone,
        category: state.category.trim() === "" ? null : state.category.trim(),
      },
      translation: {
        locale: state.locale,
        title: state.title,
        slug: state.slug.trim() === "" ? undefined : state.slug.trim(),
        description: state.description.trim() === "" ? null : state.description.trim(),
      },
      questions: state.questions.map((question, index) => ({
        ...(question.id ? { id: question.id } : {}),
        type: question.type,
        sortOrder: index,
        points: question.points,
        prompt: question.prompt,
        options: question.options,
        explanations: question.explanations,
        correctAnswer: question.correctAnswer,
      })),
    };
  }

  function save() {
    // `useServerAction` surfaces the failure itself; the success toast is the
    // only message this call site owns.
    run(() => saveQuizAction(buildPayload()), { successMessage: t("quizzes.saved") });
  }

  /**
   * The awaitable save `ContentStatusPanel` runs before a publishing
   * transition — ADR-053's rule (publishing what is on disk while the screen
   * shows something else is the bug). The panel owns the sequencing now;
   * this used to take a `thenTransitionTo` argument, which is precisely the
   * contract two editors forgot to honour.
   */
  async function submitForm() {
    await saveQuizAction(buildPayload());
  }

  const canSave = state.title.trim() !== "" && state.questions.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <EditorSection
          title={t("quizzes.detailsSection")}
          description={t("quizzes.detailsDescription")}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-title">{t("quizzes.titleLabel")}</Label>
              <Input
                id="quiz-title"
                value={state.title}
                maxLength={255}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-description">{t("quizzes.descriptionLabel")}</Label>
              <Textarea
                id="quiz-description"
                rows={3}
                value={state.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </div>
        </EditorSection>

        <EditorSection
          title={t("quizzes.settingsSection")}
          description={t("quizzes.settingsDescription")}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiz-pass">{t("quizzes.passingScore")}</Label>
                <Input
                  id="quiz-pass"
                  type="number"
                  min={1}
                  max={100}
                  value={state.passingScore}
                  onChange={(e) =>
                    patch({ passingScore: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quiz-attempts">{t("quizzes.maxAttempts")}</Label>
                <Input
                  id="quiz-attempts"
                  type="number"
                  min={1}
                  max={50}
                  value={state.maxAttempts ?? ""}
                  // Empty is UNLIMITED, not zero — the default and the right one
                  // for a learning site (D24).
                  onChange={(e) =>
                    patch({
                      maxAttempts:
                        e.target.value.trim() === ""
                          ? null
                          : Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">{t("quizzes.maxAttemptsHint")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-answers">{t("quizzes.showAnswersAfter")}</Label>
              <AdminCombobox
                id="quiz-answers"
                value={state.showAnswersAfter}
                onValueChange={(value) =>
                  patch({ showAnswersAfter: value as AnswerVisibilityInput })
                }
                options={[
                  { value: "NEVER", label: t("quizzes.showAnswersNever") },
                  { value: "AFTER_SUBMIT", label: t("quizzes.showAnswersAfterSubmit") },
                  { value: "AFTER_PASS", label: t("quizzes.showAnswersAfterPass") },
                ]}
              />
              {/* The hint exists because ADR-058 #4 makes NEVER do more than its
                name suggests: it also suppresses the live right/wrong counter,
                since a running score would contradict it. */}
              <p className="text-xs text-muted-foreground">{t("quizzes.showAnswersHint")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-track">{t("trackLabel")}</Label>
              <AdminCombobox
                id="quiz-track"
                value={state.track}
                // The guard, not a cast: only a registered key may reach the
                // payload, and moving a quiz here rewrites its public URL —
                // `saveQuiz` writes the redirect (ADR-065 §3).
                onValueChange={(value) =>
                  patch({ track: value && isLearnTrack(value) ? value : state.track })
                }
                options={LEARN_TRACK_KEYS.map((key) => ({
                  value: key,
                  label: trackLabels(t)[key] ?? key,
                }))}
              />
              <p className="text-xs text-muted-foreground">{t("quizzes.trackHint")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quiz-category">{t("quizzes.category")}</Label>
              <Input
                id="quiz-category"
                value={state.category}
                maxLength={80}
                onChange={(e) => patch({ category: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("quizzes.categoryHint")}</p>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="quiz-standalone"
                checked={state.isStandalone}
                onCheckedChange={(checked) => patch({ isStandalone: checked })}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="quiz-standalone">{t("quizzes.isStandalone")}</Label>
                <p className="text-xs text-muted-foreground">{t("quizzes.isStandaloneHint")}</p>
              </div>
            </div>
          </div>
        </EditorSection>

        <EditorSection
          title={t("quizzes.questionsSection")}
          description={t("quizzes.questionsDescription")}
        >
          <div className="flex flex-col gap-4">
            {state.questions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("quizzes.noQuestions")}</p>
            )}

            {state.questions.map((question, index) => (
              <QuestionCard
                key={question.id ?? `new-${index}`}
                question={question}
                index={index}
                total={state.questions.length}
                onPatch={(next) => patchQuestion(index, next)}
                onChangeType={(type) => changeType(index, type)}
                onToggleCorrect={(optionIndex) => toggleCorrect(index, optionIndex)}
                onAddOption={() => addOption(index)}
                onRemoveOption={(optionIndex) => removeOption(index, optionIndex)}
                onMove={(delta) => moveQuestion(index, delta)}
                onRemove={() => setRemoving(index)}
              />
            ))}

            <div>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus data-icon="inline-start" aria-hidden />
                {t("quizzes.addQuestion")}
              </Button>
            </div>
          </div>
        </EditorSection>

        {/* ADR-044 #8: Save sits at the inline END of its section. */}
        <div className="flex justify-end">
          <Button disabled={pending || !canSave || !canUpdate} onClick={save}>
            {t("quizzes.save")}
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {/* `canSave` includes "has at least one question": a quiz with none is
            not publishable content, and the panel disabling the transition is
            a clearer answer than a save that fails validation server-side. */}
        <ContentStatusPanel
          status={state.status}
          legalTransitions={state.legalTransitions}
          publishedAt={state.publishedAt}
          scheduledFor={state.scheduledFor}
          updatedAt={state.updatedAt}
          canPublish={canPublish}
          canSave={canSave && canUpdate}
          save={submitForm}
          transitionTo={(to, scheduledForIso) =>
            setQuizStatusAction(state.quizId, to, scheduledForIso)
          }
          labels={statusLabels}
        />
      </div>

      {/* ADR-044 #7: removing something asks first, even when it only stages a
          change this screen's Save will persist. */}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => setRemoving(open ? removing : null)}
        title={t("quizzes.removeQuestionTitle")}
        description={t("quizzes.removeQuestionBody")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (removing !== null) removeQuestion(removing);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  onPatch,
  onChangeType,
  onToggleCorrect,
  onAddOption,
  onRemoveOption,
  onMove,
  onRemove,
}: {
  question: EditorQuestion;
  index: number;
  total: number;
  onPatch: (next: Partial<EditorQuestion>) => void;
  onChangeType: (type: QuestionTypeInput) => void;
  onToggleCorrect: (optionIndex: number) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("admin");
  const correct = correctIndices(question.correctAnswer);
  const fixedOptions = question.type === "TRUE_FALSE";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold tabular-nums">{index + 1}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quizzes.moveUp")}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quizzes.moveDown")}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("quizzes.removeQuestion")}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`q-${index}-prompt`}>{t("quizzes.questionPrompt")}</Label>
        <Textarea
          id={`q-${index}-prompt`}
          rows={2}
          value={question.prompt}
          onChange={(e) => onPatch({ prompt: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`q-${index}-type`}>{t("quizzes.questionType")}</Label>
          <AdminCombobox
            id={`q-${index}-type`}
            value={question.type}
            onValueChange={(value) => onChangeType(value as QuestionTypeInput)}
            options={[
              { value: "SINGLE_CHOICE", label: t("quizzes.typeSingle") },
              { value: "MULTIPLE_CHOICE", label: t("quizzes.typeMultiple") },
              { value: "TRUE_FALSE", label: t("quizzes.typeTrueFalse") },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`q-${index}-points`}>{t("quizzes.points")}</Label>
          <Input
            id={`q-${index}-points`}
            type="number"
            min={1}
            max={100}
            value={question.points}
            onChange={(e) =>
              onPatch({ points: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {question.options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id={`q-${index}-o-${optionIndex}`}
                checked={correct.includes(optionIndex)}
                onCheckedChange={() => onToggleCorrect(optionIndex)}
              />
              <Label htmlFor={`q-${index}-o-${optionIndex}`} className="shrink-0">
                {t("quizzes.markCorrect")}
              </Label>
              <Input
                aria-label={t("quizzes.optionLabel", { number: optionIndex + 1 })}
                value={option}
                maxLength={300}
                disabled={fixedOptions}
                onChange={(e) =>
                  onPatch({
                    options: question.options.map((value, i) =>
                      i === optionIndex ? e.target.value : value,
                    ),
                  })
                }
              />
              {!fixedOptions && question.options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("quizzes.removeOption")}
                  onClick={() => onRemoveOption(optionIndex)}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </div>
            <Input
              aria-label={t("quizzes.optionExplanation")}
              placeholder={t("quizzes.optionExplanation")}
              value={question.explanations[optionIndex] ?? ""}
              maxLength={1000}
              onChange={(e) => {
                // Explanations are index-aligned with options and sparse, so a
                // gap has to be filled with "" rather than left undefined —
                // a hole would shift every later explanation onto the wrong
                // option once the array is serialized.
                const next = [...question.explanations];
                while (next.length < question.options.length) next.push("");
                next[optionIndex] = e.target.value;
                onPatch({ explanations: next });
              }}
            />
          </div>
        ))}

        {!fixedOptions && question.options.length < 12 && (
          <div>
            <Button variant="ghost" size="sm" onClick={onAddOption}>
              <Plus data-icon="inline-start" aria-hidden />
              {t("quizzes.addOption")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
