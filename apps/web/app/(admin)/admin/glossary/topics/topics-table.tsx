"use client";

// The glossary topics list (changes-18 PR 3).
//
// It replaces `topics-manager.tsx`, which edited five fields inline in each row
// with a per-row Save. That shape was defensible while a topic WAS five fields;
// it stopped being defensible the moment a topic grew a rich-text description
// and SEO copy, because neither fits in a table cell. Editing moved to
// `/admin/glossary/topics/[id]`; this is a table, so it gets the toolbar search
// and status filter every other list screen has (code-style.md #9).
//
// Ordering survives the move as Move up / Move down row actions rather than
// drag and drop — plan §8.2, and this repo still has no DnD dependency. Order
// commits immediately, as it did in the manager: it is a property of the LIST,
// and holding it as an unsaved draft beside per-row edits is what made the old
// screen confusing.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, Tags, Trash2 } from "lucide-react";
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
import {
  deleteGlossaryTopicAction,
  duplicateGlossaryTopicAction,
  reorderGlossaryTopicsAction,
} from "../../_actions/glossary-topic-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { FilterBar } from "../../_components/filter-bar.tsx";
import { StatusBadge } from "../../_components/status-badge.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface TopicRow {
  id: string;
  name: string;
  slug: string;
  /** Already flattened to plain text by the loader — the column is rich text. */
  description: string | null;
  isActive: boolean;
  termCount: number;
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
}

export interface TopicsTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  nameCol: string;
  statusCol: string;
  termsCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  published: string;
  draft: string;
  edit: string;
  duplicate: string;
  moveUp: string;
  moveDown: string;
  deleteTopic: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  openActions: string;
  emptyTitle: string;
  emptyBody: string;
  allStatuses: string;
  statusLabel: string;
  statusPublished: string;
  statusDraft: string;
}

function RowActions({
  row,
  index,
  total,
  canCreate,
  canUpdate,
  canDelete,
  onMove,
  labels,
}: {
  row: TopicRow;
  index: number;
  total: number;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onMove: (index: number, delta: number) => void;
  labels: TopicsTableLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={labels.openActions}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/glossary/topics/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>

          {canCreate && (
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await duplicateGlossaryTopicAction(row.id);
                  router.push(`/admin/glossary/topics/${id}`);
                })
              }
            >
              <Copy aria-hidden data-icon="inline-start" />
              {labels.duplicate}
            </DropdownMenuItem>
          )}

          {canUpdate && (
            <>
              <DropdownMenuSeparator />
              {/* Keyboard-reachable by construction: these are menu items, not
                  drag handles (plan §8.2). Disabled at the ends rather than
                  hidden, so the menu does not change shape row to row. */}
              <DropdownMenuItem disabled={pending || index === 0} onClick={() => onMove(index, -1)}>
                <ChevronUp aria-hidden data-icon="inline-start" />
                {labels.moveUp}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending || index === total - 1}
                onClick={() => onMove(index, 1)}
              >
                <ChevronDown aria-hidden data-icon="inline-start" />
                {labels.moveDown}
              </DropdownMenuItem>
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 aria-hidden data-icon="inline-start" />
                {labels.deleteTopic}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* A topic delete is permanent — there is no soft-delete column on
          `GlossaryTopic` — so it confirms (ADR-044 #7). The service refuses
          outright while terms are still filed under it; this dialog is the
          courtesy, `TopicInUseError` is the rule. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => deleteGlossaryTopicAction(row.id))}
      />
    </div>
  );
}

export function TopicsTable({
  rows,
  canCreate,
  canUpdate,
  canDelete,
  labels,
}: {
  rows: TopicRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  labels: TopicsTableLabels;
}) {
  const { run } = useServerAction();
  const [status, setStatus] = useState("");

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          status === "" ||
          (status === "active" && row.isActive) ||
          (status === "draft" && !row.isActive),
      ),
    [rows, status],
  );

  // Reorder acts on the FULL list, never the filtered view: positions are
  // absolute, and swapping two rows that happen to be adjacent under a filter
  // would move them past rows the editor cannot see.
  //
  // `useCallback` so the column definitions below can list it as a dependency
  // honestly instead of disabling the rule that asks for it.
  const move = useCallback(
    (rowId: string, delta: number) => {
      const ids = rows.map((row) => row.id);
      const from = ids.indexOf(rowId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved!);
      run(() => reorderGlossaryTopicsAction(ids));
    },
    [rows, run],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.name} ${row.slug} ${row.description ?? ""}`,
    sortValues: {
      name: (row) => row.name,
      status: (row) => String(row.isActive),
      terms: (row) => row.termCount,
      updatedAt: (row) => row.updatedAtSort,
    },
  });

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, c) => `${labels.pageWord} ${p} ${labels.ofWord} ${c}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  const columns = useMemo<ColumnDef<TopicRow>[]>(
    () => [
      {
        id: "name",
        header: labels.nameCol,
        meta: { label: labels.nameCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-96 flex-col gap-1">
            <Link
              href={`/admin/glossary/topics/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.name || labels.untitled}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.original.slug && (
                <span className="truncate text-xs text-muted-foreground">/{row.original.slug}</span>
              )}
            </div>
            {row.original.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.description}
              </span>
            )}
          </div>
        ),
      },
      {
        // `isActive` presented as Published/Draft (changes-18 §2 D2). A topic is
        // taxonomy and does NOT run the seven-state machine; this is the honest
        // wording for the one boolean it has, not a status column pretending to
        // be one.
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "neutral"}>
            {row.original.isActive ? labels.published : labels.draft}
          </StatusBadge>
        ),
      },
      {
        id: "terms",
        header: labels.termsCol,
        meta: { label: labels.termsCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.termCount}</span>,
      },
      {
        id: "updatedAt",
        header: labels.updatedCol,
        meta: { label: labels.updatedCol },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.updatedAtLabel}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableHiding: false,
        cell: ({ row }) => (
          <RowActions
            row={row.original}
            index={rows.findIndex((entry) => entry.id === row.original.id)}
            total={rows.length}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onMove={(_, delta) => move(row.original.id, delta)}
            labels={labels}
          />
        ),
      },
    ],
    [labels, rows, move, canCreate, canUpdate, canDelete],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Tags aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
        <EmptyDescription>{labels.emptyBody}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <DataTable
      {...tableProps}
      columns={columns}
      labels={tableLabels}
      filters={
        <FilterBar>
          <AdminCombobox
            aria-label={labels.statusLabel}
            className="w-40"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: labels.allStatuses },
              { value: "active", label: labels.statusPublished },
              { value: "draft", label: labels.statusDraft },
            ]}
          />
        </FilterBar>
      }
    />
  );
}
