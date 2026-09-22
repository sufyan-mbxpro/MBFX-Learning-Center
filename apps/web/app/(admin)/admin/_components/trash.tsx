"use client";

// The trash, shared by the six content lists (changes-49, ADR-147).
//
// A soft-deleted row no longer mixes into a list: every list hides it by
// default, and a "Deleted" entry in the list's own STATUS filter shows the
// trash instead — the owner's "do not show deleted in all courses". There, a
// row offers Restore (unconfirmed, ADR-044 #7: it is the undo) and Delete
// permanently (confirmed, and the service refuses a row not in the trash).
//
// `DELETED_FILTER` is a status VALUE, not a second control, because the
// question "which of these am I looking at" is the one the status filter
// already answers; a separate switch would let a reader ask for "Published
// AND deleted", which is always empty.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { PurgeableEntity } from "@repo/contracts";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DropdownMenuItem } from "@repo/ui/components/dropdown-menu";
import { purgeContentAction } from "../_actions/purge-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

/** The status-filter value that means "show the trash". */
export const DELETED_FILTER = "__deleted";

/**
 * Whether a row belongs in the list under the chosen status filter: the
 * trash under `DELETED_FILTER`, and otherwise only live rows — narrowed by
 * `matchesStatus` when a real status is chosen.
 */
export function inStatusFilter(
  deleted: boolean,
  filter: string,
  matchesStatus: () => boolean,
): boolean {
  if (filter === DELETED_FILTER) return deleted;
  if (deleted) return false;
  return filter === "" || matchesStatus();
}

/** The filter option itself, appended to a status dropdown's options. */
export function useDeletedFilterOption(): { value: string; label: string } {
  const t = useTranslations("admin.trash");
  return { value: DELETED_FILTER, label: t("filter") };
}

/**
 * The "Delete permanently" menu item and its confirmation. Returned as two
 * pieces because the dialog must render OUTSIDE the dropdown, which unmounts
 * its content when it closes.
 */
export function usePermanentDelete(entity: PurgeableEntity, id: string) {
  const t = useTranslations("admin.trash");
  const tAdmin = useTranslations("admin");
  const { run, pending } = useServerAction();
  const [open, setOpen] = useState(false);

  const item = (
    <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
      <Trash2 aria-hidden data-icon="inline-start" />
      {t("purge")}
    </DropdownMenuItem>
  );
  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={t("purgeTitle")}
      description={t("purgeBody")}
      confirmLabel={t("purge")}
      cancelLabel={tAdmin("cancel")}
      onConfirm={() => run(() => purgeContentAction(entity, id), { successMessage: t("purged") })}
    />
  );
  return { item, dialog };
}
