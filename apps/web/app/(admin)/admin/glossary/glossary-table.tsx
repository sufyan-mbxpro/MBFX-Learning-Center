"use client";

// The glossary list (ADR-069, changes-17 PR 2).
//
// It replaces a stack of cards that each mounted a full Tiptap instance — at
// fifty terms, fifty editors and their history stacks, on a screen whose job
// is to help someone FIND a term. Editing moved to `/admin/glossary/[id]`;
// this is a table.
//
// Its distinctive columns are **Topic** and **School**, the two fields whose
// nulls mean opposite things (ADR-069 §3). An unfiled term shows a muted dash
// under Topic; a cross-market term shows "Both schools" under School, because
// that null is a real editorial choice and rendering it as absence would hide
// the difference the editor has to understand.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookOpen, Copy, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { pickByHash } from "@repo/utils";
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
  deleteGlossaryTermAction,
  duplicateGlossaryTermAction,
} from "../_actions/content-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { FilterBar } from "../_components/filter-bar.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
  type StatusTone,
} from "../_components/status-badge.tsx";
import { useClientTable } from "../_hooks/use-client-table.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

/**
 * The tones a topic name is drawn from — the quiz table's `CATEGORY_TONES`,
 * for the same reason and in the same order. A topic is editor data, so there
 * is no registry a fixed map could be built from; `pickByHash` gives every
 * topic a stable colour the moment it exists, and the same one on every screen
 * that shows it.
 */
const TOPIC_TONES = [
  "info",
  "success",
  "warning",
  "neutral",
] as const satisfies readonly StatusTone[];

export interface GlossaryRow {
  id: string;
  term: string;
  slug: string;
  status: string;
  statusLabel: string;
  /** Null = unfiled. */
  topicId: string | null;
  topicLabel: string | null;
  /** Null = every school — already resolved to its label by the page. */
  trackLabel: string;
  trackKey: string;
  difficultyLabel: string;
  localesLabel: string;
  deleted: boolean;
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
}

export interface GlossaryTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  termCol: string;
  statusCol: string;
  topicCol: string;
  trackCol: string;
  difficultyCol: string;
  localesCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  unfiled: string;
  deleted: string;
  edit: string;
  duplicate: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  openActions: string;
  emptyTitle: string;
  emptyBody: string;
  allStatuses: string;
  allTopics: string;
  allTracks: string;
  statusLabel: string;
  topicLabel: string;
  trackLabel: string;
  statuses: Record<string, string>;
}

function RowActions({
  row,
  canCreate,
  canDelete,
  labels,
}: {
  row: GlossaryRow;
  canCreate: boolean;
  canDelete: boolean;
  labels: GlossaryTableLabels;
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
          <DropdownMenuItem render={<Link href={`/admin/glossary/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>
          {canCreate && (
            // Opens the copy, as the quiz and lesson tables do: a DRAFT named
            // "… (copy)" is not finished work, and leaving the editor on the
            // list means hunting for the row they just made.
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await duplicateGlossaryTermAction(row.id);
                  router.push(`/admin/glossary/${id}`);
                })
              }
            >
              <Copy aria-hidden data-icon="inline-start" />
              {labels.duplicate}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              {row.deleted ? (
                // ADR-044 #7: restore is NOT confirmed. It is the undo, and
                // gating it makes the destructive path harder to reverse.
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => deleteGlossaryTermAction(row.id, false))}
                >
                  <Undo2 aria-hidden data-icon="inline-start" />
                  {labels.restore}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 aria-hidden data-icon="inline-start" />
                  {labels.softDelete}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => deleteGlossaryTermAction(row.id, true))}
      />
    </div>
  );
}

export function GlossaryTable({
  rows,
  statusKeys,
  topicOptions,
  trackOptions,
  canCreate,
  canDelete,
  labels,
}: {
  rows: GlossaryRow[];
  statusKeys: string[];
  topicOptions: { value: string; label: string }[];
  trackOptions: { value: string; label: string }[];
  canCreate: boolean;
  canDelete: boolean;
  labels: GlossaryTableLabels;
}) {
  const [status, setStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [track, setTrack] = useState("");

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "" || row.status === status) &&
          (topic === "" || (row.topicId ?? "") === topic) &&
          (track === "" || row.trackKey === track),
      ),
    [rows, status, topic, track],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.term} ${row.slug} ${row.topicLabel ?? ""}`,
    sortValues: {
      term: (row) => row.term,
      status: (row) => row.status,
      topic: (row) => row.topicLabel ?? "",
      track: (row) => row.trackLabel,
      difficulty: (row) => row.difficultyLabel,
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

  const columns = useMemo<ColumnDef<GlossaryRow>[]>(
    () => [
      {
        id: "term",
        header: labels.termCol,
        meta: { label: labels.termCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-1">
            <Link
              href={`/admin/glossary/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.term || labels.untitled}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.original.slug && (
                <span className="truncate text-xs text-muted-foreground">/{row.original.slug}</span>
              )}
              {row.original.deleted && (
                <StatusBadge tone="destructive">{labels.deleted}</StatusBadge>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, row.original.status)}>
            {row.original.statusLabel}
          </StatusBadge>
        ),
      },
      {
        id: "topic",
        header: labels.topicCol,
        meta: { label: labels.topicCol },
        cell: ({ row }) =>
          row.original.topicLabel ? (
            // Derived, not looked up — `pickByHash` over the topic NAME, the
            // same way the quiz table colours a category. A topic is editor
            // data with no registry to enumerate, so a fixed map would go
            // stale the first time someone adds one.
            <StatusBadge tone={pickByHash(row.original.topicLabel, TOPIC_TONES)}>
              {row.original.topicLabel}
            </StatusBadge>
          ) : (
            // Unfiled is an ABSENCE and reads as one.
            <span className="text-muted-foreground">{labels.unfiled}</span>
          ),
      },
      {
        id: "track",
        header: labels.trackCol,
        meta: { label: labels.trackCol },
        // "Both schools" is a CHOICE, so it renders as a value like any other
        // rather than as the dash the unfiled topic gets.
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.trackLabel}</span>,
      },
      {
        id: "difficulty",
        header: labels.difficultyCol,
        meta: { label: labels.difficultyCol },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.difficultyLabel}</span>
        ),
      },
      {
        id: "locales",
        header: labels.localesCol,
        meta: { label: labels.localesCol },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.localesLabel}</span>
        ),
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
            canCreate={canCreate}
            canDelete={canDelete}
            labels={labels}
          />
        ),
      },
    ],
    [labels, canCreate, canDelete],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <BookOpen aria-hidden className="size-6 text-muted-foreground" />
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
        // ADR-044 #9: filters live in the table's toolbar, not a bar above it.
        // ADR-057 §3: each declares its own width, because full width is the
        // form-field default and would take the whole row.
        <FilterBar>
          <AdminCombobox
            aria-label={labels.statusLabel}
            className="w-40"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: labels.allStatuses },
              ...statusKeys.map((key) => ({ value: key, label: labels.statuses[key] ?? key })),
            ]}
          />
          <AdminCombobox
            aria-label={labels.topicLabel}
            className="w-44"
            value={topic}
            onValueChange={setTopic}
            options={[{ value: "", label: labels.allTopics }, ...topicOptions]}
          />
          <AdminCombobox
            aria-label={labels.trackLabel}
            className="w-40"
            value={track}
            onValueChange={setTrack}
            options={[{ value: "", label: labels.allTracks }, ...trackOptions]}
          />
        </FilterBar>
      }
    />
  );
}
