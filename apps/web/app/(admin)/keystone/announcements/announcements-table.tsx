"use client";

// The announcements list (ADR-171, changes-54 §10.2), presented as the
// reference's campaign list since changes-59: a status TAB strip with a count
// per status replaces the status dropdown (its own row above the table, the
// News & Analysis layout), the badges are tonal with a dot,
// and each date says which date it is.
//
// The status column says where a campaign IS — Draft, Scheduled, Waiting for
// course, Sending n%, Sent, Cancelled — because that is what someone opens
// this screen to learn. The audience is shown as the cards picked, never the
// raw keys (code-style #5). Filters live in the table's toolbar and declare
// their own width (code-style #9).
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AnnouncementAudienceKey,
  AnnouncementStatusValue,
  CampaignKind,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Tabs, TabsCount, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
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
import {
  deleteAnnouncementDraftAction,
  duplicateAnnouncementAction,
} from "../_actions/announcement-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { StatusBadge } from "../_components/status-badge.tsx";
import { useClientTable } from "../_hooks/use-client-table.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import {
  ANNOUNCEMENT_STATUS_TONE,
  displayStatus,
  progressPercent,
  type AnnouncementDisplayStatus,
} from "./_lib/labels.ts";

export interface AnnouncementRow {
  id: string;
  kind: CampaignKind;
  name: string;
  targetTitle: string | null;
  status: AnnouncementStatusValue;
  waitingForTarget: boolean;
  audienceKeys: AnnouncementAudienceKey[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdByName: string | null;
  dateLabel: string;
  dateKind: "finished" | "scheduled" | "created";
  dateSort: number;
}

const STATUSES: AnnouncementDisplayStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "WAITING",
  "SENDING",
  "SENT",
  "CANCELLED",
];

function RowActions({ row, canCreate }: { row: AnnouncementRow; canCreate: boolean }) {
  const t = useTranslations("admin");
  const ta = useTranslations("admin.announcements");
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t("openActions")}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/keystone/announcements/${row.id}`} />}>
            <Pencil aria-hidden data-icon="inline-start" />
            {row.status === "DRAFT" ? t("edit") : ta("open")}
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await duplicateAnnouncementAction(row.id);
                  router.push(`/keystone/announcements/${id}`);
                })
              }
            >
              <Copy aria-hidden data-icon="inline-start" />
              {t("duplicate")}
            </DropdownMenuItem>
          )}
          {canCreate && row.status === "DRAFT" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 aria-hidden data-icon="inline-start" />
                {t("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={ta("confirmDeleteTitle")}
        description={ta("confirmDeleteBody")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={() => run(() => deleteAnnouncementDraftAction(row.id))}
      />
    </div>
  );
}

export function AnnouncementsTable({
  rows,
  canCreate,
}: {
  rows: AnnouncementRow[];
  canCreate: boolean;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("admin.announcements");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");

  // Counted over the KIND filter, so a tab's number matches what it shows.
  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const row of rows) {
      if (kind !== "" && row.kind !== kind) continue;
      const shown = displayStatus(row.status, row.waitingForTarget);
      byStatus.set(shown, (byStatus.get(shown) ?? 0) + 1);
    }
    return byStatus;
  }, [rows, kind]);
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "" || displayStatus(row.status, row.waitingForTarget) === status) &&
          (kind === "" || row.kind === kind),
      ),
    [rows, status, kind],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.name} ${row.targetTitle ?? ""}`,
    sortValues: {
      name: (row) => row.name,
      status: (row) => STATUSES.indexOf(displayStatus(row.status, row.waitingForTarget)),
      recipients: (row) => row.recipientCount,
      date: (row) => row.dateSort,
    },
  });

  const tableLabels: DataTableLabels = {
    search: ta("searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedCount: (n) => `${n} ${t("selectedCount")}`,
    page: (p, c) => `${t("pageWord")} ${p} ${t("ofWord")} ${c}`,
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
  };

  const columns = useMemo<ColumnDef<AnnouncementRow>[]>(
    () => [
      {
        id: "name",
        header: ta("columnName"),
        meta: { label: ta("columnName") },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-0.5">
            <Link
              href={`/keystone/announcements/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.kind === "COURSE"
                ? (row.original.targetTitle ?? ta("courseMissing"))
                : ta(`kinds.${row.original.kind}`)}
              {row.original.createdByName
                ? ` · ${ta("byAuthor", { name: row.original.createdByName })}`
                : ""}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: ta("columnStatus"),
        meta: { label: ta("columnStatus") },
        cell: ({ row }) => {
          const shown = displayStatus(row.original.status, row.original.waitingForTarget);
          return (
            <StatusBadge tone={ANNOUNCEMENT_STATUS_TONE[shown]} appearance="tonal">
              {shown === "SENDING"
                ? ta("statusSending", { percent: progressPercent(row.original) })
                : ta(`statuses.${shown}`)}
            </StatusBadge>
          );
        },
      },
      {
        id: "audience",
        header: ta("columnAudience"),
        meta: { label: ta("columnAudience") },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.audienceKeys.map((key) => (
              <Badge key={key} variant="outline">
                {ta(`audiences.${key}.label`)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "date",
        header: ta("columnDate"),
        meta: { label: ta("columnDate") },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {ta(`datePrefix.${row.original.dateKind}`, { date: row.original.dateLabel })}
          </span>
        ),
      },
      {
        id: "recipients",
        header: () => <span className="block text-end">{ta("columnRecipients")}</span>,
        meta: { label: ta("columnRecipients") },
        cell: ({ row }) => (
          <span className="block text-end tabular-nums">
            {row.original.status === "DRAFT" ? "—" : row.original.recipientCount}
          </span>
        ),
      },
      {
        id: "sent",
        header: () => <span className="block text-end">{ta("columnSent")}</span>,
        meta: { label: ta("columnSent") },
        cell: ({ row }) =>
          row.original.status === "DRAFT" ? (
            <span className="block text-end text-muted-foreground">—</span>
          ) : (
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-success-interactive">{row.original.sentCount}</span>
              {row.original.recipientCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {Math.round((row.original.sentCount / row.original.recipientCount) * 100)}%
                </span>
              )}
            </span>
          ),
      },
      {
        id: "failed",
        header: () => <span className="block text-end">{ta("columnFailed")}</span>,
        meta: { label: ta("columnFailed") },
        cell: ({ row }) =>
          row.original.status === "DRAFT" ? (
            <span className="block text-end text-muted-foreground">—</span>
          ) : (
            <span
              className={
                row.original.failedCount > 0
                  ? "block text-end font-medium text-destructive-interactive tabular-nums"
                  : "block text-end text-muted-foreground tabular-nums"
              }
            >
              {row.original.failedCount}
            </span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actionsCol")}</span>,
        meta: { label: t("actionsCol") },
        enableHiding: false,
        cell: ({ row }) => <RowActions row={row.original} canCreate={canCreate} />,
      },
    ],
    [t, ta, canCreate],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Mail aria-hidden className="size-6 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>{ta("empty")}</EmptyTitle>
        <EmptyDescription>{ta("emptyBody")}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The status strip IS the status filter, on its own row above the
          table like the News & Analysis section tabs: one tab per status,
          each with its count, so the list says where everything stands
          before a row is read. Absent statuses stay as tabs at 0 — a tab
          that comes and goes moves the others under the pointer. Search and
          the kind filter stay in the table's toolbar (code-style #9). */}
      <Tabs
        value={status}
        onValueChange={(value) => setStatus(String(value))}
        className="max-w-full overflow-x-auto"
      >
        <TabsList aria-label={ta("filterStatus")}>
          <TabsTrigger value="">
            {ta("filterAllStatuses")}
            <TabsCount>{total}</TabsCount>
          </TabsTrigger>
          {STATUSES.map((key) => (
            <TabsTrigger key={key} value={key}>
              {ta(`statusTabs.${key}`)}
              <TabsCount>{counts.get(key) ?? 0}</TabsCount>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        {...tableProps}
        columns={columns}
        labels={tableLabels}
        filters={
          <FilterBarRow>
            <AdminCombobox
              aria-label={ta("filterKind")}
              className="w-40"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "", label: ta("filterAllKinds") },
                { value: "CUSTOM", label: ta("kinds.CUSTOM") },
                { value: "COURSE", label: ta("kinds.COURSE") },
              ]}
            />
          </FilterBarRow>
        }
      />
    </div>
  );
}
