"use client";

// The recent-calls table.
//
// `delivery-log-table.tsx`'s shape, for the same reason it has that shape: the
// log grows without bound until the 90-day sweep, so it arrives one keyset page
// at a time and a filter has to be a REQUEST rather than a predicate over the
// page in hand — otherwise filtering 50 rows to none reads as "no calls".
//
// **There is no prompt column and no output column**, and the description above
// the table says so in one line. That is the log's design, not an omission
// (ADR-097 #7): a log holding bodies is a second copy of unpublished drafts,
// under a different gate with a different retention.
import * as React from "react";
import { Sparkles } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { AdminCombobox } from "../_components/combobox.tsx";
import { StatusBadge, type StatusTone } from "../_components/status-badge.tsx";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";
import { useSearchParams } from "next/navigation";

export interface AiUsageTableRow {
  id: string;
  featureLabel: string;
  modelId: string;
  status: string;
  statusLabel: string;
  reasonLabel: string | null;
  tokensLabel: string;
  costLabel: string;
  durationLabel: string;
  timeLabel: string;
  actorName: string | null;
  entityLabel: string | null;
}

export interface AiUsageTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  colTime: string;
  colFeature: string;
  colModel: string;
  colStaff: string;
  colTokens: string;
  colCost: string;
  colDuration: string;
  colStatus: string;
  colEntity: string;
  filterFeature: string;
  filterFeatureAll: string;
  filterStatus: string;
  filterStatusAll: string;
  statusOK: string;
  statusFAILED: string;
  statusABORTED: string;
  statusREFUSED: string;
  clear: string;
  loadMore: string;
  emptyTitle: string;
  emptyBody: string;
  noStaff: string;
}

const EMPTY_SORTING: never[] = [];
const noop = () => {};

const STATUS_TONE: Record<string, StatusTone> = {
  OK: "success",
  // A FAILED call cost money and produced nothing, so it takes the solid
  // destructive badge. REFUSED is a switch doing its job — neutral, not an
  // alarm — and ABORTED is somebody closing a tab.
  FAILED: "destructive",
  ABORTED: "neutral",
  REFUSED: "neutral",
};

export function AiUsageTable({
  rows,
  nextCursor,
  features,
  labels,
}: {
  rows: AiUsageTableRow[];
  nextCursor: string | null;
  features: { value: string; label: string }[];
  labels: AiUsageTableLabels;
}) {
  const setParams = useUrlFilters();
  const params = useSearchParams();
  const feature = params.get("feature") ?? "";
  const status = params.get("status") ?? "";

  const columns = React.useMemo<ColumnDef<AiUsageTableRow>[]>(
    () => [
      {
        id: "time",
        header: labels.colTime,
        meta: { label: labels.colTime },
        enableHiding: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{row.original.timeLabel}</span>
        ),
      },
      {
        id: "feature",
        header: labels.colFeature,
        meta: { label: labels.colFeature },
        // ADR-044 #5 — the registry KEY never renders; the card string does.
        cell: ({ row }) => <span className="font-medium">{row.original.featureLabel}</span>,
      },
      {
        id: "model",
        header: labels.colModel,
        meta: { label: labels.colModel },
        cell: ({ row }) => (
          // A model id IS read character by character, which is
          // code-style.md #6's narrow exception to "no monospace in admin
          // chrome" — "claude-haiku-4-5" and "claude-haiku-4-6" differ by one.
          <span className="font-mono text-2xs text-muted-foreground">{row.original.modelId}</span>
        ),
      },
      {
        id: "staff",
        header: labels.colStaff,
        meta: { label: labels.colStaff },
        cell: ({ row }) => row.original.actorName ?? labels.noStaff,
      },
      {
        id: "tokens",
        header: labels.colTokens,
        meta: { label: labels.colTokens },
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">{row.original.tokensLabel}</span>
        ),
      },
      {
        id: "cost",
        header: labels.colCost,
        meta: { label: labels.colCost },
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">{row.original.costLabel}</span>
        ),
      },
      {
        id: "duration",
        header: labels.colDuration,
        meta: { label: labels.colDuration },
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap text-muted-foreground">
            {row.original.durationLabel}
          </span>
        ),
      },
      {
        id: "status",
        header: labels.colStatus,
        meta: { label: labels.colStatus },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <StatusBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
              {row.original.statusLabel}
            </StatusBadge>
            {/* A REFUSED row shows its reason: "why did nothing happen" is the
                question this screen has to answer. */}
            {row.original.reasonLabel && (
              <span className="text-2xs text-muted-foreground">{row.original.reasonLabel}</span>
            )}
          </div>
        ),
      },
      {
        id: "entity",
        header: labels.colEntity,
        meta: { label: labels.colEntity },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.entityLabel ?? "—"}</span>
        ),
      },
    ],
    [labels],
  );

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (count) => `${count} ${labels.selectedSuffix}`,
    page: (page, pageCount) => `${labels.pageWord} ${page} ${labels.ofWord} ${pageCount}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  // ADR-044 #9 — filters live in the table's toolbar, and each declares its own
  // width, which is how a toolbar filter says it is not a form field (ADR-057).
  const filters = (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.filterFeature}
        className="w-56"
        value={feature}
        onValueChange={(value) => setParams({ feature: value, cursor: null })}
        options={[{ value: "", label: labels.filterFeatureAll }, ...features]}
      />
      <AdminCombobox
        aria-label={labels.filterStatus}
        className="w-40"
        value={status}
        onValueChange={(value) => setParams({ status: value, cursor: null })}
        options={[
          { value: "", label: labels.filterStatusAll },
          { value: "OK", label: labels.statusOK },
          { value: "FAILED", label: labels.statusFAILED },
          { value: "ABORTED", label: labels.statusABORTED },
          { value: "REFUSED", label: labels.statusREFUSED },
        ]}
      />
      {(feature || status) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParams({ feature: null, status: null, cursor: null })}
        >
          {labels.clear}
        </Button>
      )}
    </FilterBarRow>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DataTable
        data={rows}
        columns={columns}
        labels={tableLabels}
        // One server page, already filtered and ordered by the service. A
        // keyset cursor cannot say how many pages are behind it, so "Load more"
        // below is the paging.
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: Math.max(rows.length, 1) }}
        onPaginationChange={noop}
        sorting={EMPTY_SORTING}
        onSortingChange={noop}
        globalFilter=""
        onGlobalFilterChange={noop}
        filters={filters}
        emptyState={
          <Empty>
            <EmptyMedia>
              <Sparkles aria-hidden />
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
