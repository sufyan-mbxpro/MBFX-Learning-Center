"use client";

// The subscriber list (ADR-080 #7).
//
// **Not `useClientTable`**, for the delivery log's reason: the list grows
// without bound and arrives one keyset page at a time, so a filter has to be a
// REQUEST rather than a predicate over the page in hand — otherwise filtering
// 50 rows to none reads as "no subscribers". "Load more" follows `nextCursor`
// because a keyset cursor cannot say how many pages are behind it.
//
// **Two row actions, and the destructive one is not the obvious one.**
// Unsubscribe is reversible and is what an admin almost always wants; Delete
// is a HARD erase, because an erasure request is not satisfied by a
// `deletedAt` (ADR-080 #7). Both confirm (ADR-044 #7), and the delete's
// description says which of the two the reader is about to do.
import * as React from "react";
import { MailX, MoreHorizontal, Trash2, UserMinus } from "lucide-react";
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
import { useSearchParams } from "next/navigation";
import {
  deleteSubscriberAction,
  unsubscribeSubscriberAction,
} from "../_actions/newsletter-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { StatusBadge, type StatusTone } from "../_components/status-badge.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";

export interface SubscriberTableRow {
  id: string;
  email: string;
  status: string;
  source: string;
  locale: string;
  hasAccount: boolean;
  createdAtLabel: string;
}

export interface SubscribersLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  emailCol: string;
  statusCol: string;
  sourceCol: string;
  localeCol: string;
  accountCol: string;
  signedUpCol: string;
  actionsCol: string;
  accountLinked: string;
  accountNone: string;
  statusActive: string;
  statusPending: string;
  statusUnsubscribed: string;
  statusLabel: string;
  allStatuses: string;
  sourceLabel: string;
  allSources: string;
  clear: string;
  loadMore: string;
  emptyTitle: string;
  emptyBody: string;
  emptyFilteredTitle: string;
  emptyFilteredBody: string;
  exportCsv: string;
  unsubscribeAction: string;
  unsubscribeTitle: string;
  unsubscribeBody: string;
  unsubscribeConfirm: string;
  unsubscribedToast: string;
  deleteAction: string;
  deleteTitle: string;
  deleteBody: string;
  deleteConfirm: string;
  deletedToast: string;
  cancel: string;
  saveFailed: string;
}

/** The table's controlled props it does not get to drive here. */
const EMPTY_SORTING: never[] = [];
const noop = () => {};

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  // PENDING is not a failure — it is double opt-in working — so it is a
  // waiting tone rather than a destructive one.
  PENDING: "warning",
  UNSUBSCRIBED: "neutral",
};

function RowActions({ row, labels }: { row: SubscriberTableRow; labels: SubscribersLabels }) {
  const { run } = useServerAction();
  const [confirmUnsubscribe, setConfirmUnsubscribe] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={labels.actionsCol}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            // Already unsubscribed: the action is a no-op in core, and
            // offering it would suggest something is left to do.
            disabled={row.status === "UNSUBSCRIBED"}
            onClick={() => setConfirmUnsubscribe(true)}
          >
            <UserMinus aria-hidden />
            {labels.unsubscribeAction}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />
            {labels.deleteAction}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmUnsubscribe}
        onOpenChange={setConfirmUnsubscribe}
        title={labels.unsubscribeTitle}
        description={labels.unsubscribeBody}
        confirmLabel={labels.unsubscribeConfirm}
        cancelLabel={labels.cancel}
        onConfirm={() =>
          run(() => unsubscribeSubscriberAction({ id: row.id }), {
            successMessage: labels.unsubscribedToast,
            onDone: () => setConfirmUnsubscribe(false),
          })
        }
      />

      {/* `destructive` on this one only. The erase has no undo — that is what
          an erasure request means — and the description says so rather than
          leaving the two actions looking interchangeable. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        confirmLabel={labels.deleteConfirm}
        cancelLabel={labels.cancel}
        destructive
        onConfirm={() =>
          run(() => deleteSubscriberAction({ id: row.id }), {
            successMessage: labels.deletedToast,
            onDone: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}

export function SubscribersTable({
  rows,
  nextCursor,
  sources,
  canManage,
  canExport,
  labels,
}: {
  rows: SubscriberTableRow[];
  nextCursor: string | null;
  sources: { value: string; label: string }[];
  canManage: boolean;
  canExport: boolean;
  labels: SubscribersLabels;
}) {
  const setParams = useUrlFilters();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const source = params.get("source") ?? "";
  const query = params.get("q") ?? "";
  const filtered = Boolean(status || source || query);

  const statusLabel = React.useCallback(
    (value: string) =>
      value === "ACTIVE"
        ? labels.statusActive
        : value === "PENDING"
          ? labels.statusPending
          : labels.statusUnsubscribed,
    [labels],
  );

  const columns = React.useMemo<ColumnDef<SubscriberTableRow>[]>(() => {
    const base: ColumnDef<SubscriberTableRow>[] = [
      {
        id: "email",
        header: labels.emailCol,
        meta: { label: labels.emailCol },
        enableHiding: false,
        cell: ({ row }) => (
          <span className="block max-w-80 truncate font-medium">{row.original.email}</span>
        ),
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
            {statusLabel(row.original.status)}
          </StatusBadge>
        ),
      },
      {
        id: "source",
        header: labels.sourceCol,
        meta: { label: labels.sourceCol },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {sources.find((entry) => entry.value === row.original.source)?.label ??
              row.original.source}
          </span>
        ),
      },
      {
        id: "locale",
        header: labels.localeCol,
        meta: { label: labels.localeCol },
        cell: ({ row }) => (
          <span className="text-3xs text-muted-foreground uppercase">{row.original.locale}</span>
        ),
      },
      {
        id: "account",
        header: labels.accountCol,
        meta: { label: labels.accountCol },
        // Whether the consent is linked to a user, not WHICH user: the link
        // exists for erasure and future audience filtering (ADR-080 #6), and
        // a name here would turn a consent list into a user directory.
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.hasAccount ? labels.accountLinked : labels.accountNone}
          </span>
        ),
      },
      {
        id: "signedUp",
        header: labels.signedUpCol,
        meta: { label: labels.signedUpCol },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.createdAtLabel}
          </span>
        ),
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableHiding: false,
        cell: ({ row }) => <RowActions row={row.original} labels={labels} />,
      });
    }
    return base;
  }, [labels, sources, statusLabel, canManage]);

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

  // Filters sit in the table's own toolbar beside its search box
  // (code-style #9), each declaring its width — which is how a toolbar filter
  // says it is not a form field (ADR-057).
  const filters = (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.statusLabel}
        className="w-44"
        value={status}
        onValueChange={(value) => setParams({ status: value, cursor: null })}
        options={[
          { value: "", label: labels.allStatuses },
          { value: "ACTIVE", label: labels.statusActive },
          { value: "PENDING", label: labels.statusPending },
          { value: "UNSUBSCRIBED", label: labels.statusUnsubscribed },
        ]}
      />
      <AdminCombobox
        aria-label={labels.sourceLabel}
        className="w-40"
        value={source}
        onValueChange={(value) => setParams({ source: value, cursor: null })}
        options={[{ value: "", label: labels.allSources }, ...sources]}
      />
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParams({ status: null, source: null, q: null, cursor: null })}
        >
          {labels.clear}
        </Button>
      )}
      {canExport && (
        // A real link, not an action: the export streams, and a server action
        // would have to buffer the whole CSV into a response value to hand it
        // back. The href carries the CURRENT filters, so "export" means "what
        // I am looking at".
        <Button
          variant="outline"
          size="sm"
          render={<a href={`/admin/api/newsletter/export?${params.toString()}`} />}
        >
          {labels.exportCsv}
        </Button>
      )}
    </FilterBarRow>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* The table renders even with no rows, because the filters live in its
          toolbar: an empty state that replaced the table would take the search
          box with it, leaving whoever filtered to nothing no way back. */}
      <DataTable
        data={rows}
        columns={columns}
        labels={tableLabels}
        // One server page, already filtered and ordered by the service.
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: Math.max(rows.length, 1) }}
        onPaginationChange={noop}
        sorting={EMPTY_SORTING}
        onSortingChange={noop}
        globalFilter={query}
        onGlobalFilterChange={(value) => setParams({ q: value, cursor: null })}
        filters={filters}
        emptyState={
          <Empty>
            <EmptyMedia>
              <MailX aria-hidden />
            </EmptyMedia>
            {/* Two empty states, because they call for different actions: an
                empty LIST is waiting for a first signup, an empty FILTER is
                waiting for the reader to widen it. */}
            <EmptyTitle>{filtered ? labels.emptyFilteredTitle : labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {filtered ? labels.emptyFilteredBody : labels.emptyBody}
            </EmptyDescription>
          </Empty>
        }
      />
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setParams({ cursor: nextCursor })}>
            {labels.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
