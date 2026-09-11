"use client";

// Learning objectives (changes-11 PR 3.4) — the list editor behind
// `LessonTranslation.learningObjectives`, which is a Json column that already
// existed and had no writer.
//
// Per-TRANSLATION, not per-lesson: the objectives are prose, so they swap with
// the editor's locale switcher exactly as the title and body do. The panel is
// therefore a controlled list handed down by the shell rather than owning its
// own state.
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { EditorSection } from "../../../../_components/editor/editor-section.tsx";

export interface ObjectivesLabels {
  section: string;
  sectionDescription: string;
  add: string;
  objectiveLabel: string;
  empty: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  confirm: string;
  cancel: string;
}

const MAX_OBJECTIVES = 20;

export function ObjectivesPanel({
  value,
  onChange,
  disabled,
  labels,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  labels: ObjectivesLabels;
}) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={Target}
      accent="info"
      actions={
        !disabled && value.length < MAX_OBJECTIVES ? (
          <Button variant="outline" size="xs" onClick={() => onChange([...value, ""])}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.add}
          </Button>
        ) : undefined
      }
    >
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {value.map((objective, index) => (
            // Index keys, deliberately: the rows have no stable identity of
            // their own (the column stores a bare string array), and keying on
            // the text would remount the input on every keystroke.
            <li key={index} className="flex items-center gap-2">
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
              <Input
                aria-label={`${labels.objectiveLabel} ${index + 1}`}
                value={objective}
                disabled={disabled}
                maxLength={300}
                onChange={(e) =>
                  onChange(value.map((entry, i) => (i === index ? e.target.value : entry)))
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.moveUp}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.moveDown}
                disabled={disabled || index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.remove}
                className="text-destructive"
                disabled={disabled}
                onClick={() => setRemoveIndex(index)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => (open ? undefined : setRemoveIndex(null))}
        title={labels.confirmRemoveTitle}
        description={labels.confirmRemoveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          if (removeIndex === null) return;
          onChange(value.filter((_, i) => i !== removeIndex));
          setRemoveIndex(null);
        }}
      />
    </EditorSection>
  );
}
