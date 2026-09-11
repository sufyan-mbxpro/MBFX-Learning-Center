"use client";

// The video topic list (changes-16 PR 5, ADR-068).
//
// Shaped after `quizzes-table.tsx`, with one difference that matters: a video
// topic's distinctive column is **Videos**, the count of attached sources.
// A topic can legitimately have none — a written guide filed under a category
// is a valid topic (ADR-068's capability rule allows a body instead) — so the
// column reads as information, not as an error state.
//
// Both filters live in the table's toolbar (code-style #9) and both declare
// their own width, which is how a toolbar filter says it is not a form field
// (ADR-057 §3).
import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Undo2, Video } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
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
import { setVideoTopicDeletedAction } from "../../_actions/video-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { FilterBar } from "../../_components/filter-bar.tsx";
import { CONTENT_STATUS_TONE, StatusBadge, statusTone } from "../../_components/status-badge.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface VideoTopicRow {
  id: string;
  title: string;
  slug: string;
  track: string;
  trackLabel: string;
  categoryId: string | null;
  categoryLabel: string | null;
  status: string;
  statusLabel: string;
  videoCount: number;
  linkCount: number;
  deleted: boolean;
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
}

export interface VideosTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  titleCol: string;
  trackCol: string;
  statusCol: string;
  videosCol: string;
  linksCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  uncategorised: string;
  deleted: string;
  edit: string;
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
  statusLabel: string;
  allTracks: string;
  trackLabel: string;
  allCategories: string;
  categoryLabel: string;
  statuses: Record<string, string>;
  tracks: Record<string, string>;
}

function RowActions({
  row,
  canDelete,
  labels,
}: {
  row: VideoTopicRow;
  canDelete: boolean;
  labels: VideosTableLabels;
}) {
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
          <DropdownMenuItem render={<Link href={`/admin/learn/videos/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              {row.deleted ? (
                // ADR-044 #7: restore is NOT confirmed. It is the undo, and
                // gating it makes the destructive path harder to reverse.
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => setVideoTopicDeletedAction(row.id, false))}
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
        onConfirm={() => run(() => setVideoTopicDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function VideosTable({
  rows,
  statusKeys,
  trackKeys,
  categories,
  canDelete,
  labels,
}: {
  rows: VideoTopicRow[];
  statusKeys: string[];
  trackKeys: string[];
  categories: { id: string; name: string }[];
  canDelete: boolean;
  labels: VideosTableLabels;
}) {
  const [status, setStatus] = useState("");
  const [track, setTrack] = useState("");
  const [category, setCategory] = useState("");

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "" || row.status === status) &&
          (track === "" || row.track === track) &&
          (category === "" || row.categoryId === category),
      ),
    [rows, status, track, category],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title} ${row.slug} ${row.categoryLabel ?? ""}`,
    sortValues: {
      title: (row) => row.title,
      track: (row) => row.track,
      status: (row) => row.status,
      videos: (row) => row.videoCount,
      links: (row) => row.linkCount,
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

  const columns = useMemo<ColumnDef<VideoTopicRow>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-1">
            <Link
              href={`/admin/learn/videos/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.title || labels.untitled}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{row.original.categoryLabel ?? labels.uncategorised}</Badge>
              {row.original.deleted && <Badge variant="outline">{labels.deleted}</Badge>}
            </div>
          </div>
        ),
      },
      {
        id: "track",
        header: labels.trackCol,
        meta: { label: labels.trackCol },
        cell: ({ row }) => <Badge variant="outline">{row.original.trackLabel}</Badge>,
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
        id: "videos",
        header: labels.videosCol,
        meta: { label: labels.videosCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.videoCount}</span>,
      },
      {
        id: "links",
        header: labels.linksCol,
        meta: { label: labels.linksCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.linkCount}</span>,
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
        cell: ({ row }) => <RowActions row={row.original} canDelete={canDelete} labels={labels} />,
      },
    ],
    [labels, canDelete],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Video aria-hidden className="size-6 text-muted-foreground" />
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
          {/* ADR-057 §3: a toolbar filter declares its own width; full width is
              the form-field default and would take the whole row. */}
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
            aria-label={labels.trackLabel}
            className="w-40"
            value={track}
            onValueChange={setTrack}
            options={[
              { value: "", label: labels.allTracks },
              ...trackKeys.map((key) => ({ value: key, label: labels.tracks[key] ?? key })),
            ]}
          />
          <AdminCombobox
            aria-label={labels.categoryLabel}
            className="w-48"
            value={category}
            onValueChange={setCategory}
            options={[
              { value: "", label: labels.allCategories },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FilterBar>
      }
    />
  );
}
