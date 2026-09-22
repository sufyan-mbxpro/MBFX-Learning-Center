"use client";

// Versions panel (plan §8, PR 3.5) — publish history, "Restore as draft"
// (loads an earlier snapshot back into the mutable draft for further
// editing — publishing state is untouched), and "Discard draft" (resets
// the draft to exactly what's currently published). Scoped down from the
// plan's "preview any version through draft mode": peeking at a historic
// version without restoring it would need the preview pipeline itself to
// accept a version parameter (`/api/preview` → the public route → a
// specific `PageVersion` instead of the mutable draft) — a real, separate
// piece of plumbing, not built here. Restore-then-preview covers the same
// need in two steps instead of one.
import * as React from "react";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { toast } from "sonner";
import {
  discardDraftAction,
  listVersionsAction,
  restoreVersionAsDraftAction,
} from "../../../../../_actions/builder-actions.ts";
import type { PageVersionRow } from "@repo/core";

export interface VersionsPanelLabels {
  title: string;
  description: string;
  empty: string;
  restoreAsDraft: string;
  discardDraft: string;
  confirmRestoreTitle: string;
  confirmRestoreBody: string;
  confirmDiscardTitle: string;
  confirmDiscardBody: string;
  cancel: string;
  publishedBy: string;
  close: string;
}

export function VersionsPanel({
  open,
  onOpenChange,
  pageId,
  hasPublishedVersion,
  onRestored,
  labels,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  pageId: string;
  hasPublishedVersion: boolean;
  /** Called after a successful restore/discard — the caller reloads the draft from the server rather than trying to reconcile local undo history against a server-side overwrite. */
  onRestored: () => void;
  labels: VersionsPanelLabels;
}) {
  const [versions, setVersions] = React.useState<PageVersionRow[] | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<number | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    void listVersionsAction(pageId).then(setVersions);
  }, [open, pageId]);

  async function handleRestore() {
    if (restoreTarget === null) return;
    await restoreVersionAsDraftAction(pageId, restoreTarget);
    setRestoreTarget(null);
    onOpenChange(false);
    toast.success(labels.restoreAsDraft);
    onRestored();
  }

  async function handleDiscard() {
    try {
      await discardDraftAction(pageId);
      onOpenChange(false);
      toast.success(labels.discardDraft);
      onRestored();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="end" closeLabel={labels.close}>
          <SheetHeader>
            <SheetTitle>{labels.title}</SheetTitle>
            <SheetDescription>{labels.description}</SheetDescription>
          </SheetHeader>
          {hasPublishedVersion && (
            <Button type="button" variant="outline" size="sm" onClick={() => setDiscardOpen(true)}>
              {labels.discardDraft}
            </Button>
          )}
          <div className="flex flex-col gap-2">
            {versions === null ? null : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      #{version.number}
                      {version.note ? ` — ${version.note}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {labels.publishedBy} {version.authorName ?? version.authorId} ·{" "}
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(version.createdAt))}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRestoreTarget(version.number)}
                  >
                    {labels.restoreAsDraft}
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(next) => !next && setRestoreTarget(null)}
        title={labels.confirmRestoreTitle}
        description={labels.confirmRestoreBody}
        confirmLabel={labels.restoreAsDraft}
        cancelLabel={labels.cancel}
        onConfirm={handleRestore}
        destructive={false}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={labels.confirmDiscardTitle}
        description={labels.confirmDiscardBody}
        confirmLabel={labels.discardDraft}
        cancelLabel={labels.cancel}
        onConfirm={handleDiscard}
      />
    </>
  );
}
