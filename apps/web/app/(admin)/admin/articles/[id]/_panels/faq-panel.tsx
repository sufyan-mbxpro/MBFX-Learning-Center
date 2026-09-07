"use client";

// FAQ Block Editor (changes-07 §1.2 item 3). Per-TRANSLATION, so switching
// locale swaps the list — a question and its answer are translatable prose.
//
// The reference has a "Schema" toggle; we dropped it (plan §2.4 #37). If an
// article has FAQ items we always emit FAQPage JSON-LD, because a switch whose
// only "off" state is "have structured data but hide it" is a footgun.
//
// changes-10 item 4 reworked the interaction. Every question used to render
// as an always-open card with a text input and a three-row textarea, so six
// questions was roughly a screen and a half of scrolling past fields nobody
// was editing. Now: rows collapse to one line, editing happens in a dialog,
// and removal is confirmed (ADR-044 #7 — a staged destructive change is
// still a destructive change).
//
// Everything stays client state. The list is committed by the header's
// single `saveArticle`, so adding a question shows up immediately and writes
// nothing until the post is saved.

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { EditorSection } from "./editor-section.tsx";
import type { FaqDraft } from "../editor-types.ts";

export interface FaqLabels {
  section: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  addFirst: string;
  edit: string;
  dialogDescription: string;
  answerHint: string;
  saveItem: string;
  unanswered: string;
  question: string;
  answer: string;
  remove: string;
  cancel: string;
  confirm: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  moveUp: string;
  moveDown: string;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Add and edit share one dialog — the only difference is the seed value. */
function FaqDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = adding. */
  initial: FaqDraft | null;
  onSubmit: (draft: FaqDraft) => void;
  labels: FaqLabels;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");

  const submit = () => {
    if (question.trim() === "") return;
    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      question: question.trim(),
      answer,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? labels.edit : labels.add}</DialogTitle>
          <DialogDescription>{labels.dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-dialog-question">{labels.question}</Label>
            <Input
              id="faq-dialog-question"
              value={question}
              autoFocus
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-dialog-answer">{labels.answer}</Label>
            <Textarea
              id="faq-dialog-answer"
              rows={6}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{labels.answerHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button disabled={question.trim() === ""} onClick={submit}>
            {labels.saveItem}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FaqPanel({
  items,
  onChange,
  labels,
}: {
  items: FaqDraft[];
  onChange: (items: FaqDraft[]) => void;
  labels: FaqLabels;
}) {
  // `null` = closed, `-1` = adding, `>= 0` = editing that index.
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const addButton = (
    <Button variant="outline" size="xs" onClick={() => setDialogIndex(-1)}>
      <Plus data-icon="inline-start" aria-hidden />
      {labels.add}
    </Button>
  );

  return (
    <EditorSection
      title={`${labels.section}${items.length > 0 ? ` (${items.length})` : ""}`}
      description={labels.description}
      icon={HelpCircle}
      accent="info"
      actions={items.length > 0 ? addButton : undefined}
      // The section's own tinted body — item 4's "give the FAQ section its
      // own subtle background" — so it reads as a distinct block in a column
      // of otherwise identical cards.
      bodyClassName="bg-info/5"
    >
      {items.length === 0 ? (
        <Empty className="border-none">
          <EmptyMedia>
            <HelpCircle aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
          <Button variant="outline" size="sm" onClick={() => setDialogIndex(-1)}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.addFirst}
          </Button>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => {
            const isOpen = expanded === index;
            const panelId = `faq-panel-${index}`;
            return (
              // Index keys: a FAQ row created in this session has no stable id
              // of its own, and order IS its identity until it is saved.
              <li key={index} className="min-w-0 rounded-md border bg-card">
                <div className="flex min-w-0 items-center gap-1 ps-1 pe-1.5">
                  {/* The disclosure is its own control, with the row actions
                      as SIBLINGS rather than children — a button inside a
                      button is invalid and unreachable by keyboard. */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-start text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setExpanded(isOpen ? null : index)}
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-info/10 text-xs font-semibold text-info-interactive tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.question}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.moveUp}
                    disabled={index === 0}
                    onClick={() => onChange(move(items, index, index - 1))}
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.moveDown}
                    disabled={index === items.length - 1}
                    onClick={() => onChange(move(items, index, index + 1))}
                  >
                    <ChevronDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.edit}
                    onClick={() => setDialogIndex(index)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.remove}
                    onClick={() => setRemoveIndex(index)}
                  >
                    <Trash2 aria-hidden className="text-destructive" />
                  </Button>
                </div>
                <div id={panelId} hidden={!isOpen} className="border-t px-3 py-2.5">
                  {item.answer.trim() === "" ? (
                    <p className="text-xs text-muted-foreground">{labels.unanswered}</p>
                  ) : (
                    // Rendered as TEXT, not HTML. This is a preview inside the
                    // admin; the sanitizer runs on save and the public page is
                    // where the markup is honoured.
                    <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                      {item.answer}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialogIndex !== null && (
        <FaqDialog
          // Remount per target so the dialog's fields re-seed rather than
          // keeping the previous question's text.
          key={dialogIndex}
          open
          onOpenChange={(next) => {
            if (!next) setDialogIndex(null);
          }}
          initial={dialogIndex >= 0 ? (items[dialogIndex] ?? null) : null}
          onSubmit={(draft) => {
            if (dialogIndex >= 0) {
              onChange(items.map((it, i) => (i === dialogIndex ? draft : it)));
            } else {
              onChange([...items, draft]);
              setExpanded(items.length);
            }
            setDialogIndex(null);
          }}
          labels={labels}
        />
      )}

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveIndex(null);
        }}
        title={labels.confirmRemoveTitle}
        description={labels.confirmRemoveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          if (removeIndex === null) return;
          onChange(items.filter((_, i) => i !== removeIndex));
          setExpanded(null);
          setRemoveIndex(null);
        }}
      />
    </EditorSection>
  );
}
