"use client";

// The delivery log's table.
//
// **Not `useClientTable`.** Every other small admin list loads in full and
// filters locally; this one cannot. The log grows without bound until the
// 90-day sweep, so it arrives one keyset page at a time (ADR-067's shape), and
// a filter therefore has to be a REQUEST, not a predicate over the page in
// hand — otherwise filtering 50 rows to none would read as "no deliveries".
//
// That also decides paging: "Load more" follows `nextCursor` instead of a page
// count, because a keyset cursor cannot say how many pages are behind it and a
// page number over an append-only table would drift while someone reads it.
import * as React from "react";
import { MailX } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { StatusBadge, type StatusTone } from "../../../_components/status-badge.tsx";
import { useUrlFilters } from "../../../_hooks/use-url-filters.ts";
import { useSearchParams } from "next/navigation";

export interface DeliveryLogRow {
  id: string;
  templateKey: string;
  to: string;
  locale: string;
  subject: string;
  status: string;
  reason: string | null;
  isTest: boolean;
  sentAtLabel: string;
}

export interface DeliveryLogLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  timeCol: string;
  templateCol: string;
  recipientCol: string;
  statusCol: string;
  reasonCol: string;
  actionsCol: string;
  statusSent: string;
  statusFailed: string;
  statusSuppressed: string;
  testBadge: string;
  allStatuses: string;
  statusLabel: string;
  allTemplates: string;
  templateLabel: string;
  emptyTitle: string;
  emptyBody: string;
  clear: string;
  loadMore: string;
}

/** The table's controlled props it does not get to drive here. */
const EMPTY_SORTING: never[] = [];
const noop = () => {};

const STATUS_TONE: Record<string, StatusTone> = {
  SENT: "success",
  // A FAILED row is a real failure an admin has to act on, so it takes the
  // solid destructive badge; SUPPRESSED is a switch doing its job.
  FAILED: "destructive",
  SUPPRESSED: "neutral",
};

export function DeliveryLogTable({
  rows,
  nextCursor,
  templates,
  labels,
}: {
  rows: DeliveryLogRow[];
  nextCursor: string | null;
  templates: { value: string; label: string }[];
  labels: DeliveryLogLabels;
}) {
  const setParams = useUrlFilters();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const template = params.get("template") ?? "";
  const query = params.get("q") ?? "";

  const statusLabel = React.useCallback(
    (value: string) =>
      value === "SENT"
        ? labels.statusSent
        : value === "FAILED"
          ? labels.statusFailed
          : labels.statusSuppressed,
    [labels],
  );

  const columns = React.useMemo<ColumnDef<DeliveryLogRow>[]>(
    () => [
      {
        id: "sentAt",
        header: labels.timeCol,
        meta: { label: labels.timeCol },
        enableHiding: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{row.original.sentAtLabel}</span>
        ),
      },
      {
        id: "recipient",
        header: labels.recipientCol,
        meta: { label: labels.recipientCol },
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-0.5">
            <span className="truncate font-medium">{row.original.to}</span>
            {/* The SUBJECT, which is the closest the log comes to content — and
                deliberately the only part of the message it holds. */}
            <span className="truncate text-xs text-muted-foreground">{row.original.subject}</span>
          </div>
        ),
      },
      {
        id: "template",
        header: labels.templateCol,
        meta: { label: labels.templateCol },
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {templates.find((entry) => entry.value === row.original.templateKey)?.label ??
                row.original.templateKey}
            </span>
            <span className="text-3xs text-muted-foreground uppercase">{row.original.locale}</span>
            {row.original.isTest && <StatusBadge tone="info">{labels.testBadge}</StatusBadge>}
          </div>
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
        id: "reason",
        header: labels.reasonCol,
        meta: { label: labels.reasonCol },
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-80 text-xs text-muted-foreground">
            {row.original.reason ?? ""}
          </span>
        ),
      },
    ],
    [labels, templates, statusLabel],
  );

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

  // The search box is the DataTable's own (debounced, in the toolbar), so these
  // are the remaining filters — they render beside it rather than above it
  // (code-style #9).
  const filters = (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.statusLabel}
        className="w-40"
        value={status}
        onValueChange={(value) => setParams({ status: value, cursor: null })}
        options={[
          { value: "", label: labels.allStatuses },
          { value: "SENT", label: labels.statusSent },
          { value: "FAILED", label: labels.statusFailed },
          { value: "SUPPRESSED", label: labels.statusSuppressed },
        ]}
      />
      <AdminCombobox
        aria-label={labels.templateLabel}
        className="w-56"
        value={template}
        onValueChange={(value) => setParams({ template: value, cursor: null })}
        options={[{ value: "", label: labels.allTemplates }, ...templates]}
      />
      {(status || template || query) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParams({ status: null, template: null, q: null, cursor: null })}
        >
          {labels.clear}
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
        // One server page, already filtered and ordered by the service. The
        // table's own pagination shows a single page because a keyset cursor
        // cannot say how many are behind it — "Load more" below is the paging.
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: Math.max(rows.length, 1) }}
        onPaginationChange={noop}
        // Ordering is the service's `createdAt desc, id desc`, and the cursor is
        // derived from it — a client re-sort would break the next page.
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
            <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>{labels.emptyBody}</EmptyDescription>
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
