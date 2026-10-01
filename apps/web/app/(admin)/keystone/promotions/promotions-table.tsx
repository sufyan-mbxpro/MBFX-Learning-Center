"use client";

// The promotions list (ADR-167, changes-52 P3).
//
// The status column shows the DERIVED phase — Scheduled, Live, Ended — because
// that is the question an editor opens this screen with ("is the webinar popup
// up yet?"), and the stored status alone cannot answer it. A promotion whose
// linked content is not public says so in the title cell: it is active and
// inside its dates, and still shows nowhere, which is exactly the state an
// editor would otherwise spend ten minutes debugging.
//
// Filters live in the table's toolbar and declare their own width
// (code-style #9, ADR-057 §3).
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PROMOTION_KINDS,
  type PromotionBarPositionInput,
  type PromotionKindInput,
  type PromotionPhase,
  type PromotionPlacement,
} from "@repo/contracts";
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
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import {
  duplicatePromotionAction,
  setPromotionDeletedAction,
} from "../_actions/promotion-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import {
  StatusBadge,
  TRANSLATION_STATUS_TONE,
  statusTone,
  type StatusTone,
} from "../_components/status-badge.tsx";
import { inStatusFilter, useDeletedFilterOption } from "../_components/trash.tsx";
import { useClientTable } from "../_hooks/use-client-table.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

export interface PromotionRow {
  id: string;
  title: string | null;
  kind: PromotionKindInput;
  phase: PromotionPhase;
  windowLabel: string;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  startsAtSort: number;
  placements: PromotionPlacement[];
  showAsPopup: boolean;
  showInBand: boolean;
  showAsBar: boolean;
  barPosition: PromotionBarPositionInput;
  priority: number;
  /** CONTENT links only; false means active-and-in-window but shown nowhere. */
  targetPublic: boolean | null;
  locales: Array<{ locale: string; state: string }>;
  deleted: boolean;
  updatedAtSort: number;
  /** Approximate, all time, both surfaces (ADR-170). */
  views: number;
  clicks: number;
}

const PHASES: PromotionPhase[] = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"];

export const PHASE_TONE: Record<PromotionPhase, StatusTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  LIVE: "success",
  ENDED: "neutral",
  ARCHIVED: "neutral",
};

/** Placements shown in the cell before "+n" — the column is a hint, not a list. */
const VISIBLE_PLACEMENTS = 2;

function RowActions({
  row,
  canCreate,
  canDelete,
}: {
  row: PromotionRow;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("admin");
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
          {!row.deleted && (
            <DropdownMenuItem render={<Link href={`/keystone/promotions/${row.id}`} />}>
              <Pencil aria-hidden data-icon="inline-start" />
              {t("edit")}
            </DropdownMenuItem>
          )}
          {canCreate && !row.deleted && (
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const id = await duplicatePromotionAction(row.id);
                  router.push(`/keystone/promotions/${id}`);
                })
              }
            >
              <Copy aria-hidden data-icon="inline-start" />
              {t("duplicate")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              {row.deleted ? (
                // ADR-044 #7: restore is NOT confirmed — it is the undo. It
                // lands as a draft (the service's rule), so it cannot put an
                // offer straight back on the site.
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => run(() => setPromotionDeletedAction(row.id, false))}
                >
                  <Undo2 aria-hidden data-icon="inline-start" />
                  {t("restore")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 aria-hidden data-icon="inline-start" />
                  {t("softDelete")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("promotions.confirmDeleteTitle")}
        description={t("promotions.confirmDeleteBody")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => run(() => setPromotionDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function PromotionsTable({
  rows,
  canCreate,
  canDelete,
}: {
  rows: PromotionRow[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("admin");
  const tp = useTranslations("admin.promotions");
  const [phase, setPhase] = useState("");
  const [kind, setKind] = useState("");
  const deletedOption = useDeletedFilterOption();

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          inStatusFilter(row.deleted, phase, () => row.phase === phase) &&
          (kind === "" || row.kind === kind),
      ),
    [rows, phase, kind],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.title ?? ""} ${tp(`kinds.${row.kind}`)}`,
    sortValues: {
      title: (row) => row.title ?? "",
      kind: (row) => row.kind,
      status: (row) => PHASES.indexOf(row.phase),
      window: (row) => row.startsAtSort,
      priority: (row) => row.priority,
      updatedAt: (row) => row.updatedAtSort,
    },
  });

  const tableLabels: DataTableLabels = {
    search: tp("searchPlaceholder"),
    columns: t("columns"),
    export: t("export"),
    selectedCount: (n) => `${n} ${t("selectedCount")}`,
    page: (p, c) => `${t("pageWord")} ${p} ${t("ofWord")} ${c}`,
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
  };

  const columns = useMemo<ColumnDef<PromotionRow>[]>(
    () => [
      {
        id: "title",
        header: tp("columnTitle"),
        meta: { label: tp("columnTitle") },
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex max-w-80 flex-col gap-1">
              {r.deleted ? (
                <span className="truncate font-medium">{r.title ?? t("untitled")}</span>
              ) : (
                <Link
                  href={`/keystone/promotions/${r.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {r.title ?? t("untitled")}
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {r.showAsPopup && <Badge variant="outline">{tp("asPopup")}</Badge>}
                {r.showInBand && <Badge variant="outline">{tp("inBand")}</Badge>}
                {r.showAsBar && (
                  <Badge variant="outline">
                    {tp("asBanner", { position: tp(`barPositions.${r.barPosition}`) })}
                  </Badge>
                )}
                {r.deleted && <Badge variant="outline">{t("deleted")}</Badge>}
                {r.targetPublic === false && !r.deleted && (
                  <span className="inline-flex items-center gap-1 text-xs text-warning-interactive">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    {tp("targetHidden")}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "kind",
        header: tp("columnKind"),
        meta: { label: tp("columnKind") },
        cell: ({ row }) => <Badge variant="outline">{tp(`kinds.${row.original.kind}`)}</Badge>,
      },
      {
        id: "status",
        header: tp("columnStatus"),
        meta: { label: tp("columnStatus") },
        cell: ({ row }) => (
          <StatusBadge tone={PHASE_TONE[row.original.phase]}>
            {tp(`phases.${row.original.phase}`)}
          </StatusBadge>
        ),
      },
      {
        id: "window",
        header: tp("columnWindow"),
        meta: { label: tp("columnWindow") },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.windowLabel}</span>
        ),
      },
      {
        id: "placements",
        header: tp("columnPlacements"),
        meta: { label: tp("columnPlacements") },
        cell: ({ row }) => {
          const { placements } = row.original;
          const extra = placements.length - VISIBLE_PLACEMENTS;
          return (
            <div className="flex flex-wrap gap-1">
              {placements.slice(0, VISIBLE_PLACEMENTS).map((p) => (
                <Badge key={p} variant="outline">
                  {tp(`placements.${p}`)}
                </Badge>
              ))}
              {extra > 0 && (
                <Badge
                  variant="outline"
                  title={placements
                    .slice(VISIBLE_PLACEMENTS)
                    .map((p) => tp(`placements.${p}`))
                    .join(", ")}
                >
                  {tp("morePlacements", { count: extra })}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "languages",
        header: tp("columnLanguages"),
        meta: { label: tp("columnLanguages") },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.locales.map(({ locale, state }) => (
              // The code is a language identifier, read as one (EN, AR), and
              // the state is the badge's title AND its tone, never colour alone.
              <StatusBadge
                key={locale}
                tone={state === "MISSING" ? "neutral" : statusTone(TRANSLATION_STATUS_TONE, state)}
              >
                <span title={tp(`languageStates.${state}`)}>
                  {locale.toUpperCase()}
                  <span className="sr-only">: {tp(`languageStates.${state}`)}</span>
                </span>
              </StatusBadge>
            ))}
          </div>
        ),
      },
      {
        id: "results",
        header: tp("columnResults"),
        meta: { label: tp("columnResults") },
        cell: ({ row }) => (
          // Approximate (ADR-170 #4) — the column's title says so on hover.
          <div className="flex flex-col text-sm tabular-nums" title={tp("results.approximate")}>
            <span>{tp("results.listViews", { count: row.original.views })}</span>
            <span className="text-muted-foreground">
              {tp("results.listClicks", { count: row.original.clicks })}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actionsCol")}</span>,
        meta: { label: t("actionsCol") },
        enableHiding: false,
        cell: ({ row }) => (
          <RowActions row={row.original} canCreate={canCreate} canDelete={canDelete} />
        ),
      },
    ],
    [t, tp, canCreate, canDelete],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Megaphone aria-hidden className="size-6 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>{tp("empty")}</EmptyTitle>
        <EmptyDescription>{tp("emptyBody")}</EmptyDescription>
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
            aria-label={tp("filterStatus")}
            className="w-40"
            value={phase}
            onValueChange={setPhase}
            options={[
              { value: "", label: tp("filterAllStatuses") },
              ...PHASES.map((key) => ({ value: key, label: tp(`phases.${key}`) })),
              deletedOption,
            ]}
          />
          <AdminCombobox
            aria-label={tp("filterKind")}
            className="w-40"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "", label: tp("filterAllKinds") },
              ...PROMOTION_KINDS.map((key) => ({ value: key, label: tp(`kinds.${key}`) })),
            ]}
          />
        </FilterBarRow>
      }
    />
  );
}
