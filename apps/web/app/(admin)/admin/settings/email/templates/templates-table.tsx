"use client";

// The email templates list.
//
// Five rows today, so it is a client table (`useClientTable`) like roles and
// employees: the registry bounds the list, and server paging for five rows
// would be churn. Filters sit in the toolbar (code-style #9).
//
// **The switch confirms, and says what breaks.** Switching a template off is
// allowed — ADR-078 #9 is explicit that it is not forbidden — but a CRITICAL
// one (password reset, verification) takes people's ability to recover an
// account with it, so the dialog names that consequence rather than asking "are
// you sure?" (code-style #7).
import * as React from "react";
import Link from "next/link";
import { Mail, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { EmailAudience } from "@repo/contracts";
import type { EmailTemplateLocaleState, EmailTranslationState } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { Switch } from "@repo/ui/components/switch";
import { setEmailTemplateActiveAction } from "../../../_actions/email-actions.ts";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { StatusBadge } from "../../../_components/status-badge.tsx";
import { useClientTable } from "../../../_hooks/use-client-table.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

export interface EmailTemplateTableRow {
  key: string;
  audience: EmailAudience;
  critical: boolean;
  isActive: boolean;
  /** The default locale's subject — the template's readable name. */
  subject: string;
  locales: EmailTemplateLocaleState[];
  updatedAtLabel: string | null;
  updatedAtSort: number;
}

export interface EmailTemplatesTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  nameCol: string;
  audienceCol: string;
  activeCol: string;
  localesCol: string;
  updatedCol: string;
  actionsCol: string;
  edit: string;
  never: string;
  critical: string;
  audiencePublic: string;
  audienceStaff: string;
  audienceAny: string;
  stateCurrent: string;
  stateOutdated: string;
  stateMissing: string;
  stateDraft: string;
  noContent: string;
  allAudiences: string;
  audienceLabel: string;
  activateTitle: string;
  activateBody: string;
  deactivateTitle: string;
  deactivateBody: string;
  deactivateCriticalTitle: string;
  deactivateCriticalBody: string;
  confirm: string;
  cancel: string;
  toggleLabel: string;
}

const STATE_TONE: Record<EmailTranslationState, "success" | "warning" | "neutral" | "info"> = {
  current: "success",
  outdated: "warning",
  missing: "neutral",
  draft: "info",
};

function LocaleBadges({
  locales,
  labels,
}: {
  locales: EmailTemplateLocaleState[];
  labels: EmailTemplatesTableLabels;
}) {
  const stateLabel: Record<EmailTranslationState, string> = {
    current: labels.stateCurrent,
    outdated: labels.stateOutdated,
    missing: labels.stateMissing,
    draft: labels.stateDraft,
  };
  return (
    <div className="flex flex-wrap gap-1">
      {locales.map((entry) => (
        <StatusBadge key={entry.locale} tone={STATE_TONE[entry.state]}>
          {/* The locale code is the one identifier that IS the display form —
              `en`/`ar` is how a translator names a catalog, and ADR-044 #5's
              target is keys like `super_admin`. The state is spelled out. */}
          <span className="uppercase">{entry.locale}</span>
          <span className="text-3xs opacity-80">{stateLabel[entry.state]}</span>
        </StatusBadge>
      ))}
    </div>
  );
}

function ActiveSwitch({
  row,
  labels,
}: {
  row: EmailTemplateTableRow;
  labels: EmailTemplatesTableLabels;
}) {
  const { run, pending } = useServerAction();
  const [confirming, setConfirming] = React.useState(false);

  const next = !row.isActive;
  const copy = next
    ? { title: labels.activateTitle, body: labels.activateBody }
    : row.critical
      ? { title: labels.deactivateCriticalTitle, body: labels.deactivateCriticalBody }
      : { title: labels.deactivateTitle, body: labels.deactivateBody };

  return (
    <>
      <Switch
        aria-label={labels.toggleLabel}
        checked={row.isActive}
        disabled={pending}
        onCheckedChange={() => setConfirming(true)}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.title}
        description={copy.body}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        // Turning a template ON is not destructive; turning one off is.
        destructive={!next}
        onConfirm={() =>
          run(() => setEmailTemplateActiveAction({ key: row.key, isActive: next }))
        }
      />
    </>
  );
}

export function EmailTemplatesTable({
  rows,
  canUpdate,
  labels,
}: {
  rows: EmailTemplateTableRow[];
  canUpdate: boolean;
  labels: EmailTemplatesTableLabels;
}) {
  const [audience, setAudience] = React.useState("");

  const audienceLabel = React.useCallback(
    (value: EmailAudience) =>
      value === "public"
        ? labels.audiencePublic
        : value === "staff"
          ? labels.audienceStaff
          : labels.audienceAny,
    [labels],
  );

  const visible = React.useMemo(
    () => rows.filter((row) => audience === "" || row.audience === audience),
    [rows, audience],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.key} ${row.subject}`,
    sortValues: {
      name: (row) => row.subject || row.key,
      audience: (row) => row.audience,
      active: (row) => String(row.isActive),
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

  const columns = React.useMemo<ColumnDef<EmailTemplateTableRow>[]>(
    () => [
      {
        id: "name",
        header: labels.nameCol,
        meta: { label: labels.nameCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-96 flex-col gap-1">
            <Link
              href={`/admin/settings/email/templates/${row.original.key}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.subject || labels.noContent}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* The registry key, as a muted span rather than `<code>` —
                  code-style #6: admin chrome is one typeface. */}
              <span className="truncate text-xs text-muted-foreground">{row.original.key}</span>
              {row.original.critical && (
                <Badge variant="warning" className="text-3xs">
                  {labels.critical}
                </Badge>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "audience",
        header: labels.audienceCol,
        meta: { label: labels.audienceCol },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{audienceLabel(row.original.audience)}</span>
        ),
      },
      {
        id: "active",
        header: labels.activeCol,
        meta: { label: labels.activeCol },
        cell: ({ row }) =>
          canUpdate ? (
            <ActiveSwitch row={row.original} labels={labels} />
          ) : (
            <StatusBadge tone={row.original.isActive ? "success" : "neutral"}>
              {row.original.isActive ? labels.stateCurrent : labels.stateMissing}
            </StatusBadge>
          ),
      },
      {
        id: "locales",
        header: labels.localesCol,
        meta: { label: labels.localesCol },
        cell: ({ row }) => <LocaleBadges locales={row.original.locales} labels={labels} />,
      },
      {
        id: "updatedAt",
        header: labels.updatedCol,
        meta: { label: labels.updatedCol },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.updatedAtLabel ?? labels.never}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link href={`/admin/settings/email/templates/${row.original.key}`}>
                  <Pencil aria-hidden />
                  {labels.edit}
                </Link>
              }
            />
          </div>
        ),
      },
    ],
    [labels, canUpdate, audienceLabel],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Mail aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{labels.noResults}</EmptyTitle>
        <EmptyDescription>{labels.noContent}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <DataTable
      {...tableProps}
      columns={columns}
      labels={tableLabels}
      filters={
        <FilterBarRow>
          <AdminCombobox
            aria-label={labels.audienceLabel}
            className="w-40"
            value={audience}
            onValueChange={setAudience}
            options={[
              { value: "", label: labels.allAudiences },
              { value: "public", label: labels.audiencePublic },
              { value: "staff", label: labels.audienceStaff },
              { value: "any", label: labels.audienceAny },
            ]}
          />
        </FilterBarRow>
      }
    />
  );
}
