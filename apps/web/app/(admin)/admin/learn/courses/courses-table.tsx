"use client";

// Courses on the shared DataTable (changes-11 PR 3.1), driven CLIENT-side via
// useClientTable — the roles/employees pattern. `listCoursesAdmin` already
// returns the whole list, and adding server paging to @repo/core for a set
// this size would be churn without benefit.
import Link from "next/link";
import { useMemo, useState } from "react";
import { GraduationCap, MoreHorizontal, Pencil, SquareArrowOutUpRight, Trash2 } from "lucide-react";
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
import { setCourseDeletedAction } from "../../_actions/learn-actions.ts";
import { CONTENT_STATUS_TONE, StatusBadge, statusTone } from "../../_components/status-badge.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import {
  CoursesToolbar,
  type CoursesFilterLabels,
  type CoursesFilterState,
} from "./courses-controls.tsx";

export interface CourseRow {
  id: string;
  title: string;
  slug: string;
  track: string;
  trackLabel: string;
  status: string;
  statusLabel: string;
  difficulty: string;
  difficultyLabel: string;
  visibilityLabel: string;
  sectionCount: number;
  lessonCount: number;
  isExternal: boolean;
  deleted: boolean;
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
  publishedAtLabel: string | null;
}

export interface CoursesTableLabels extends CoursesFilterLabels {
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
  difficultyCol: string;
  visibilityCol: string;
  sectionsCol: string;
  lessonsCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  deleted: string;
  externalBadge: string;
  edit: string;
  softDelete: string;
  restore: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  openActions: string;
  emptyTitle: string;
}

function RowActions({
  row,
  canDelete,
  labels,
}: {
  row: CourseRow;
  canDelete: boolean;
  labels: CoursesTableLabels;
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
          <DropdownMenuItem render={<Link href={`/admin/learn/courses/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              {/* Restore is deliberately NOT confirmed (ADR-044 #7): it is the
                  undo, and gating it makes the destructive path harder to
                  reverse than it was to take. */}
              {row.deleted ? (
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => setCourseDeletedAction(row.id, false))}
                >
                  <SquareArrowOutUpRight aria-hidden data-icon="inline-start" />
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
        onConfirm={() => run(() => setCourseDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function CoursesTable({
  rows,
  trackKeys,
  statusKeys,
  difficultyKeys,
  canDelete,
  labels,
}: {
  rows: CourseRow[];
  trackKeys: string[];
  statusKeys: string[];
  difficultyKeys: string[];
  canDelete: boolean;
  labels: CoursesTableLabels;
}) {
  const [filters, setFilters] = useState<CoursesFilterState>({
    track: "",
    status: "",
    difficulty: "",
  });

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filters.track === "" || row.track === filters.track) &&
          (filters.status === "" || row.status === filters.status) &&
          (filters.difficulty === "" || row.difficulty === filters.difficulty),
      ),
    [rows, filters],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title} ${row.slug} ${row.trackLabel}`,
    sortValues: {
      title: (row) => row.title,
      status: (row) => row.status,
      lessons: (row) => row.lessonCount,
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

  const columns = useMemo<ColumnDef<CourseRow>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className={`flex max-w-72 flex-col ${row.original.deleted ? "opacity-60" : ""}`}>
            <Link
              href={`/admin/learn/courses/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.title || labels.untitled}
            </Link>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {row.original.slug && <span className="truncate">/{row.original.slug}</span>}
              {row.original.isExternal && (
                <Badge variant="outline" className="text-xs">
                  {labels.externalBadge}
                </Badge>
              )}
              {row.original.deleted && <Badge variant="danger">{labels.deleted}</Badge>}
            </span>
          </div>
        ),
      },
      {
        id: "track",
        header: labels.trackCol,
        meta: { label: labels.trackCol },
        enableSorting: false,
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
        id: "difficulty",
        header: labels.difficultyCol,
        meta: { label: labels.difficultyCol },
        enableSorting: false,
        cell: ({ row }) => <span className="text-sm">{row.original.difficultyLabel}</span>,
      },
      {
        id: "visibility",
        header: labels.visibilityCol,
        meta: { label: labels.visibilityCol },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.visibilityLabel}</span>
        ),
      },
      {
        id: "sections",
        header: labels.sectionsCol,
        meta: { label: labels.sectionsCol },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.sectionCount}</span>
        ),
      },
      {
        // The DENORMALISED published-lesson count, not the row count — it is
        // what /learn shows a visitor, so a mismatch here is the symptom of a
        // recount bug rather than a cosmetic difference.
        id: "lessons",
        header: labels.lessonsCol,
        meta: { label: labels.lessonsCol },
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.lessonCount}</span>,
      },
      {
        id: "updatedAt",
        header: labels.updatedCol,
        meta: { label: labels.updatedCol },
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.updatedAtLabel}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <RowActions row={row.original} canDelete={canDelete} labels={labels} />,
      },
    ],
    [labels, canDelete],
  );

  return (
    <DataTable
      columns={columns}
      labels={tableLabels}
      getRowId={(row) => row.id}
      {...tableProps}
      filters={
        <CoursesToolbar
          trackKeys={trackKeys}
          statusKeys={statusKeys}
          difficultyKeys={difficultyKeys}
          value={filters}
          onChange={setFilters}
          labels={labels}
        />
      }
      emptyState={
        <Empty className="border-none">
          <EmptyMedia>
            <GraduationCap aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.noResults}</EmptyDescription>
        </Empty>
      }
    />
  );
}
