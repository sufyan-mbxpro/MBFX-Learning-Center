"use client";

// Video categories, as a list (changes-22; was `categories-manager.tsx`).
//
// What changed and why: the manager rendered every category as an expanded
// four-field form with its own Save. That is a reasonable shape for two rows
// and an unreadable one for ten — there was no way to scan what categories
// EXIST without reading past their slugs, descriptions and switches. So this
// is the table every other list screen in the admin is (code-style.md #9: the
// search and the status filter share the table's toolbar), and the form moved
// into `CategoryDialog`, over the list.
//
// Ordering stays keyboard-only row actions — plan §8.2, no DnD dependency —
// and still commits immediately rather than as a draft: order is a property
// of the LIST, and holding it unsaved beside per-row edits is exactly what
// made the old screen ambiguous. `TopicsTable` made the same call.
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import {
  deleteVideoCategoryAction,
  reorderVideoCategoriesAction,
} from "../../../_actions/video-actions.ts";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { StatusBadge } from "../../../_components/status-badge.tsx";
import { useClientTable } from "../../../_hooks/use-client-table.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { CategoryDialog, type VideoCategoryRow } from "./category-dialog.tsx";

export type { VideoCategoryRow };

export function CategoriesTable({
  rows,
  locale,
  canUpdate,
  canDelete,
}: {
  rows: VideoCategoryRow[];
  locale: string;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("admin");
  const { run } = useServerAction();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<VideoCategoryRow | null>(null);
  const [deleting, setDeleting] = useState<VideoCategoryRow | null>(null);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          status === "" ||
          (status === "active" && row.isActive) ||
          (status === "hidden" && !row.isActive),
      ),
    [rows, status],
  );

  // Reorder acts on the FULL list, never the filtered view: positions are
  // absolute, and swapping two rows that are only adjacent under a filter
  // would move them past rows the editor cannot see.
  const move = useCallback(
    (rowId: string, delta: number) => {
      const ids = rows.map((row) => row.id);
      const from = ids.indexOf(rowId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved!);
      run(() => reorderVideoCategoriesAction(ids));
    },
    [rows, run],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.name} ${row.slug} ${row.description ?? ""}`,
    sortValues: {
      name: (row) => row.name,
      status: (row) => String(row.isActive),
      topics: (row) => row.topicCount,
    },
  });

  const tableLabels: DataTableLabels = {
    search: t("videoCategoryManager.searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedCount: (n) => `${n} ${t("selectedCount")}`,
    page: (p, c) => `${t("pageWord")} ${p} ${t("ofWord")} ${c}`,
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
  };

  const columns = useMemo<ColumnDef<VideoCategoryRow>[]>(() => {
    const nameCol = t("videoCategoryManager.columnName");
    const statusCol = t("videoCategoryManager.columnStatus");
    const topicsCol = t("videoCategoryManager.columnTopics");
    const actionsCol = t("actionsCol");

    return [
      {
        id: "name",
        header: nameCol,
        meta: { label: nameCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-96 flex-col gap-1">
            {/* A button, not a link: the editor for a category is the dialog
                over this table, so there is no URL to point at. */}
            <button
              type="button"
              className="truncate text-start font-medium hover:underline"
              onClick={() => setEditing(row.original)}
            >
              {row.original.name || t("untitled")}
            </button>
            <span className="truncate text-xs text-muted-foreground">/{row.original.slug}</span>
            {row.original.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        // `isActive` read as Visible/Hidden. A category is taxonomy and does
        // NOT run the seven-state machine (ADR-068 §3), so this is the honest
        // wording for the one boolean it has rather than a status column
        // pretending to be one.
        id: "status",
        header: statusCol,
        meta: { label: statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "neutral"}>
            {row.original.isActive
              ? t("videoCategoryManager.statusVisible")
              : t("videoCategoryManager.statusHidden")}
          </StatusBadge>
        ),
      },
      {
        id: "topics",
        header: topicsCol,
        meta: { label: topicsCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.topicCount}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{actionsCol}</span>,
        meta: { label: actionsCol },
        enableHiding: false,
        cell: ({ row }) => {
          const index = rows.findIndex((entry) => entry.id === row.original.id);
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label={t("openActions")}>
                      <MoreHorizontal aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>
                    <Pencil aria-hidden data-icon="inline-start" />
                    {t("edit")}
                  </DropdownMenuItem>

                  {canUpdate && (
                    <>
                      <DropdownMenuSeparator />
                      {/* Keyboard-reachable by construction: menu items, not
                          drag handles (plan §8.2). Disabled at the ends rather
                          than hidden, so the menu keeps its shape row to row. */}
                      <DropdownMenuItem
                        disabled={index <= 0}
                        onClick={() => move(row.original.id, -1)}
                      >
                        <ChevronUp aria-hidden data-icon="inline-start" />
                        {t("videoCategoryManager.moveUp")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === rows.length - 1}
                        onClick={() => move(row.original.id, 1)}
                      >
                        <ChevronDown aria-hidden data-icon="inline-start" />
                        {t("videoCategoryManager.moveDown")}
                      </DropdownMenuItem>
                    </>
                  )}

                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(row.original)}
                      >
                        <Trash2 aria-hidden data-icon="inline-start" />
                        {t("videoCategoryManager.delete")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [t, rows, move, canUpdate, canDelete]);

  return (
    <>
      {rows.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <FolderOpen aria-hidden className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{t("videoCategoryManager.empty")}</EmptyTitle>
          <EmptyDescription>{t("videoCategoryManager.emptyBody")}</EmptyDescription>
        </Empty>
      ) : (
        <DataTable
          {...tableProps}
          columns={columns}
          labels={tableLabels}
          filters={
            <FilterBarRow>
              <AdminCombobox
                aria-label={t("videoCategoryManager.filterStatus")}
                className="w-40"
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: "", label: t("videoCategoryManager.filterAllStatuses") },
                  { value: "active", label: t("videoCategoryManager.statusVisible") },
                  { value: "hidden", label: t("videoCategoryManager.statusHidden") },
                ]}
              />
            </FilterBarRow>
          }
        />
      )}

      <CategoryDialog
        open={editing !== null}
        onOpenChange={(open) => setEditing(open ? editing : null)}
        target={editing}
        locale={locale}
      />

      {/* ADR-044 #7: deleting asks first. The body says what happens to the
          topics, because "delete category" reads like it might take them too —
          the FK is SetNull precisely so it does not. */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => setDeleting(open ? deleting : null)}
        title={t("videoCategoryManager.confirmDeleteTitle")}
        description={
          deleting && deleting.topicCount > 0
            ? t("videoCategoryManager.inUseBody")
            : t("videoCategoryManager.confirmDeleteBody")
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) run(() => deleteVideoCategoryAction(target.id));
        }}
      />
    </>
  );
}
