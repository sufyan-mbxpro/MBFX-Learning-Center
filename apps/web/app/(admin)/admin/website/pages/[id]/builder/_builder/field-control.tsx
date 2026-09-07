"use client";

// Generic settings-panel control, dispatched off one `EditorFieldMeta`
// entry (plan §6.1, PR 3.3) — this is what makes the settings panel
// data-driven instead of one hand-written form per block.
import * as React from "react";
import type { LinkTarget } from "@repo/contracts";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { LinkEditor, type LinkEditorLabels } from "./link-editor.tsx";
import { MediaPickerControl, type MediaPickerLabels } from "./media-picker.tsx";
import type { ResolvedEditorField } from "./types.ts";
import {
  RichTextEditor,
  type RichTextLabels,
} from "../../../../../_components/rich-text-editor.tsx";

export interface FieldControlLabels {
  invalidJson: string;
  link: LinkEditorLabels;
  media: MediaPickerLabels;
  richText: RichTextLabels;
}

function JsonField({
  value,
  onChange,
  labels,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  labels: FieldControlLabels;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState(false);
  // Resync when the field switches to a different node (not on every
  // keystroke — the same "adjust state during render" pattern the media
  // upload widget uses).
  const [syncedValue, setSyncedValue] = React.useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(JSON.stringify(value, null, 2));
    setError(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={text}
        rows={6}
        className="font-mono text-xs"
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value) as unknown;
            setError(false);
            onChange(parsed);
          } catch {
            setError(true);
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{labels.invalidJson}</p>}
    </div>
  );
}

export function FieldControl({
  field,
  value,
  onChange,
  pages,
  labels,
}: {
  field: ResolvedEditorField;
  value: unknown;
  onChange: (next: unknown) => void;
  pages: { id: string; title: string }[];
  labels: FieldControlLabels;
}) {
  switch (field.kind) {
    case "text":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          value={typeof value === "string" ? value : ""}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "richText":
      return (
        <RichTextEditor
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          labels={labels.richText}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(e.target.valueAsNumber || 0)}
        />
      );
    case "boolean":
      return (
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      );
    case "select": {
      const current = typeof value === "string" ? value : "";
      const optionLabel = field.options?.find((o) => o.value === current)?.label;
      return (
        <Select value={current} onValueChange={(next) => next && onChange(next)}>
          <SelectTrigger>
            <SelectValue>{optionLabel ?? current}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "link":
      return (
        <LinkEditor
          value={(value as LinkTarget | undefined) ?? { type: "NONE" }}
          onChange={onChange}
          pages={pages}
          labels={labels.link}
        />
      );
    case "media":
      return (
        <MediaPickerControl
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          labels={labels.media}
        />
      );
    case "json":
      return <JsonField value={value} onChange={onChange} labels={labels} />;
    case "cardTemplate":
    case "stylePreset":
    case "color-token":
      // No field of these kinds exists on any block yet (Phase 4/9) — a
      // plain JSON fallback keeps the dispatcher total instead of throwing
      // if one is ever declared before a dedicated control lands.
      return <JsonField value={value} onChange={onChange} labels={labels} />;
    default:
      return null;
  }
}
