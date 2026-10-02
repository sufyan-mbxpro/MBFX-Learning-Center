"use client";

// "Translate with Google" (plan §3, ADR-160): fills another locale's form
// from the source locale's CURRENT text through Google Cloud Translation.
//
// It writes nothing. The form is filled, marked machine-written, and the
// editor's own Save stores it: untouched it stays MACHINE_TRANSLATED (served,
// not indexed — ADR-159), and the first edit to a translatable field makes
// the Save write TRANSLATED. Where it would overwrite text a person wrote, it
// asks first (code-style.md #7). Slugs are never sent.
//
// Absent — not disabled — when automatic translation is off, as every AI
// affordance is (ADR-097): the page decides whether to draw it.
import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Spinner } from "@repo/ui/components/spinner";
import { toast } from "sonner";
import { prefillTranslationAction } from "../_actions/translate-actions.ts";
import { withoutSlug } from "../_lib/machine-translation.ts";

export interface GoogleTranslateLabels {
  action: string;
  confirmTitle: string;
  confirmDescription: string;
  confirm: string;
  cancel: string;
  working: string;
  done: string;
  failed: string;
  reasons: Record<string, string>;
}

export function GoogleTranslateButton({
  labels,
  entity,
  sourceLocale,
  targetLocale,
  texts,
  html,
  wouldOverwrite,
  onApply,
}: {
  labels: GoogleTranslateLabels;
  entity: { type: "article" | "promotion"; id: string };
  sourceLocale: string;
  targetLocale: string;
  /** The source locale's plain-text fields, by name. Never a slug. */
  texts: Record<string, string>;
  /** The source locale's rich-text fields, by name. */
  html: Record<string, string>;
  /** Whether the target locale holds text a person wrote. */
  wouldOverwrite: boolean;
  onApply: (translated: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function translate() {
    setBusy(true);
    setConfirming(false);
    // ADR-181: a slug is shared by every language, so it is never sent and
    // never written back, whatever a caller passed.
    const sentTexts = withoutSlug(texts);
    const sentHtml = withoutSlug(html);
    try {
      const result = await prefillTranslationAction({
        entity,
        sourceLocale,
        targetLocale,
        texts: sentTexts,
        html: sentHtml,
      });
      if (!result.ok) {
        toast.error(`${labels.failed} — ${labels.reasons[result.reason] ?? result.reason}`);
        return;
      }
      // Only the fields that were asked about; a blank answer never clears one.
      const applied: Record<string, string> = {};
      for (const [name, value] of Object.entries({ ...result.texts, ...result.html })) {
        if ((name in sentTexts || name in sentHtml) && value.trim()) applied[name] = value;
      }
      onApply(applied);
      toast.success(labels.done);
    } catch {
      toast.error(labels.failed);
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
        disabled={busy}
        onClick={() => (wouldOverwrite ? setConfirming(true) : void translate())}
      >
        {busy ? (
          <Spinner size="sm" aria-label={labels.working} data-icon="inline-start" />
        ) : (
          <Globe aria-hidden data-icon="inline-start" />
        )}
        {labels.action}
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
