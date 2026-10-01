"use client";

// AI translation (changes-29 B3).
//
// **A machine translation is saved only as `MACHINE_TRANSLATED`.** This
// component fills the form; the editor's Save writes the status, and it writes
// `TRANSLATED` the moment a human has touched the text — so the review IS the
// promotion and no separate "approve" step is invented (ADR-097 #4).
//
// **Slugs are never translated.** A slug change writes a `Redirect` and is an
// SEO act, so it stays a human decision. The prompt builder drops the field and
// this component never sends it.
//
// The button is absent unless the target locale's draft is EMPTY or already
// machine-written; where it would overwrite text somebody wrote, it asks first
// (ADR-044 #7).
import { useState } from "react";
import { Languages } from "lucide-react";
import { translationSuggestionSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Spinner } from "@repo/ui/components/spinner";
import { toast } from "sonner";
import { AiClientError, runAiJson } from "../_lib/ai-client.ts";

export interface AiTranslateLabels {
  /** "Translate from {source}" — the source locale is interpolated by the page. */
  action: string;
  /**
   * ADR-160 #7: the same button when the target already holds a draft —
   * usually Google's — which the model then corrects rather than replaces.
   */
  refineAction: string;
  confirmTitle: string;
  confirmDescription: string;
  confirm: string;
  cancel: string;
  generating: string;
  failed: string;
  done: string;
  reasons: Record<string, string>;
}

export function AiTranslateButton({
  labels,
  sourceLocale,
  targetLocale,
  /** The SOURCE locale's text, field by field. Named fields, never a row. */
  fields,
  /**
   * The TARGET locale's current text for the same fields (ADR-160 #7). When
   * any is present the button refines it: correct sentences stay, errors are
   * fixed, numbers are kept exactly.
   */
  drafts,
  /** Whether the target locale already holds text a human wrote. */
  wouldOverwrite,
  entity,
  onApply,
}: {
  labels: AiTranslateLabels;
  sourceLocale: string;
  targetLocale: string;
  fields: Record<string, string>;
  drafts?: Record<string, string>;
  wouldOverwrite: boolean;
  entity?: { type: string; id: string };
  onApply: (translated: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const usableDrafts = Object.fromEntries(
    Object.entries(drafts ?? {}).filter(([name, value]) => name in fields && value.trim() !== ""),
  );
  const refining = Object.keys(usableDrafts).length > 0;

  async function translate() {
    setBusy(true);
    setConfirming(false);
    try {
      const result = await runAiJson(
        {
          feature: "translation",
          payload: {
            sourceLocale,
            targetLocale,
            fields,
            ...(refining ? { drafts: usableDrafts } : {}),
          },
          ...(entity ? { entity } : {}),
        },
        (value) => translationSuggestionSchema.parse(value),
      );
      // Only the fields we ASKED about are applied. A model that invents a key
      // must not be able to write into a form field nobody offered it.
      const applied: Record<string, string> = {};
      for (const name of Object.keys(fields)) {
        const translated = result.fields[name];
        if (typeof translated === "string" && translated.trim()) applied[name] = translated;
      }
      onApply(applied);
      toast.success(labels.done);
    } catch (error) {
      const reason = error instanceof AiClientError ? error.reason : "provider_error";
      toast.error(`${labels.failed} — ${labels.reasons[reason] ?? reason}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (wouldOverwrite ? setConfirming(true) : void translate())}
      >
        {busy ? (
          <Spinner size="sm" aria-label={labels.generating} data-icon="inline-start" />
        ) : (
          <Languages aria-hidden data-icon="inline-start" />
        )}
        {refining ? labels.refineAction : labels.action}
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={labels.confirmTitle}
        description={labels.confirmDescription}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => void translate()}
      />
    </>
  );
}
