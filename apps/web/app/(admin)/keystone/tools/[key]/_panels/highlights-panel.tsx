"use client";

// The "why use this" editor (ADR-114 #3).
//
// `faq-panel.tsx`'s shape, one size down: rows collapse to one line, editing
// happens in a dialog, removal is confirmed (ADR-044 #7 — a staged
// destructive change is still a destructive change), and everything is client
// state committed by the editor's one `saveTool`.
//
// Two differences from the FAQ, both deliberate:
//
//   * **No expand/collapse.** A highlight is a title and three lines; the row
//     shows the title and the dialog shows the rest. An accordion over
//     four one-sentence rows is chrome for its own sake.
//   * **The glyph is CHOSEN, not typed.** `TOOL_HIGHLIGHT_ICONS` is a closed
//     list, so the field is a combobox and a name outside it cannot be
//     entered. `parseHighlights` would drop one anyway, and a card that
//     silently vanishes after a save is not something the person who typed it
//     could diagnose.
import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  TOOL_HIGHLIGHT_ICONS,
  toolHighlightSchema,
  type ToolHighlight,
  type ToolHighlightIcon,
} from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { EditorSection } from "../../../_components/editor/editor-section.tsx";
import { TOOL_HIGHLIGHT_ICON_COMPONENTS } from "../../../../../_lib/tool-highlight-icons.ts";

export interface HighlightsLabels {
  section: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  addFirst: string;
  edit: string;
  dialogDescription: string;
  iconField: string;
  titleField: string;
  textField: string;
  textHint: string;
  saveItem: string;
  remove: string;
  cancel: string;
  confirm: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  moveUp: string;
  moveDown: string;
  full: string;
}

/** At most six, matching `toolHighlightSchema`'s own cap. */
const MAX_HIGHLIGHTS = 6;

// ADR-044 #5: a raw identifier never renders. The glyph names are registry
// keys, so they reach the screen through `humanizeKey()` — "book-open" reads
// "Book Open" — and the option carries the glyph itself, which is the part an
// admin is actually choosing. `Combobox` draws `icon` in the list AND on the
// trigger, so the choice is visible before the dropdown is opened.
const ICON_OPTIONS = TOOL_HIGHLIGHT_ICONS.map((name) => {
  const Icon = TOOL_HIGHLIGHT_ICON_COMPONENTS[name];
  return { value: name, label: humanizeKey(name), icon: <Icon aria-hidden /> };
});

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Add and edit share one dialog — the only difference is the seed value. */
function HighlightDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = adding. */
  initial: ToolHighlight | null;
  onSubmit: (draft: ToolHighlight) => void;
  labels: HighlightsLabels;
}) {
  const [icon, setIcon] = useState<ToolHighlightIcon>(initial?.icon ?? "target");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  // The dialog is remounted per target (the host keys it), so closing it
  // discards the attempt with everything else — no reset needed.
  const form = useFieldErrors(toolHighlightSchema, { icon, title, text });

  const submit = () => {
    if (!form.validate()) return;
    onSubmit({ icon, title: title.trim(), text: text.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? labels.edit : labels.add}</DialogTitle>
          <DialogDescription>{labels.dialogDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("icon")} required>
            <FieldLabel>{labels.iconField}</FieldLabel>
            <AdminCombobox
              options={ICON_OPTIONS}
              value={icon}
              onValueChange={(next) => setIcon(next as ToolHighlightIcon)}
            />
            <FieldError>{form.error("icon")}</FieldError>
          </Field>
          <Field invalid={form.invalid("title")} required>
            <FieldLabel>{labels.titleField}</FieldLabel>
            <Input
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <FieldError>{form.error("title")}</FieldError>
          </Field>
          <Field invalid={form.invalid("text")} required>
            <FieldLabel>{labels.textField}</FieldLabel>
            <Textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} />
            <FieldDescription className="text-xs">{labels.textHint}</FieldDescription>
            <FieldError>{form.error("text")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button onClick={submit}>{labels.saveItem}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HighlightsPanel({
  items,
  onChange,
  labels,
}: {
  items: ToolHighlight[];
  onChange: (items: ToolHighlight[]) => void;
  labels: HighlightsLabels;
}) {
  // `null` = closed, `-1` = adding, `>= 0` = editing that index.
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const atCapacity = items.length >= MAX_HIGHLIGHTS;

  const addButton = (
    <Button variant="outline" size="xs" disabled={atCapacity} onClick={() => setDialogIndex(-1)}>
      <Plus data-icon="inline-start" aria-hidden />
      {atCapacity ? labels.full : labels.add}
    </Button>
  );

  return (
    <EditorSection
      title={`${labels.section}${items.length > 0 ? ` (${items.length})` : ""}`}
      description={labels.description}
      icon={Sparkles}
      accent="info"
      actions={items.length > 0 ? addButton : undefined}
    >
      {items.length === 0 ? (
        <Empty className="border-none">
          <EmptyMedia>
            <Sparkles aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          {/* The empty state says what the absence DOES — the band will not
              render — because that is the fact an editor needs and the one
              ADR-047 §2's rule makes true. */}
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
          <Button variant="outline" size="sm" onClick={() => setDialogIndex(-1)}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.addFirst}
          </Button>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => {
            const Icon = TOOL_HIGHLIGHT_ICON_COMPONENTS[item.icon];
            return (
              // Index keys: a row created in this session has no stable id of
              // its own, and order IS its identity until it is saved.
              <li key={index} className="min-w-0 rounded-md border bg-card">
                <div className="flex min-w-0 items-center gap-1 ps-3 pe-1.5">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-info/10 text-info-interactive"
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate py-2 ps-2 text-sm font-medium">
                    {item.title}
                  </span>
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
                    <Trash2 aria-hidden className="text-destructive-interactive" />
                  </Button>
                </div>
                <p className="border-t px-3 py-2.5 text-sm break-words text-muted-foreground">
                  {item.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {dialogIndex !== null && (
        <HighlightDialog
          // Remount per target so the fields re-seed rather than keeping the
          // previous row's text.
          key={dialogIndex}
          open
          onOpenChange={(next) => {
            if (!next) setDialogIndex(null);
          }}
          initial={dialogIndex >= 0 ? (items[dialogIndex] ?? null) : null}
          onSubmit={(draft) => {
            if (dialogIndex >= 0) {
              onChange(items.map((item, i) => (i === dialogIndex ? draft : item)));
            } else {
              onChange([...items, draft]);
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
          setRemoveIndex(null);
        }}
      />
    </EditorSection>
  );
}
