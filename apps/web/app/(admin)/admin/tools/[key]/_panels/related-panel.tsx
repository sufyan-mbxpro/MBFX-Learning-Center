"use client";

// A tool's related strip, in the editor (changes-25 T5, ADR-086 #4).
//
// **Mixed-type, which is the whole difference from the articles' panel.** A
// course recommends courses; a tool points at lessons, articles, glossary
// terms, videos and courses in one ordered list, and the order runs ACROSS the
// types rather than within each. So a row carries a type badge, and adding is
// "pick a type, then pick an item" rather than one flat list.
//
// **Curated first, topped up after.** Whatever is short of the tool's
// `relatedCount` is filled by track and tag at render (ADR-055's pattern), so
// this list is a preference rather than a requirement — which is why an empty
// list is a perfectly good state and there is no "add at least N" rule.
import { useState } from "react";
import { ChevronDown, ChevronUp, Link2, Plus, Trash2 } from "lucide-react";
import { TOOL_RELATION_TYPES } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { humanizeKey } from "@repo/utils";
import { AdminCombobox } from "../../../_components/combobox.tsx";

export interface RelatedOption {
  targetType: string;
  targetId: string;
  label: string;
}

export interface RelatedPanelLabels {
  relatedType: string;
  relatedItem: string;
  relatedAdd: string;
  relatedRemove: string;
  relatedMoveUp: string;
  relatedMoveDown: string;
  relatedEmptyTitle: string;
  relatedEmptyBody: string;
  relatedMissing: string;
  none: string;
}

export interface RelatedValue {
  targetType: string;
  targetId: string;
}

export function RelatedPanel({
  value,
  onChange,
  options,
  labels,
}: {
  value: RelatedValue[];
  onChange: (next: RelatedValue[]) => void;
  options: RelatedOption[];
  labels: RelatedPanelLabels;
}) {
  const [type, setType] = useState<string>(TOOL_RELATION_TYPES[0]);
  const [pending, setPending] = useState("");

  const chosen = new Set(value.map((v) => `${v.targetType}:${v.targetId}`));
  const available = options
    .filter((o) => o.targetType === type && !chosen.has(`${o.targetType}:${o.targetId}`))
    .map((o) => ({ value: o.targetId, label: o.label }));

  const labelFor = (item: RelatedValue): string =>
    options.find((o) => o.targetType === item.targetType && o.targetId === item.targetId)?.label ??
    // A target whose row was deleted since it was picked. Said plainly rather
    // than rendered as a raw id (ADR-044 #5) or silently dropped — dropping it
    // would rewrite the editor's list behind their back.
    labels.relatedMissing;

  const move = (index: number, delta: number) => {
    const next = [...value];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved!);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {value.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Link2 aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.relatedEmptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.relatedEmptyBody}</EmptyDescription>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-2">
          {value.map((item, index) => (
            <li
              key={`${item.targetType}:${item.targetId}`}
              className="flex items-center gap-2 rounded-md border border-border p-2"
            >
              <Badge variant="outline">{humanizeKey(item.targetType)}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{labelFor(item)}</span>
              {/* Keyboard-reachable buttons, not drag handles (plan §8.2). */}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.relatedMoveUp}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.relatedMoveDown}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.relatedRemove}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden className="text-destructive-interactive" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <AdminCombobox
            aria-label={labels.relatedType}
            value={type}
            onValueChange={(next) => {
              setType(next);
              setPending("");
            }}
            options={TOOL_RELATION_TYPES.map((value) => ({
              value,
              label: humanizeKey(value),
            }))}
          />
        </div>
        <div className="min-w-0 flex-1">
          <AdminCombobox
            aria-label={labels.relatedItem}
            value={pending}
            onValueChange={setPending}
            options={available.length > 0 ? available : [{ value: "", label: labels.none }]}
          />
        </div>
        <Button
          variant="outline"
          disabled={!pending}
          onClick={() => {
            onChange([...value, { targetType: type, targetId: pending }]);
            setPending("");
          }}
        >
          <Plus aria-hidden data-icon="inline-start" />
          {labels.relatedAdd}
        </Button>
      </div>
    </div>
  );
}
