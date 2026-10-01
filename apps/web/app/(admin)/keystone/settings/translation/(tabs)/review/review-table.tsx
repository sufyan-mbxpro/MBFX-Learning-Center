"use client";

// The review queue (ADR-159 #5, ADR-163 #1): every translation no person has
// read — machine-written rows, a person's rows whose English moved on, and rows
// the number check flagged. Loaded in full (capped at 500), so the language and
// status filters are local state in the table's toolbar (code-style.md #9). The
// status filter matters: after a backfill the machine rows outnumber the rest,
// and "Check figures" is the one to read first.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import type { ReviewStatus } from "@repo/core";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { StatusBadge, type StatusTone } from "../../../../_components/status-badge.tsx";
import { useClientTable } from "../../../../_hooks/use-client-table.ts";

export interface ReviewRowView {
  key: string;
  title: string;
  sourceTitle: string | null;
  locale: string;
  language: string;
  type: string;
  status: ReviewStatus;
  /** The editor, opened on this language; null for a type with no editor link. */
  href: string | null;
  updatedLabel: string;
  updatedSort: number;
}

export interface ReviewLabels {
  table: {
    search: string;
    columns: string;
    export: string;
    selectedSuffix: string;
    pageWord: string;
    ofWord: string;
    previous: string;
    next: string;
    noResults: string;
    actionsCol: string;
  };
  titleCol: string;
  languageCol: string;
  typeCol: string;
  statusCol: string;
  updatedCol: string;
  /** "English: {title}". */
  sourceTitle: string;
  statuses: Record<ReviewStatus, string>;
  open: string;
  allLanguages: string;
  languageFilter: string;
  allStatuses: string;
  statusFilter: string;
  emptyTitle: string;
  emptyBody: string;
}

/** A figure that changed is the one to read first; a machine row is routine. */
const STATUS_TONE: Record<ReviewStatus, StatusTone> = {
  NEEDS_REVIEW: "warning",
  OUTDATED: "info",
  MACHINE_TRANSLATED: "neutral",
};

export function ReviewTable({
  rows,
  languages,
  labels,
}: {
  rows: ReviewRowView[];
  languages: { value: string; label: string }[];
  labels: ReviewLabels;
}) {
  const [locale, setLocale] = useState("");
  const [status, setStatus] = useState("");
  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (locale === "" || row.locale === locale) && (status === "" || row.status === status),
      ),
    [rows, locale, status],
  );
  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title} ${row.sourceTitle ?? ""} ${row.language} ${row.type}`,
    sortValues: {
      title: (row) => row.title,
      language: (row) => row.language,
      status: (row) => row.status,
      updated: (row) => row.updatedSort,
    },
  });

  const columns = useMemo<ColumnDef<ReviewRowView>[]>(
    () => [
      {
        id: "title",
        header: labels.titleCol,
        meta: { label: labels.titleCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-96 flex-col gap-0.5">
            <span className="truncate font-medium">{row.original.title}</span>
            {row.original.sourceTitle && (
              <span className="truncate text-xs text-muted-foreground">
                {labels.sourceTitle.replace("{title}", row.original.sourceTitle)}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "language",
        header: labels.languageCol,
        meta: { label: labels.languageCol },
        cell: ({ row }) => row.original.language,
      },
      {
        id: "type",
        header: labels.typeCol,
        meta: { label: labels.typeCol },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.type}</span>,
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={STATUS_TONE[row.original.status]}>
            {labels.statuses[row.original.status]}
          </StatusBadge>
        ),
      },
      {
        id: "updated",
        header: labels.updatedCol,
        meta: { label: labels.updatedCol },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.updatedLabel}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.table.actionsCol}</span>,
        meta: { label: labels.table.actionsCol },
        enableHiding: false,
        cell: ({ row }) =>
          row.original.href ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" render={<Link href={row.original.href} />}>
                {labels.open}
              </Button>
            </div>
          ) : null,
      },
    ],
    [labels],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <ClipboardCheck aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
        <EmptyDescription>{labels.emptyBody}</EmptyDescription>
      </Empty>
    );
  }

  const tableLabels: DataTableLabels = {
    search: labels.table.search,
    columns: labels.table.columns,
    export: labels.table.export,
    selectedCount: (n) => `${n} ${labels.table.selectedSuffix}`,
    page: (p, c) => `${labels.table.pageWord} ${p} ${labels.table.ofWord} ${c}`,
    previous: labels.table.previous,
    next: labels.table.next,
    noResults: labels.table.noResults,
  };

  return (
    <DataTable
      {...tableProps}
      columns={columns}
      labels={tableLabels}
      filters={
        <FilterBarRow>
          <AdminCombobox
            aria-label={labels.languageFilter}
            className="w-40"
            value={locale}
            onValueChange={setLocale}
            options={[{ value: "", label: labels.allLanguages }, ...languages]}
          />
          <AdminCombobox
            aria-label={labels.statusFilter}
            className="w-40"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: labels.allStatuses },
              { value: "NEEDS_REVIEW", label: labels.statuses.NEEDS_REVIEW },
              { value: "OUTDATED", label: labels.statuses.OUTDATED },
              { value: "MACHINE_TRANSLATED", label: labels.statuses.MACHINE_TRANSLATED },
            ]}
          />
        </FilterBarRow>
      }
    />
  );
}
