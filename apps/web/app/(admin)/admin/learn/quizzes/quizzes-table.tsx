"use client";

// The quiz list (changes-11 Phase 6, ADR-058).
//
// Its distinctive column is **Used by**: a quiz is standalone by nature and
// consumers point at it (ADR-058 #1), so "what breaks if I delete this" is not
// visible from the quiz itself the way it is for a lesson inside a course.
// The count answers it before the confirm dialog has to.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CircleHelp, Copy, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
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
import { duplicateQuizAction, setQuizDeletedAction } from "../../_actions/quiz-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { FilterBar } from "../../_components/filter-bar.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
  type StatusTone,
} from "../../_components/status-badge.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

/**
 * The tones a free-text category is drawn from.
 *
 * `Quiz.category` is free text with no registry to enumerate, so the colour is
 * DERIVED rather than looked up — the public quiz shelf's `categoryTone()`
 * makes exactly the same call. Four entries in the same order as its
 * `CATEGORY_TONES`, so `pickByHash` lands a given category on the same slot on
 * both surfaces and "Crypto Basics" is one colour across the whole product.
 * The public list's fourth tone is `eyebrow`, which the admin scale spells
 * `neutral`; the other three are the same words.
 */
const CATEGORY_TONES = [
  "info",
  "success",
  "warning",
  "neutral",
] as const satisfies readonly StatusTone[];

export interface QuizRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  statusLabel: string;
  /** Reachable by a guest right now: `publicQuizWhere()` in @repo/core, which
   * is PUBLISHED **and** visibility PUBLIC. A published-but-restricted quiz
   * reads as live in the status column while nobody can open it. */
  isActive: boolean;
  isStandalone: boolean;
  categoryLabel: string | null;
  questionCount: number;
  attemptCount: number;
  usageLabel: string;
  usageCount: number;
  deleted: boolean;
  updatedAtLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  updatedAtSort: number;
}

export interface QuizzesTableLabels {
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
  statusCol: string;
  questionsCol: string;
  attemptsCol: string;
  usageCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
  standalone: string;
  deleted: string;
  activeCol: string;
  active: string;
  inactive: string;
  duplicate: string;
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
  statuses: Record<string, string>;
}

function RowActions({
  row,
  canCreate,
  canDelete,
  labels,
}: {
  row: QuizRow;
  canCreate: boolean;
  canDelete: boolean;
  labels: QuizzesTableLabels;
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
          <DropdownMenuItem render={<Link href={`/admin/learn/quizzes/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>
          {canCreate && (
            // Navigates to the copy rather than staying put: the copy is a
            // DRAFT titled "… (copy)" that needs editing before it is worth
            // anything, and a duplicate that only refreshes the list leaves
            // the editor hunting for the row it just made. `duplicateArticle`
            // and `duplicateLesson` both do this.
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await duplicateQuizAction(row.id);
                  router.push(`/admin/learn/quizzes/${id}`);
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
                  onClick={() => run(() => setQuizDeletedAction(row.id, false))}
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
        onConfirm={() => run(() => setQuizDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function QuizzesTable({
  rows,
  statusKeys,
  canCreate,
  canDelete,
  labels,
}: {
  rows: QuizRow[];
  statusKeys: string[];
  canCreate: boolean;
  canDelete: boolean;
  labels: QuizzesTableLabels;
}) {
  const [status, setStatus] = useState("");

  const visible = useMemo(
    () => rows.filter((row) => status === "" || row.status === status),
    [rows, status],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title} ${row.slug} ${row.categoryLabel ?? ""}`,
    sortValues: {
      title: (row) => row.title,
      status: (row) => row.status,
      questions: (row) => row.questionCount,
      attempts: (row) => row.attemptCount,
      usage: (row) => row.usageCount,
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

  const columns = useMemo<ColumnDef<QuizRow>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-1">
            <Link
              href={`/admin/learn/quizzes/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.title || labels.untitled}
            </Link>
            {/* Three badges that used to be three identical outlines, so the
                row read as grey noise and none of them said anything at a
                glance. Each now carries its own meaning: listing is a fact
                about placement (info), a category is a label made
                distinguishable by `pickByHash` — the SAME derivation the
                public quiz card uses, so one category is one colour on both
                surfaces — and a deleted row is destructive. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {row.original.isStandalone && (
                <StatusBadge tone="info">{labels.standalone}</StatusBadge>
              )}
              {row.original.categoryLabel && (
                <StatusBadge tone={pickByHash(row.original.categoryLabel, CATEGORY_TONES)}>
                  {row.original.categoryLabel}
                </StatusBadge>
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
        // Separate from Status on purpose: status is where a quiz sits in the
        // review machine, and this is whether a learner can actually open it.
        // They disagree exactly when a PUBLISHED quiz is not visibility PUBLIC,
        // which is the case an editor cannot otherwise see from this screen.
        id: "active",
        header: labels.activeCol,
        meta: { label: labels.activeCol },
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "neutral"}>
            {row.original.isActive ? labels.active : labels.inactive}
          </StatusBadge>
        ),
      },
      {
        id: "questions",
        header: labels.questionsCol,
        meta: { label: labels.questionsCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.questionCount}</span>,
      },
      {
        id: "attempts",
        header: labels.attemptsCol,
        meta: { label: labels.attemptsCol },
        cell: ({ row }) => <span className="tabular-nums">{row.original.attemptCount}</span>,
      },
      {
        id: "usage",
        header: labels.usageCol,
        meta: { label: labels.usageCol },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.usageLabel}</span>,
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
          <CircleHelp aria-hidden className="size-6 text-muted-foreground" />
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
        </FilterBar>
      }
    />
  );
}
