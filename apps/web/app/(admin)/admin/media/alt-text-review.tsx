"use client";

// The bulk alt-text review list (changes-29 B5).
//
// **It writes nothing until Save.** This is the one place in Phase 2 where
// ADR-097 #4 is a design constraint rather than a description: a background
// writer over 200 images is one `updateMany` away, and it would make the model
// an editor. So generation returns SUGGESTIONS, every row is editable, every
// row is accepted individually, and the accepted ones are saved through
// `updateMediaMetaAction` — the same action, schema and `media.update` check a
// hand-typed alt text goes through.
//
// The estimated cost is shown BEFORE the run starts, because "generate for up
// to N images" is the one AI control in the admin that spends N times.
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { toast } from "sonner";
import { suggestAltTextBulkAction } from "../_actions/ai-actions.ts";
import { updateMediaMetaAction } from "../_actions/media-actions.ts";
import { AdminSection } from "../_components/admin-page.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";

export interface AltTextReviewLabels {
  title: string;
  description: string;
  /** "About {cost} for up to {count} images" — interpolated by the page. */
  costNote: string;
  start: string;
  running: string;
  save: string;
  saved: string;
  accept: string;
  empty: string;
  emptyBody: string;
  failedRow: string;
  reasons: Record<string, string>;
}

interface Row {
  assetId: string;
  fileName: string;
  altText: string;
  reason: string | null;
  accepted: boolean;
}

export function AltTextReview({
  labels,
  limit,
}: {
  labels: AltTextReviewLabels;
  /** How many undescribed images one run covers. Bounded by the service too. */
  limit: number;
}) {
  const { run, pending } = useServerAction();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const suggestions = await suggestAltTextBulkAction({ limit });
      setRows(
        suggestions.map((suggestion) => ({
          assetId: suggestion.assetId,
          fileName: suggestion.fileName,
          altText: suggestion.altText ?? "",
          reason: suggestion.reason,
          // A row that failed is shown and NOT accepted: an image the model
          // could not describe is information, not a blank to be saved.
          accepted: suggestion.altText !== null,
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const accepted = (rows ?? []).filter((row) => row.accepted && row.altText.trim());
    if (accepted.length === 0) return;
    run(
      async () => {
        // One action per asset, sequentially: each is an audited mutation of a
        // different row, and a partial failure must leave the rest saved.
        for (const row of accepted) {
          await updateMediaMetaAction(row.assetId, { altText: row.altText.trim() });
        }
      },
      { successMessage: labels.saved, onDone: () => setRows(null) },
    );
  }

  return (
    <AdminSection title={labels.title}>
      <p className="text-sm text-muted-foreground">{labels.description}</p>
      {/* The number that makes "start" a decision. It says "estimated", like
          every other figure this platform prints (ADR-100 #4). */}
      <p className="text-xs text-muted-foreground">{labels.costNote}</p>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => void generate()}>
          {busy ? (
            <Spinner size="sm" aria-label={labels.running} data-icon="inline-start" />
          ) : (
            <Sparkles aria-hidden data-icon="inline-start" />
          )}
          {busy ? labels.running : labels.start}
        </Button>
      </div>

      {rows !== null && rows.length === 0 && (
        <Empty>
          <EmptyTitle>{labels.empty}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
        </Empty>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <Card key={row.assetId}>
                <CardContent className="flex flex-col gap-2">
                  <span className="text-2xs text-muted-foreground">{row.fileName}</span>
                  {row.reason ? (
                    <p className="text-sm text-destructive-interactive">
                      {labels.failedRow} — {labels.reasons[row.reason] ?? row.reason}
                    </p>
                  ) : (
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
                      <div className="flex w-full flex-col gap-1">
                        <FieldLabel>{labels.accept}</FieldLabel>
                        {/* Editable, because a suggestion a human corrected is
                            still the human's — and correcting it here is
                            cheaper than opening each asset. */}
                        <Input
                          value={row.altText}
                          maxLength={160}
                          onChange={(event) =>
                            setRows((current) =>
                              (current ?? []).map((item, at) =>
                                at === index ? { ...item, altText: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </Field>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={save} disabled={pending}>
              {labels.save}
            </Button>
          </div>
        </>
      )}
    </AdminSection>
  );
}
