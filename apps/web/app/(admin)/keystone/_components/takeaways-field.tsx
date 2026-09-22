"use client";

// The key-takeaways list editor (changes-29 B4).
//
// **An ordinary content control.** No field exists here only because AI does
// (ADR-097 / §2.2 #8): with AI off this is a list an editor types, adds to and
// reorders by deleting — and the public block renders identically either way,
// which is what makes "the CMS keeps working without AI" structural rather
// than a promise.
//
// The Generate button is the optional half, and is ABSENT when the feature is
// off rather than greyed.
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { summarySuggestionSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";
import { AiClientError, runAiJson } from "../_lib/ai-client.ts";

export interface TakeawaysLabels {
  label: string;
  hint: string;
  add: string;
  remove: string;
  placeholder: string;
  generate: string;
  generating: string;
  failed: string;
  done: string;
  reasons: Record<string, string>;
}

/** The AI half — omitted entirely when the feature is off. */
export interface TakeawaysAi {
  source: { title: string; content: string; locale?: string };
  entity?: { type: string; id: string };
}

export function TakeawaysField({
  items,
  onChange,
  labels,
  ai,
  error,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  labels: TakeawaysLabels;
  ai?: TakeawaysAi;
  error?: string | undefined;
}) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!ai) return;
    setBusy(true);
    try {
      const result = await runAiJson(
        {
          feature: "summarization",
          payload: {
            title: ai.source.title,
            content: ai.source.content,
            want: ["takeaways"],
            ...(ai.source.locale ? { locale: ai.source.locale } : {}),
          },
          ...(ai.entity ? { entity: ai.entity } : {}),
        },
        // The form's own schema: 3-5 entries, each ≤160 characters. A model
        // that returns six is a FAILED generation, not a truncated list.
        (value) => summarySuggestionSchema.parse(value),
      );
      onChange(result.keyTakeaways ?? []);
      toast.success(labels.done);
    } catch (error_) {
      const reason = error_ instanceof AiClientError ? error_.reason : "provider_error";
      toast.error(`${labels.failed} — ${labels.reasons[reason] ?? reason}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field invalid={Boolean(error)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel>{labels.label}</FieldLabel>
        {ai && (
          <Button type="button" variant="outline" size="xs" onClick={() => void generate()}>
            {busy ? (
              <Spinner size="xs" aria-label={labels.generating} data-icon="inline-start" />
            ) : (
              <Sparkles aria-hidden data-icon="inline-start" />
            )}
            {labels.generate}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          // The index IS the identity here: two takeaways may legitimately
          // hold the same words while one is being edited into the other, so
          // keying by value would collapse two rows into one mid-keystroke.
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              maxLength={160}
              placeholder={labels.placeholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={labels.remove}
              onClick={() => onChange(items.filter((_, at) => at !== index))}
            >
              <Trash2 aria-hidden className="text-destructive-interactive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-start">
        <Button
          type="button"
          variant="outline"
          size="xs"
          // Five is the schema's ceiling; offering a sixth box would produce a
          // form that cannot be saved.
          disabled={items.length >= 5}
          onClick={() => onChange([...items, ""])}
        >
          <Plus aria-hidden data-icon="inline-start" />
          {labels.add}
        </Button>
      </div>

      <FieldDescription>{labels.hint}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
