"use client";

// Quiz generation (changes-29 B6) — the last Phase 2 feature, and the OTHER
// place where "AI never writes" is a design constraint rather than a
// description.
//
// Every other feature fills form fields. A quiz is a parent row plus N
// questions plus M options each, which is more than a form holds comfortably —
// and "just write it to the database as a draft" is exactly the shortcut
// ADR-097 #4 forbids. The resolution: **generation returns a parsed object and
// the admin lands in the editor with it loaded, unsaved.** Nothing is persisted
// until Save, through `saveQuizAction`, with `lessons.update` enforced as
// always. A draft nobody asked for is still a row somebody has to find and
// delete.
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { quizSuggestionSchema, type GeneratedQuizQuestion } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { AiClientError, runAiJson } from "../_lib/ai-client.ts";
import { AdminCombobox } from "./combobox.tsx";

export interface AiQuizLabels {
  action: string;
  title: string;
  description: string;
  countLabel: string;
  difficultyLabel: string;
  difficulties: Record<string, string>;
  generate: string;
  generating: string;
  accept: string;
  add: string;
  cancel: string;
  correct: string;
  failed: string;
  empty: string;
  reasons: Record<string, string>;
}

interface Row extends GeneratedQuizQuestion {
  accepted: boolean;
}

export function AiQuizButton({
  labels,
  /** The lesson to build from — named fields, never a Prisma row. */
  lesson,
  onAdd,
}: {
  labels: AiQuizLabels;
  lesson: { id: string; title: string; content: string; locale?: string };
  /** Accepted questions join the editor's existing state. Nothing is saved. */
  onAdd: (questions: GeneratedQuizQuestion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("BEGINNER");

  async function generate() {
    setBusy(true);
    setReason(null);
    setRows(null);
    try {
      const result = await runAiJson(
        {
          feature: "quiz_generation",
          payload: {
            lessonTitle: lesson.title,
            content: lesson.content,
            questionCount: Number(count),
            difficulty,
            ...(lesson.locale ? { locale: lesson.locale } : {}),
          },
          entity: { type: "lesson", id: lesson.id },
        },
        // The schema refuses a question whose correct answer is not among its
        // own options — the one failure mode a generated quiz has that a
        // hand-written one does not, and it rejects the WHOLE set rather than
        // silently dropping one question from a five-question request.
        (value) => quizSuggestionSchema.parse(value),
      );
      setRows(result.questions.map((question) => ({ ...question, accepted: true })));
    } catch (error) {
      setReason(error instanceof AiClientError ? error.reason : "provider_error");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const accepted = (rows ?? []).filter((row) => row.accepted);
    if (accepted.length === 0) return;
    onAdd(accepted.map(({ accepted: _accepted, ...question }) => question));
    setOpen(false);
    setRows(null);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden data-icon="inline-start" />
        {labels.action}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          {/* Title AND description on every modal (ADR-057 #5). */}
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-32">
              <FieldLabel>{labels.countLabel}</FieldLabel>
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </Field>
            <Field className="w-48">
              <FieldLabel>{labels.difficultyLabel}</FieldLabel>
              <AdminCombobox
                value={difficulty}
                onValueChange={setDifficulty}
                options={Object.entries(labels.difficulties).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Button type="button" onClick={() => void generate()}>
              {busy ? (
                <Spinner size="sm" aria-label={labels.generating} data-icon="inline-start" />
              ) : (
                <Sparkles aria-hidden data-icon="inline-start" />
              )}
              {busy ? labels.generating : labels.generate}
            </Button>
          </div>

          {reason && (
            <p className="text-sm text-destructive-interactive" role="status">
              {labels.failed} — {labels.reasons[reason] ?? reason}
            </p>
          )}

          {rows !== null && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
              {rows.map((row, index) => (
                <Card key={`${index}:${row.prompt}`}>
                  <CardContent className="flex flex-col gap-2">
                    <Field orientation="horizontal" className="items-start">
                      <Checkbox
                        checked={row.accepted}
                        onCheckedChange={(value) =>
                          setRows((current) =>
                            (current ?? []).map((item, at) =>
                              at === index ? { ...item, accepted: value === true } : item,
                            ),
                          )
                        }
                      />
                      <div className="flex w-full flex-col gap-2">
                        <FieldLabel>{labels.accept}</FieldLabel>
                        {/* Edit-in-place: a question a human corrected here is
                            still the human's, and correcting it before it joins
                            the editor is cheaper than after. */}
                        <Input
                          value={row.prompt}
                          maxLength={500}
                          onChange={(event) =>
                            setRows((current) =>
                              (current ?? []).map((item, at) =>
                                at === index ? { ...item, prompt: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <ul className="flex flex-col gap-1">
                          {row.options.map((option, optionIndex) => (
                            <li
                              key={`${optionIndex}:${option}`}
                              className="flex items-center gap-2 text-sm"
                            >
                              {/* The correct answer is MARKED, not hidden: the
                                  admin is reviewing, and a review that cannot
                                  see the answer is a guess. */}
                              <span
                                className={
                                  optionIndex === row.correctIndex
                                    ? "text-success-interactive text-2xs font-medium"
                                    : "text-2xs text-muted-foreground"
                                }
                              >
                                {optionIndex === row.correctIndex ? labels.correct : "·"}
                              </span>
                              <span>{option}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Field>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              onClick={add}
              disabled={!rows || !rows.some((row) => row.accepted)}
            >
              {labels.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
