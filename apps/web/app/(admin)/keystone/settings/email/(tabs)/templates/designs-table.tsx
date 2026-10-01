"use client";

// Custom email designs (ADR-172 #3, changes-55 §5.2): starting points for a
// custom email, listed under the system templates on the same screen.
//
// A design is NOT a template: it has no key and nothing sends it. Starting an
// email copies it, so archiving one here changes no draft and no sent email —
// which is why archive is the default rather than delete, and restore is not
// confirmed (code-style #7: it is the undo).
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Palette, Pencil, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { EmailBodyMode } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import {
  duplicateEmailDesignAction,
  setEmailDesignArchivedAction,
} from "../../../../_actions/custom-email-actions.ts";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { HeaderActions } from "../../../../_components/header-actions.tsx";
import { useClientTable } from "../../../../_hooks/use-client-table.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";

export interface EmailDesignTableRow {
  id: string;
  name: string;
  description: string | null;
  mode: EmailBodyMode;
  archived: boolean;
  updatedLabel: string;
  updatedSort: number;
  updatedByName: string | null;
}

const EDIT_PATH = "/keystone/settings/email/designs";

function RowActions({ row, canUpdate }: { row: EmailDesignTableRow; canUpdate: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { run } = useServerAction();
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  if (!canUpdate) {
    return (
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link href={`${EDIT_PATH}/${row.id}`}>
            <Pencil aria-hidden />
            {t("open")}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={t("openActions")}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`${EDIT_PATH}/${row.id}`)}>
            <Pencil aria-hidden data-icon="inline-start" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                async () => {
                  const result = await duplicateEmailDesignAction(row.id);
                  if (!result.ok)
                    throw new Error(t(`announcements.direct.refusals.${result.reason}`));
                  router.push(`${EDIT_PATH}/${result.id}`);
                },
                { successMessage: t("email.designs.duplicated") },
              )
            }
          >
            <Copy aria-hidden data-icon="inline-start" />
            {t("email.designs.duplicate")}
          </DropdownMenuItem>
          {row.archived ? (
            <DropdownMenuItem
              onClick={() =>
                run(() => setEmailDesignArchivedAction({ id: row.id, archived: false }), {
                  successMessage: t("email.designs.restored"),
                })
              }
            >
              <ArchiveRestore aria-hidden data-icon="inline-start" />
              {t("email.designs.restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)}>
              <Archive aria-hidden data-icon="inline-start" />
              {t("email.designs.archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("email.designs.archiveTitle")}
        description={t("email.designs.archiveBody")}
        confirmLabel={t("email.designs.archive")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={() =>
          run(() => setEmailDesignArchivedAction({ id: row.id, archived: true }), {
            successMessage: t("email.designs.archived"),
          })
        }
      />
    </>
  );
}

export function EmailDesignsTable({
  rows,
  canUpdate,
}: {
  rows: EmailDesignTableRow[];
  canUpdate: boolean;
}) {
  const t = useTranslations("admin");
  const [show, setShow] = React.useState<"active" | "all">("active");

  const visible = React.useMemo(
    () => rows.filter((row) => show === "all" || !row.archived),
    [rows, show],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.name} ${row.description ?? ""}`,
    sortValues: {
      name: (row) => row.name,
      mode: (row) => row.mode,
      updated: (row) => row.updatedSort,
    },
  });

  const tableLabels: DataTableLabels = {
    search: t("email.designs.search"),
    columns: t("columns"),
    export: t("export"),
    selectedCount: (n) => `${n} ${t("selectedCount")}`,
    page: (p, c) => `${t("pageWord")} ${p} ${t("ofWord")} ${c}`,
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
  };

  const columns = React.useMemo<ColumnDef<EmailDesignTableRow>[]>(
    () => [
      {
        id: "name",
        header: t("email.designs.columnName"),
        meta: { label: t("email.designs.columnName") },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-96 flex-col gap-1">
            <span className="flex items-center gap-2">
              <Link
                href={`${EDIT_PATH}/${row.original.id}`}
                className="truncate font-medium hover:underline"
              >
                {row.original.name}
              </Link>
              {row.original.archived && (
                <Badge variant="secondary" className="text-3xs">
                  {t("email.designs.archivedBadge")}
                </Badge>
              )}
            </span>
            {row.original.description && (
              <span className="truncate text-xs text-muted-foreground">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "mode",
        header: t("email.designs.columnMode"),
        meta: { label: t("email.designs.columnMode") },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.mode === "HTML"
              ? t("email.designs.modeHtml")
              : t("email.designs.modeRich")}
          </span>
        ),
      },
      {
        id: "updated",
        header: t("email.designs.columnUpdated"),
        meta: { label: t("email.designs.columnUpdated") },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.updatedLabel}
            {row.original.updatedByName ? ` · ${row.original.updatedByName}` : ""}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actionsCol")}</span>,
        meta: { label: t("actionsCol") },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions row={row.original} canUpdate={canUpdate} />
          </div>
        ),
      },
    ],
    [t, canUpdate],
  );

  // The screen's primary action sits on its TITLE row (ADR-140 §3), portaled
  // there because the heading belongs to the email section's layout.
  const createButton = canUpdate ? (
    <HeaderActions>
      <Button render={<Link href={`${EDIT_PATH}/new`} />}>
        <Plus aria-hidden data-icon="inline-start" />
        {t("email.designs.create")}
      </Button>
    </HeaderActions>
  ) : null;

  if (rows.length === 0) {
    return (
      <>
        {createButton}
        <Empty>
          <EmptyMedia>
            <Palette aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t("email.designs.empty")}</EmptyTitle>
          <EmptyDescription>{t("email.designs.emptyBody")}</EmptyDescription>
        </Empty>
      </>
    );
  }

  return (
    <>
      {createButton}
      <DataTable
        {...tableProps}
        columns={columns}
        labels={tableLabels}
        filters={
          <FilterBarRow>
            <AdminCombobox
              aria-label={t("email.designs.filterArchived")}
              className="w-48"
              value={show}
              onValueChange={(value) => setShow(value as "active" | "all")}
              options={[
                { value: "active", label: t("email.designs.filterActive") },
                { value: "all", label: t("email.designs.filterAll") },
              ]}
            />
          </FilterBarRow>
        }
      />
    </>
  );
}
