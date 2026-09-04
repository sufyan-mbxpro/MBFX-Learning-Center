"use client";

// Articles on the shared DataTable — SERVER-driven end to end like the
// users table: search / sort / page state lives in the URL, the server
// component re-queries, this component renders what it was handed. The
// former inline button row is now a per-row actions menu; the quick
// active toggle stays inline.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Newspaper } from "lucide-react";
import type { ColumnDef, SortingState, PaginationState, Updater } from "@tanstack/react-table";
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
import { Switch } from "@repo/ui/components/switch";
import {
  duplicateArticleAction,
  setArticleActiveAction,
  setArticleDeletedAction,
} from "../_actions/article-actions.ts";
import { ARTICLE_STATUS_TONE, StatusBadge, statusTone } from "../_components/status-badge.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";

export interface ArticleRow {
  id: string;
  title: string | null;
  slug: string | null;
  deleted: boolean;
  kindLabel: string;
  categoryName: string | null;
  status: string;
  statusLabel: string;
  scheduledForLabel: string | null;
  isActive: boolean;
  publishedAtLabel: string | null;
  updatedAtLabel: string;
}

// Plain strings only — this crosses the RSC boundary, so the function-
// valued DataTableLabels entries are constructed client-side below.
export interface ArticlesTableLabels {
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
  kindCol: string;
  categoryCol: string;
  statusCol: string;
  activeCol: string;
  publishedCol: string;
  updatedCol: string;
  actionsCol: string;
  untitled: string;
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
}

function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

function RowActions({
  row,
  canCreate,
  canDelete,
  labels,
}: {
  row: ArticleRow;
  canCreate: boolean;
  canDelete: boolean;
  labels: ArticlesTableLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.openActions}
              disabled={pending}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/admin/articles/${row.id}`}>{labels.edit}</Link>}
          />
          {canCreate && (
            <DropdownMenuItem
              onClick={() =>
                run(async () => {
                  const id = await duplicateArticleAction(row.id);
                  router.push(`/admin/articles/${id}`);
                })
              }
            >
              {labels.duplicate}
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuSeparator />}
          {canDelete &&
            (row.deleted ? (
              <DropdownMenuItem onClick={() => run(() => setArticleDeletedAction(row.id, false))}>
                {labels.restore}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                {labels.softDelete}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={async () => {
          await setArticleDeletedAction(row.id, true);
          router.refresh();
        }}
      />
    </div>
  );
}

export function ArticlesTable({
  rows,
  pageCount,
  page,
  pageSize,
  sortBy,
  sortDir,
  search,
  canCreate,
  canDelete,
  labels,
}: {
  rows: ArticleRow[];
  pageCount: number;
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  search: string;
  canCreate: boolean;
  canDelete: boolean;
  labels: ArticlesTableLabels;
}) {
  const setParams = useUrlFilters();
  const { run } = useServerAction();

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

  const sorting: SortingState = useMemo(
    () => (sortBy ? [{ id: sortBy, desc: sortDir === "desc" }] : []),
    [sortBy, sortDir],
  );
  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: page, pageSize }),
    [page, pageSize],
  );

  const columns = useMemo<ColumnDef<ArticleRow>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className={`flex max-w-72 flex-col ${row.original.deleted ? "opacity-60" : ""}`}>
            <Link
              href={`/admin/articles/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.title ?? labels.untitled}
            </Link>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {row.original.slug && <code className="truncate">/{row.original.slug}</code>}
              {row.original.deleted && (
                <Badge variant="destructive" className="text-xs">
                  {labels.deleted}
                </Badge>
              )}
            </span>
          </div>
        ),
      },
      {
        id: "kind",
        header: labels.kindCol,
        meta: { label: labels.kindCol },
        enableSorting: false,
        cell: ({ row }) => <Badge variant="outline">{row.original.kindLabel}</Badge>,
      },
      {
        id: "category",
        header: labels.categoryCol,
        meta: { label: labels.categoryCol },
        enableSorting: false,
        cell: ({ row }) => <span className="text-sm">{row.original.categoryName ?? "—"}</span>,
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <StatusBadge tone={statusTone(ARTICLE_STATUS_TONE, row.original.status)}>
              {row.original.statusLabel}
            </StatusBadge>
            {row.original.scheduledForLabel && (
              <span className="text-xs text-muted-foreground">
                {row.original.scheduledForLabel}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "active",
        header: labels.activeCol,
        meta: { label: labels.activeCol },
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            aria-label={labels.activeCol}
            onCheckedChange={(checked) =>
              run(() => setArticleActiveAction(row.original.id, checked === true))
            }
          />
        ),
      },
      {
        id: "publishedAt",
        header: labels.publishedCol,
        meta: { label: labels.publishedCol },
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.publishedAtLabel ?? "—"}
          </span>
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
    [labels, canCreate, canDelete, run],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={tableLabels}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={(updater) => {
        const next = apply(updater, pagination);
        setParams({ page: next.pageIndex > 0 ? String(next.pageIndex) : null });
      }}
      sorting={sorting}
      onSortingChange={(updater) => {
        const next = apply(updater, sorting);
        const first = next[0];
        setParams({
          sortBy: first?.id ?? null,
          sortDir: first ? (first.desc ? "desc" : "asc") : null,
        });
      }}
      globalFilter={search}
      onGlobalFilterChange={(value) => setParams({ q: value || null })}
      getRowId={(row) => row.id}
      emptyState={
        <Empty className="border-none">
          <EmptyMedia>
            <Newspaper aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.noResults}</EmptyDescription>
        </Empty>
      }
    />
  );
}
