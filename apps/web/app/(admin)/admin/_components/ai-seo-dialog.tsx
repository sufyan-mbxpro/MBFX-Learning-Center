"use client";

// Auto-SEO (changes-29 B2).
//
// **A review dialog, not an apply.** Each field is shown SIDE BY SIDE with
// what is already there, with a per-field checkbox that is default-checked
// **only for fields that are currently empty** — because an admin who wrote a
// meta description should not lose it to an unattended tick. Apply fills the
// form fields; the editor's own Save persists them (ADR-097 #4).
//
// **Never `ogImageUrl`.** The image fields stay with the upload widget
// (security.md #9: an image "URL" text field is replaced by the widget, not
// supplemented) — a model inventing an image URL is exactly the SSRF-shaped
// input that rule exists to refuse. The prompt says so too.
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { seoSuggestionSchema, type SeoSuggestion } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldContent, FieldLabel } from "@repo/ui/components/field";
import { Spinner } from "@repo/ui/components/spinner";
import { AiClientError, runAiJson } from "../_lib/ai-client.ts";

export interface AiSeoLabels {
  action: string;
  title: string;
  description: string;
  current: string;
  suggested: string;
  empty: string;
  apply: string;
  cancel: string;
  generating: string;
  failed: string;
  reasons: Record<string, string>;
  fields: {
    seoTitle: string;
    seoDescription: string;
    ogTitle: string;
    ogDescription: string;
    focusKeywords: string;
  };
}

/** What the dialog can fill. Deliberately no image field of any kind. */
export interface SeoDraft {
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  focusKeywords: string;
}

type FieldKey = keyof SeoDraft;

const FIELD_ORDER: FieldKey[] = [
  "seoTitle",
  "seoDescription",
  "ogTitle",
  "ogDescription",
  "focusKeywords",
];

function toDraft(suggestion: SeoSuggestion): SeoDraft {
  return {
    seoTitle: suggestion.seoTitle,
    seoDescription: suggestion.seoDescription,
    ogTitle: suggestion.ogTitle ?? "",
    ogDescription: suggestion.ogDescription ?? "",
    // The column stores a comma-separated string; the model returns an array,
    // which is the shape a model gets right far more often.
    focusKeywords: (suggestion.focusKeywords ?? []).join(", "),
  };
}

export function AiSeoButton({
  labels,
  current,
  source,
  entity,
  onApply,
}: {
  labels: AiSeoLabels;
  current: SeoDraft;
  /** The article this is about — title, body, excerpt. Named fields only. */
  source: { title: string; content: string; excerpt?: string; locale?: string };
  entity?: { type: string; id: string };
  onApply: (patch: Partial<SeoDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SeoDraft | null>(null);
  const [checked, setChecked] = useState<Record<FieldKey, boolean>>({
    seoTitle: false,
    seoDescription: false,
    ogTitle: false,
    ogDescription: false,
    focusKeywords: false,
  });

  async function generate() {
    setBusy(true);
    setReason(null);
    setSuggestion(null);
    setOpen(true);
    try {
      const result = await runAiJson(
        {
          feature: "seo_generation",
          payload: {
            title: source.title,
            content: source.content,
            ...(source.excerpt ? { excerpt: source.excerpt } : {}),
            ...(source.locale ? { locale: source.locale } : {}),
          },
          ...(entity ? { entity } : {}),
        },
        // Parsed by the SAME schema the form uses, with the columns' own
        // limits: an over-length meta description is a FAILED generation, not
        // a truncation (ADR-097 #13).
        (value) => toDraft(seoSuggestionSchema.parse(value)),
      );
      setSuggestion(result);
      // Default-checked only where the field is empty.
      setChecked(
        Object.fromEntries(
          FIELD_ORDER.map((key) => [key, current[key].trim().length === 0 && result[key] !== ""]),
        ) as Record<FieldKey, boolean>,
      );
    } catch (error) {
      setReason(error instanceof AiClientError ? error.reason : "provider_error");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    const patch: Partial<SeoDraft> = {};
    for (const key of FIELD_ORDER) {
      if (checked[key] && suggestion[key] !== "") patch[key] = suggestion[key];
    }
    onApply(patch);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => void generate()}>
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

          {busy && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner size="sm" aria-label={labels.generating} />
              {labels.generating}
            </div>
          )}

          {reason && (
            <p className="py-4 text-sm text-destructive-interactive" role="status">
              {labels.failed} — {labels.reasons[reason] ?? reason}
            </p>
          )}

          {suggestion && (
            <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
              {FIELD_ORDER.filter((key) => suggestion[key] !== "").map((key) => (
                <Field key={key} orientation="horizontal" className="items-start">
                  <Checkbox
                    checked={checked[key]}
                    onCheckedChange={(value) =>
                      setChecked((state) => ({ ...state, [key]: value === true }))
                    }
                  />
                  <FieldContent>
                    <FieldLabel>{labels.fields[key]}</FieldLabel>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">{labels.current}</span>
                        {/* Rendered as TEXT. A `<script>` in a suggestion
                            arrives as visible characters (§12 #5). */}
                        <p className="text-sm whitespace-pre-wrap">
                          {current[key] || (
                            <span className="text-muted-foreground">{labels.empty}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">{labels.suggested}</span>
                        <p className="text-sm whitespace-pre-wrap">{suggestion[key]}</p>
                      </div>
                    </div>
                  </FieldContent>
                </Field>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              onClick={apply}
              disabled={!suggestion || !FIELD_ORDER.some((key) => checked[key])}
            >
              {labels.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
