"use client";

// Articles on the shared DataTable — SERVER-driven end to end like the
// users table: search / sort / page state lives in the URL, the server
// component re-queries, this component renders what it was handed. The
// former inline button row is now a per-row actions menu; the quick
// active toggle stays inline.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileX,
  MoreHorizontal,
  Newspaper,
  Pencil,
  SquareArrowOutUpRight,
  Star,
  Trash2,
} from "lucide-react";
import type { ColumnDef, SortingState, PaginationState, Updater } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Switch } from "@repo/ui/components/switch";
import {
  duplicateArticleAction,
  setArticleActiveAction,
  setArticleDeletedAction,
  setArticleFeaturedAction,
  transitionArticleAction,
} from "../_actions/article-actions.ts";
import { QuickEditDialog, type QuickEditLabels } from "./[id]/quick-edit-dialog.tsx";
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
  isFeatured: boolean;
  legalTransitions: string[];
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
  editGroup: string;
  statusGroup: string;
  quickEdit: string;
  fullEditor: string;
  setAsDraft: string;
  setFeatured: string;
  unsetFeatured: string;
  viewPost: string;
  featuredCol: string;
  quick: QuickEditLabels;
}

function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

function RowActions({
  row,
  categories,
  canCreate,
  canDelete,
  labels,
}: {
  row: ArticleRow;
  categories: { id: string; name: string }[];
  canCreate: boolean;
  canDelete: boolean;
  labels: ArticlesTableLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  // The reference's colour coding maps onto the existing semantic tokens —
  // amber for "unpublish", info-blue for "view", destructive for delete. No
  // literals (code-style.md #1).
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
          <DropdownMenuGroup>
            <DropdownMenuLabel>{labels.editGroup}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setQuickOpen(true)}>
              <Pencil data-icon="inline-start" aria-hidden />
              {labels.quickEdit}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link href={`/admin/articles/${row.id}`}>
                  <SquareArrowOutUpRight data-icon="inline-start" aria-hidden />
                  {labels.fullEditor}
                </Link>
              }
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
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{labels.statusGroup}</DropdownMenuLabel>
            {/* Only offered when the transition is actually legal — the map,
                not a guess (ADR-015 #4). The service re-checks the publish
                permission regardless. */}
            {row.legalTransitions.includes("DRAFT") && (
              <DropdownMenuItem onClick={() => run(() => transitionArticleAction(row.id, "DRAFT"))}>
                <FileX data-icon="inline-start" aria-hidden className="text-warning-interactive" />
                <span className="text-warning-interactive">{labels.setAsDraft}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => run(() => setArticleFeaturedAction(row.id, !row.isFeatured))}
            >
              <Star data-icon="inline-start" aria-hidden />
              {row.isFeatured ? labels.unsetFeatured : labels.setFeatured}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          {row.slug && (
            <DropdownMenuItem
              render={
                <a href={`/news/${row.slug}`} target="_blank" rel="noreferrer">
                  <Eye data-icon="inline-start" aria-hidden className="text-info-interactive" />
                  <span className="text-info-interactive">{labels.viewPost}</span>
                </a>
              }
            />
          )}
          {canDelete &&
            (row.deleted ? (
              <DropdownMenuItem onClick={() => run(() => setArticleDeletedAction(row.id, false))}>
                {labels.restore}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2 data-icon="inline-start" aria-hidden />
                {labels.softDelete}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <QuickEditDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        row={row}
        categories={categories}
        labels={labels.quick}
        onSaved={() => router.refresh()}
      />

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
  categories,
  pageCount,
  page,
  pageSize,
  sortBy,
  sortDir,
  search,
  canCreate,
  canDelete,
  filters,
  labels,
}: {
  rows: ArticleRow[];
  categories: { id: string; name: string }[];
  pageCount: number;
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  search: string;
  canCreate: boolean;
  canDelete: boolean;
  /** Kind / status / category Selects — rendered in the DataTable's own
   * toolbar so they share one row with the search box (changes-08 #7). */
  filters?: React.ReactNode;
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
              {row.original.slug && <span className="truncate">/{row.original.slug}</span>}
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
        id: "featured",
        header: labels.featuredCol,
        meta: { label: labels.featuredCol },
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.isFeatured}
            aria-label={labels.featuredCol}
            onCheckedChange={(checked) =>
              run(() => setArticleFeaturedAction(row.original.id, checked === true))
            }
          />
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
            categories={categories}
            canCreate={canCreate}
            canDelete={canDelete}
            labels={labels}
          />
        ),
      },
    ],
    [labels, categories, canCreate, canDelete, run],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      labels={tableLabels}
      filters={filters}
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
