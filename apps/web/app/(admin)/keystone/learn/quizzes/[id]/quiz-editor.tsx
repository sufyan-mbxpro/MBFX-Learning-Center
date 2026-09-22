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
//
// **Only the default language shapes a quiz.** Another language TRANSLATES the
// shape it is given: questions cannot be added, removed or reordered there, and
// type, points, option count and the correct answer are read-only, because
// `correctAnswer` is an option INDEX shared by every language. `saveQuiz`
// refuses a translation that differs, so this lock is UX, not the boundary.
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ExternalLink, ImageIcon, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  AnswerValue,
  AnswerVisibilityInput,
  GeneratedQuizQuestion,
  QuestionTypeInput,
  QuizInput,
} from "@repo/contracts";
import { isLearnTrack, LEARN_TRACK_KEYS, quizInputSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import {
  ContentStatusPanel,
  type ContentStatusLabels,
} from "../../../_components/editor/content-status-panel.tsx";
import { EditorSection } from "../../../_components/editor/editor-section.tsx";
import {
  ContentFlagsSection,
  type ContentFlags,
} from "../../../_components/editor/content-flags-fields.tsx";
import { ImageUploadField } from "../../../_components/image-upload-field.tsx";
import { saveQuizAction, setQuizStatusAction } from "../../../_actions/quiz-actions.ts";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { trackLabels } from "../../_lib/learn-labels.ts";
import { AiQuizButton, type AiQuizLabels } from "../../../_components/ai-quiz-dialog.tsx";
import {
  AiFieldMenu,
  AiFillButton,
  type AiFillConfig,
  type AiFillPatch,
} from "../../../_components/ai-fill.tsx";
import { HeaderActions } from "../../../_components/header-actions.tsx";
import { liveHref } from "../../../_lib/live-href.ts";

/** Field issues for one question, by path relative to it (`prompt`, `options.0`). */
interface QuestionIssues {
  invalid: (path: string) => boolean;
  error: (path: string) => string | undefined;
}

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
  /** ADR-132 — the uploaded cover; a null id falls back to a generated panel. */
  cover: { id: string | null; url: string | null };
  /** ADR-139 — Featured / Active / Premium. */
  flags: ContentFlags;
  questions: EditorQuestion[];
}

const TRUE_FALSE_OPTIONS = ["True", "False"];

/** A model's questions in the editor's shape — shared by both AI paths. */
function toEditorQuestions(generated: GeneratedQuizQuestion[]): EditorQuestion[] {
  return generated.map((question) => ({
    type: "SINGLE_CHOICE" as QuestionTypeInput,
    points: 1,
    prompt: question.prompt,
    options: question.options,
    // The generated explanation belongs to the CORRECT option, and the editor
    // stores explanations positionally — so it lands there and nowhere else.
    explanations: question.options.map((_, index) =>
      index === question.correctIndex ? (question.explanation ?? "") : "",
    ),
    correctAnswer: question.correctIndex as AnswerValue,
  }));
}

/** Indices of the correct options, whichever shape the value is in. */
function correctIndices(value: AnswerValue): number[] {
  return Array.isArray(value) ? value : [value];
}

/** What an editor can change — the server-owned status and timestamps are not edits. */
function editable(state: QuizEditorState) {
  const { status, legalTransitions, publishedAt, scheduledFor, updatedAt, ...rest } = state;
  void [status, legalTransitions, publishedAt, scheduledFor, updatedAt];
  return rest;
}

/** The default language's words, shown beside a translation as its reference. */
export interface QuizTranslationSource {
  title: string;
  description: string;
  questions: { prompt: string; options: string[]; explanations: string[] }[];
}

export function QuizEditor({
  initial,
  locales,
  defaultLocale,
  source,
  canPublish,
  canUpdate,
  statusLabels,
  ai,
  fillAi,
  liveSlug,
  siteUrl,
}: {
  initial: QuizEditorState;
  locales: string[];
  defaultLocale: string;
  /** Present exactly when `initial.locale` is not the default locale. */
  source?: QuizTranslationSource;
  /** Holds `lessons.publish` (ADR-058 #8). The service re-checks it. */
  canPublish: boolean;
  canUpdate: boolean;
  statusLabels: ContentStatusLabels;
  /**
   * B6's generator, or nothing.
   *
   * Absent when the feature is off AND when this quiz has no published lesson
   * to build from — a standalone quiz has no source, so the button that would
   * use one does not exist (ADR-097 #6).
   */
  ai?: {
    labels: AiQuizLabels;
    lesson: { id: string; title: string; content: string; locale?: string };
  };
  /** ADR-126's brief bar and field menus, or nothing. */
  fillAi?: AiFillConfig;
  /**
   * The DEFAULT locale's stored slug — the one the public route answers to.
   * Not `state.slug`: on a translation that is another language's word, and
   * an unsaved edit has no page yet.
   */
  liveSlug: string;
  siteUrl: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState(initial);
  const [removing, setRemoving] = useState<number | null>(null);
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const translating = source !== undefined;
  const languageName = (code: string) =>
    new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();

  // The language lives in the URL (the page reads the other locale's words on
  // the server), so switching is a navigation — and it asks first when there
  // are edits it would throw away. `initial` is refreshed after a save, so a
  // saved screen compares equal.
  const goToLocale = (next: string) =>
    router.push(next === defaultLocale ? pathname : `${pathname}?locale=${next}`);
  const switchLocale = (next: string) => {
    if (next === state.locale) return;
    if (JSON.stringify(editable(state)) !== JSON.stringify(editable(initial))) {
      setPendingLocale(next);
    } else goToLocale(next);
  };
  const { run, pending } = useServerAction();
  // `saveQuizAction`'s own schema over the exact payload it is sent (ADR-077),
  // so every question's prompt and option is checked inline before a save.
  const form = useFieldErrors(quizInputSchema, buildPayload());

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
        coverAssetId: state.cover.id,
        ...state.flags,
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
    if (!form.validate()) return;
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

  // ADR-126: the fillable fields as plain text.
  const aiFill = canUpdate ? fillAi : undefined;
  const aiCurrent = {
    title: state.title,
    description: state.description,
    questions: state.questions.map((question) => question.prompt).join("\n"),
  };
  // ONE update. Generated questions are APPENDED: a brief never deletes a
  // question an admin wrote.
  const applyFill = (fill: AiFillPatch) =>
    setState((s) => ({
      ...s,
      ...(typeof fill.title === "string" ? { title: fill.title } : {}),
      ...(typeof fill.description === "string" ? { description: fill.description } : {}),
      ...(Array.isArray(fill.questions)
        ? {
            questions: [
              ...s.questions,
              ...toEditorQuestions(fill.questions as GeneratedQuizQuestion[]),
            ],
          }
        : {}),
    }));
  const fieldMenu = (field: "title" | "description") =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={state.locale}
        current={aiCurrent}
        onApply={(value) => patch({ [field]: value })}
      />
    ) : null;

  // The one publishing rule no schema holds: the contract lets a draft quiz
  // have no questions, but a quiz with none is not publishable content.
  const hasQuestions = state.questions.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-(--grid-2-1) lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <EditorSection
          title={t("quizzes.detailsSection")}
          // changes-44 #3: the language travels with the content, not on a row of
          // its own above it.
          actions={
            <>
              {locales.length > 1 && (
                <AdminCombobox
                  aria-label={t("quizzes.languageLabel")}
                  size="sm"
                  className="w-24"
                  value={state.locale}
                  onValueChange={(next) => next && switchLocale(next)}
                  options={locales.map((code) => ({ value: code, label: code.toUpperCase() }))}
                />
              )}
              {aiFill && !translating ? (
                <AiFillButton
                  withOptions
                  config={aiFill}
                  locale={state.locale}
                  current={aiCurrent}
                  fieldLabels={{
                    title: t("quizzes.titleLabel"),
                    description: t("quizzes.descriptionLabel"),
                    questions: t("quizzes.questionsSection"),
                  }}
                  onApply={applyFill}
                />
              ) : null}
            </>
          }
          description={t("quizzes.detailsDescription")}
        >
          {translating && (
            <p className="text-sm text-muted-foreground">
              {t("quizzes.translatingHint", { language: languageName(defaultLocale) })}
            </p>
          )}
          <FieldGroup>
            <Field invalid={form.invalid("translation.title")} required>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{t("quizzes.titleLabel")}</FieldLabel>
                {fieldMenu("title")}
              </div>
              <Input
                value={state.title}
                placeholder={source?.title}
                maxLength={255}
                onChange={(e) => patch({ title: e.target.value })}
              />
              <FieldError>{form.error("translation.title")}</FieldError>
            </Field>
            <Field invalid={form.invalid("translation.description")}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{t("quizzes.descriptionLabel")}</FieldLabel>
                {fieldMenu("description")}
              </div>
              <Textarea
                rows={5}
                value={state.description}
                placeholder={source?.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
              <FieldError>{form.error("translation.description")}</FieldError>
            </Field>
          </FieldGroup>
        </EditorSection>

        <EditorSection
          title={t("quizzes.settingsSection")}
          description={t("quizzes.settingsDescription")}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field invalid={form.invalid("meta.passingScore")}>
                <FieldLabel>{t("quizzes.passingScore")}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={state.passingScore}
                  onChange={(e) =>
                    patch({ passingScore: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
                <FieldError>{form.error("meta.passingScore")}</FieldError>
              </Field>
              <Field invalid={form.invalid("meta.maxAttempts")}>
                <FieldLabel>{t("quizzes.maxAttempts")}</FieldLabel>
                <Input
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
                <FieldDescription>{t("quizzes.maxAttemptsHint")}</FieldDescription>
                <FieldError>{form.error("meta.maxAttempts")}</FieldError>
              </Field>
            </div>

            <Field invalid={form.invalid("meta.showAnswersAfter")}>
              <FieldLabel>{t("quizzes.showAnswersAfter")}</FieldLabel>
              <AdminCombobox
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
              <FieldDescription>{t("quizzes.showAnswersHint")}</FieldDescription>
              <FieldError>{form.error("meta.showAnswersAfter")}</FieldError>
            </Field>

            <Field invalid={form.invalid("meta.track")}>
              <FieldLabel>{t("trackLabel")}</FieldLabel>
              <AdminCombobox
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
              <FieldDescription>{t("quizzes.trackHint")}</FieldDescription>
              <FieldError>{form.error("meta.track")}</FieldError>
            </Field>

            <Field invalid={form.invalid("meta.category")}>
              <FieldLabel>{t("quizzes.category")}</FieldLabel>
              <Input
                value={state.category}
                maxLength={80}
                onChange={(e) => patch({ category: e.target.value })}
              />
              <FieldDescription>{t("quizzes.categoryHint")}</FieldDescription>
              <FieldError>{form.error("meta.category")}</FieldError>
            </Field>

            <Field orientation="horizontal">
              <Switch
                checked={state.isStandalone}
                onCheckedChange={(checked) => patch({ isStandalone: checked })}
              />
              <FieldContent>
                <FieldLabel>{t("quizzes.isStandalone")}</FieldLabel>
                <FieldDescription>{t("quizzes.isStandaloneHint")}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
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
                {...(source?.questions[index] ? { source: source.questions[index] } : {})}
                translating={translating}
                onPatch={(next) => patchQuestion(index, next)}
                onChangeType={(type) => changeType(index, type)}
                onToggleCorrect={(optionIndex) => toggleCorrect(index, optionIndex)}
                onAddOption={() => addOption(index)}
                onRemoveOption={(optionIndex) => removeOption(index, optionIndex)}
                onMove={(delta) => moveQuestion(index, delta)}
                onRemove={() => setRemoving(index)}
                issues={{
                  invalid: (path) => form.invalid(`questions.${index}.${path}`),
                  error: (path) => form.error(`questions.${index}.${path}`),
                }}
              />
            ))}

            <div className="flex flex-wrap items-center gap-2">
              {!translating && (
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus data-icon="inline-start" aria-hidden />
                  {t("quizzes.addQuestion")}
                </Button>
              )}
              {/* changes-29 B6. Accepted questions join the editor's existing
                  state and NOTHING is persisted until Save — the one feature
                  where §2.2 #7 is a design constraint rather than a
                  description. */}
              {ai && !translating && (
                <AiQuizButton
                  labels={ai.labels}
                  lesson={ai.lesson}
                  onAdd={(generated) =>
                    setState((s) => ({
                      ...s,
                      questions: [...s.questions, ...toEditorQuestions(generated)],
                    }))
                  }
                />
              )}
            </div>
          </div>
        </EditorSection>

        {/* ADR-140 §3: Save sits on the page heading's row, like every
            editor's. Enabled while fields are wrong: pressing it names them
            (audit F-07). */}
        <HeaderActions>
          {/* changes-48 #1: the one content editor that had no way to open
              its page. Only while published, like the course editor: a
              draft's link is a 404. The stored track, never the form's. */}
          {initial.status === "PUBLISHED" && liveSlug && (
            <Button
              variant="outline"
              render={
                <a
                  href={`${siteUrl}${liveHref(
                    `/learn/${initial.track}/quizzes/${liveSlug}`,
                    initial.locale,
                    defaultLocale,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink data-icon="inline-start" aria-hidden />
              {t("viewLive")}
            </Button>
          )}
          <Button disabled={!canUpdate} loading={pending} onClick={save}>
            {t("quizzes.save")}
          </Button>
        </HeaderActions>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {/* The panel validates the fields before a transition that saves
            first, and stops with them named inline (ADR-077). */}
        {/* From `initial`, NOT from `state` — the difference is the whole bug
            (changes-22). `useServerAction` calls `router.refresh()` after a
            transition, which re-renders this screen's server component and
            hands this editor a fresh `initial`; `useState(initial)` keeps the
            first snapshot forever, so a quiz moved to In review went on
            showing "Draft" and the Draft-era buttons until a hard reload. The
            other four editors on this panel read these five facts straight
            from their props and were already correct. None of them is
            editable here, so none of them belongs in editor state. */}
        <ContentStatusPanel
          status={initial.status}
          legalTransitions={initial.legalTransitions}
          publishedAt={initial.publishedAt}
          scheduledFor={initial.scheduledFor}
          updatedAt={initial.updatedAt}
          canPublish={canPublish}
          canSave={hasQuestions && canUpdate}
          validate={form.validate}
          save={submitForm}
          transitionTo={(to, scheduledForIso) =>
            setQuizStatusAction(state.quizId, to, scheduledForIso)
          }
          labels={statusLabels}
        />
        {/* ADR-139 #6: the cover moved here from the Details section. Its
            three switches follow in their own card (changes-44 #5). Default
            locale only, as before. */}
        {!translating && (
          <>
            <EditorSection
              title={t("contentFlags.title")}
              description={t("contentFlags.description")}
              icon={ImageIcon}
              accent="warning"
            >
              <ImageUploadField
                id="quiz-cover"
                label={t("quizzes.coverLabel")}
                value={state.cover.url}
                purpose="content"
                category="learn"
                sourceType="QUIZ"
                disabled={!canUpdate}
                error={form.error("meta.coverAssetId")}
                onChange={(next) =>
                  patch({ cover: { id: next?.id ?? null, url: next?.url ?? null } })
                }
                labels={{
                  upload: t("uploadImage"),
                  replace: t("replaceImage"),
                  remove: t("removeImage"),
                  uploading: t("uploading"),
                  hint: t("quizzes.coverHint"),
                  cancel: t("cancel"),
                  confirmRemoveTitle: t("confirmRemoveImageTitle"),
                  confirmRemoveBody: t("confirmRemoveImageBody"),
                }}
              />
            </EditorSection>
            <ContentFlagsSection
              value={state.flags}
              onChange={(flags) => patch({ flags })}
              disabled={!canUpdate}
            />
          </>
        )}
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
      <ConfirmDialog
        open={pendingLocale !== null}
        onOpenChange={(open) => setPendingLocale(open ? pendingLocale : null)}
        title={t("quizzes.switchLanguageTitle")}
        description={t("quizzes.switchLanguageBody")}
        confirmLabel={t("quizzes.switchLanguageConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (pendingLocale !== null) goToLocale(pendingLocale);
          setPendingLocale(null);
        }}
      />
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  source,
  translating,
  onPatch,
  onChangeType,
  onToggleCorrect,
  onAddOption,
  onRemoveOption,
  onMove,
  onRemove,
  issues,
}: {
  question: EditorQuestion;
  index: number;
  total: number;
  /** The default language's words for this question, on a translation. */
  source?: QuizTranslationSource["questions"][number];
  /** Structure is read-only: only the words can change. */
  translating: boolean;
  onPatch: (next: Partial<EditorQuestion>) => void;
  onChangeType: (type: QuestionTypeInput) => void;
  onToggleCorrect: (optionIndex: number) => void;
  onAddOption: () => void;
  onRemoveOption: (optionIndex: number) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  issues: QuestionIssues;
}) {
  const t = useTranslations("admin");
  const correct = correctIndices(question.correctAnswer);
  // The option LIST is fixed for true/false, and for every type on a
  // translation. A true/false option's WORDS still need translating.
  const fixedOptions = question.type === "TRUE_FALSE" || translating;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold tabular-nums">{index + 1}</span>
        {!translating && (
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
        )}
      </div>

      <Field invalid={issues.invalid("prompt")} required>
        <FieldLabel>{t("quizzes.questionPrompt")}</FieldLabel>
        <Textarea
          rows={3}
          value={question.prompt}
          placeholder={source?.prompt}
          onChange={(e) => onPatch({ prompt: e.target.value })}
        />
        <FieldError>{issues.error("prompt")}</FieldError>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field invalid={issues.invalid("type")} required>
          <FieldLabel>{t("quizzes.questionType")}</FieldLabel>
          <AdminCombobox
            disabled={translating}
            value={question.type}
            onValueChange={(value) => onChangeType(value as QuestionTypeInput)}
            options={[
              { value: "SINGLE_CHOICE", label: t("quizzes.typeSingle") },
              { value: "MULTIPLE_CHOICE", label: t("quizzes.typeMultiple") },
              { value: "TRUE_FALSE", label: t("quizzes.typeTrueFalse") },
            ]}
          />
          <FieldError>{issues.error("type")}</FieldError>
        </Field>
        <Field invalid={issues.invalid("points")}>
          <FieldLabel>{t("quizzes.points")}</FieldLabel>
          <Input
            type="number"
            min={1}
            max={100}
            disabled={translating}
            value={question.points}
            onChange={(e) =>
              onPatch({ points: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
          <FieldError>{issues.error("points")}</FieldError>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        {question.options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex flex-col gap-1.5 rounded-md border p-3">
            {/* The option's text is the outer Field (its message sits under the
                whole row); the "mark correct" checkbox nests its own Field so
                its label and id stay its own. */}
            <Field invalid={issues.invalid(`options.${optionIndex}`)} required>
              <div className="flex items-center gap-3">
                <Field orientation="horizontal" className="w-auto shrink-0">
                  <Checkbox
                    checked={correct.includes(optionIndex)}
                    disabled={translating}
                    onCheckedChange={() => onToggleCorrect(optionIndex)}
                  />
                  <FieldLabel>{t("quizzes.markCorrect")}</FieldLabel>
                </Field>
                <Input
                  aria-label={t("quizzes.optionLabel", { number: optionIndex + 1 })}
                  value={option}
                  placeholder={source?.options[optionIndex]}
                  maxLength={300}
                  disabled={question.type === "TRUE_FALSE" && !translating}
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
              <FieldError>{issues.error(`options.${optionIndex}`)}</FieldError>
            </Field>
            <Field invalid={issues.invalid(`explanations.${optionIndex}`)}>
              <Textarea
                rows={2}
                aria-label={t("quizzes.optionExplanation")}
                placeholder={source?.explanations[optionIndex] || t("quizzes.optionExplanation")}
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
              <FieldError>{issues.error(`explanations.${optionIndex}`)}</FieldError>
            </Field>
          </div>
        ))}
        {/* Issues about the list as a whole (a true/false question's count). */}
        {issues.invalid("options") && (
          <Field invalid>
            <FieldError>{issues.error("options")}</FieldError>
          </Field>
        )}

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
