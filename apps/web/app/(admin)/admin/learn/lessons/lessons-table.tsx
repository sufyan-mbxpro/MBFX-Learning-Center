"use client";

// The FLAT lesson list (plan §8.1) — every lesson across every course, on the
// shared DataTable, driven client-side by useClientTable.
//
// Its reason for existing beside the course builder's curriculum tab is the
// OUTDATED queue: a translation goes stale when its source locale changes, and
// finding those by opening each course in turn is not a workflow. The
// "Outdated translations only" filter is the whole point of the screen.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ListChecks, MoreHorizontal, Pencil, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import { Label } from "@repo/ui/components/label";
import { duplicateLessonAction, setLessonDeletedAction } from "../../_actions/learn-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { FilterBar } from "../../_components/filter-bar.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  TRANSLATION_STATUS_TONE,
  statusTone,
} from "../../_components/status-badge.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface LessonLocaleChip {
  locale: string;
  translationStatus: string;
  translationStatusLabel: string;
}

export interface LessonRow {
  id: string;
  title: string;
  slug: string;
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  status: string;
  statusLabel: string;
  kindLabels: string[];
  estimatedMinutes: number | null;
  isOutdated: boolean;
  locales: LessonLocaleChip[];
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
}

export interface LessonsTableLabels {
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
  courseCol: string;
  sectionCol: string;
  statusCol: string;
  localesCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  edit: string;
  duplicate: string;
  softDelete: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  openActions: string;
  emptyTitle: string;
  allCourses: string;
  allStatuses: string;
  courseLabel: string;
  statusLabel: string;
  outdatedOnly: string;
  minutesLabel: string;
  statuses: Record<string, string>;
}

interface LessonFilterState {
  courseId: string;
  status: string;
  outdatedOnly: boolean;
}

function RowActions({
  row,
  canCreate,
  canDelete,
  labels,
}: {
  row: LessonRow;
  canCreate: boolean;
  canDelete: boolean;
  labels: LessonsTableLabels;
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
          <DropdownMenuItem render={<Link href={`/admin/learn/lessons/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem
              disabled={pending}
              onClick={() => run(() => duplicateLessonAction(row.id))}
            >
              <SquareArrowOutUpRight aria-hidden data-icon="inline-start" />
              {labels.duplicate}
            </DropdownMenuItem>
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
                {labels.softDelete}
              </DropdownMenuItem>
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
        onConfirm={() => run(() => setLessonDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function LessonsTable({
  rows,
  courses,
  statusKeys,
  canCreate,
  canDelete,
  labels,
}: {
  rows: LessonRow[];
  courses: { id: string; title: string }[];
  statusKeys: string[];
  canCreate: boolean;
  canDelete: boolean;
  labels: LessonsTableLabels;
}) {
  const [filters, setFilters] = useState<LessonFilterState>({
    courseId: "",
    status: "",
    outdatedOnly: false,
  });

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filters.courseId === "" || row.courseId === filters.courseId) &&
          (filters.status === "" || row.status === filters.status) &&
          (!filters.outdatedOnly || row.isOutdated),
      ),
    [rows, filters],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title} ${row.slug} ${row.courseTitle} ${row.sectionTitle}`,
    sortValues: {
      title: (row) => row.title,
      course: (row) => row.courseTitle,
      status: (row) => row.status,
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

  const columns = useMemo<ColumnDef<LessonRow>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col">
            <Link
              href={`/admin/learn/lessons/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.title || labels.untitled}
            </Link>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {row.original.slug && <span className="truncate">/{row.original.slug}</span>}
              {row.original.kindLabels.map((kind) => (
                <Badge key={kind} variant="outline" className="text-xs">
                  {kind}
                </Badge>
              ))}
              {row.original.estimatedMinutes !== null && (
                <span className="tabular-nums">
                  {row.original.estimatedMinutes} {labels.minutesLabel}
                </span>
              )}
            </span>
          </div>
        ),
      },
      {
        id: "course",
        header: labels.courseCol,
        meta: { label: labels.courseCol },
        cell: ({ row }) => (
          <div className="flex max-w-56 flex-col">
            <Link
              href={`/admin/learn/courses/${row.original.courseId}`}
              className="truncate text-sm hover:underline"
            >
              {row.original.courseTitle || labels.untitled}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.sectionTitle}
            </span>
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
        // One chip per locale, toned by translation status — this column IS
        // the OUTDATED queue: a stale locale reads amber at a glance.
        id: "locales",
        header: labels.localesCol,
        meta: { label: labels.localesCol },
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.locales.map((chip) => (
              <StatusBadge
                key={chip.locale}
                tone={statusTone(TRANSLATION_STATUS_TONE, chip.translationStatus)}
              >
                <span className="uppercase">{chip.locale}</span>
                <span className="sr-only"> — {chip.translationStatusLabel}</span>
              </StatusBadge>
            ))}
          </div>
        ),
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

  return (
    <DataTable
      columns={columns}
      labels={tableLabels}
      getRowId={(row) => row.id}
      {...tableProps}
      filters={
        <FilterBar>
          <AdminCombobox
            aria-label={labels.courseLabel}
            className="w-44"
            value={filters.courseId}
            onValueChange={(courseId) => setFilters({ ...filters, courseId })}
            options={[
              { value: "", label: labels.allCourses },
              ...courses.map((course) => ({
                value: course.id,
                label: course.title || labels.untitled,
              })),
            ]}
          />

          <AdminCombobox
            aria-label={labels.statusLabel}
            className="w-40"
            value={filters.status}
            onValueChange={(status) => setFilters({ ...filters, status })}
            options={[
              { value: "", label: labels.allStatuses },
              ...statusKeys.map((key) => ({
                value: key,
                label: labels.statuses[key] ?? key,
              })),
            ]}
          />

          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={filters.outdatedOnly}
              onCheckedChange={(checked) =>
                setFilters({ ...filters, outdatedOnly: checked === true })
              }
            />
            {labels.outdatedOnly}
          </Label>
        </FilterBar>
      }
      emptyState={
        <Empty className="border-none">
          <EmptyMedia>
            <ListChecks aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.noResults}</EmptyDescription>
        </Empty>
      }
    />
  );
}
