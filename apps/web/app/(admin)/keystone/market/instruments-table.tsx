"use client";

// The instruments list (changes-25 T4, ADR-087).
//
// **The freshness column is not decoration.** The sweep walks instruments
// oldest-stored-bar first and stops when the provider's request budget runs
// out (ADR-087 #9), so on a free tier some instruments are always a day or two
// behind. Showing when each one last got a bar is what makes that rotation
// visible rather than mysterious — without it, "why is gold stale?" has no
// answer on any screen.
//
// Reorder is keyboard-only, as everywhere else in this admin (plan §8.2): this
// repo has no drag-and-drop dependency and is not acquiring one for a list of
// thirty rows.
import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  LineChart,
  MoreHorizontal,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { MARKET_INSTRUMENT_KINDS } from "@repo/contracts";
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
import { humanizeKey } from "@repo/utils";
import {
  deleteInstrumentAction,
  reorderInstrumentsAction,
  setInstrumentActiveAction,
} from "../_actions/market-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useClientTable } from "../_hooks/use-client-table.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { InstrumentDialog, type InstrumentDialogLabels } from "./instrument-dialog.tsx";

export interface InstrumentRow {
  id: string;
  kind: string;
  symbol: string;
  displayName: string;
  base: string | null;
  quote: string | null;
  providerSymbol: string | null;
  pipSize: number | null;
  decimals: number;
  isActive: boolean;
  sortOrder: number;
  barCount: number;
  /** Rendered label for the newest stored bar, or null when there is none. */
  lastBarLabel: string | null;
  /** Epoch ms — the formatted label sorts lexically, which is not chronological. */
  lastBarSort: number;
  /** Whole days since the newest bar, or null when never synced. */
  staleDays: number | null;
}

export interface InstrumentsTableLabels extends InstrumentDialogLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  symbolCol: string;
  kindCol: string;
  dataCol: string;
  statusCol: string;
  actionsCol: string;
  active: string;
  inactive: string;
  statusLabel: string;
  allStatuses: string;
  kindLabel: string;
  allKinds: string;
  neverSynced: string;
  barsSuffix: string;
  edit: string;
  activate: string;
  deactivate: string;
  moveUp: string;
  moveDown: string;
  deleteInstrument: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  openActions: string;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * How out of date an instrument is, as a tone rather than a number.
 *
 * The thresholds are generous on purpose: the market is shut at weekends, so a
 * bar three days old on a Monday morning is normal rather than broken, and a
 * screen that cries stale every Saturday teaches people to ignore it.
 *
 * **"Never synced" is NEUTRAL, not destructive.** It is the seeded state of
 * every instrument on a fresh install — the provider ships MANUAL and disabled
 * (ADR-087 #11) — so painting it red makes a correct first run look like
 * twenty-eight failures. A fault has a screen of its own: `lastSyncError` on
 * the provider page, which is also the screen that can fix it.
 */
function freshnessTone(
  staleDays: number | null,
): "success" | "warning" | "destructive" | "outline" {
  if (staleDays === null) return "outline";
  if (staleDays <= 4) return "success";
  if (staleDays <= 10) return "warning";
  return "destructive";
}

function RowActions({
  row,
  index,
  total,
  canManage,
  onMove,
  labels,
}: {
  row: InstrumentRow;
  index: number;
  total: number;
  canManage: boolean;
  onMove: (rowId: string, delta: number) => void;
  labels: InstrumentsTableLabels;
}) {
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!canManage) return null;

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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden data-icon="inline-start" />
            {labels.edit}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={pending}
            onClick={() => run(() => setInstrumentActiveAction(row.id, !row.isActive))}
          >
            <Power aria-hidden data-icon="inline-start" />
            {row.isActive ? labels.deactivate : labels.activate}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          {/* Menu items, not drag handles (plan §8.2). Disabled at the ends
              rather than hidden, so the menu does not change shape row to row. */}
          <DropdownMenuItem disabled={pending || index === 0} onClick={() => onMove(row.id, -1)}>
            <ChevronUp aria-hidden data-icon="inline-start" />
            {labels.moveUp}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending || index === total - 1}
            onClick={() => onMove(row.id, 1)}
          >
            <ChevronDown aria-hidden data-icon="inline-start" />
            {labels.moveDown}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden data-icon="inline-start" />
            {labels.deleteInstrument}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted only while open, so the form is seeded from THIS row every
          time rather than kept in sync by an effect. */}
      {editOpen && (
        <InstrumentDialog open onOpenChange={setEditOpen} instrument={row} labels={labels} />
      )}

      {/* Deleting an instrument CASCADES its bars — years of history, gone
          with no undo — so it confirms (ADR-044 #7), and the body says the
          count rather than leaving the editor to guess what "its data" means.
          Deactivating is the reversible option, and it is one item up. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteTitle}
        description={`${labels.confirmDeleteBody} (${row.barCount} ${labels.barsSuffix})`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => deleteInstrumentAction(row.id))}
      />
    </div>
  );
}

export function InstrumentsTable({
  rows,
  canManage,
  labels,
}: {
  rows: InstrumentRow[];
  canManage: boolean;
  labels: InstrumentsTableLabels;
}) {
  const { run } = useServerAction();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "" ||
            (status === "active" && row.isActive) ||
            (status === "inactive" && !row.isActive)) &&
          (kind === "" || row.kind === kind),
      ),
    [rows, status, kind],
  );

  // Reorder acts on the FULL list, never the filtered view: positions are
  // absolute, and swapping two rows that happen to be adjacent under a filter
  // would move them past rows the editor cannot see.
  const move = useCallback(
    (rowId: string, delta: number) => {
      const ids = rows.map((row) => row.id);
      const from = ids.indexOf(rowId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved!);
      run(() => reorderInstrumentsAction(ids));
    },
    [rows, run],
  );

  const { tableProps } = useClientTable(visible, {
    searchText: (row) => `${row.symbol} ${row.displayName} ${row.providerSymbol ?? ""}`,
    sortValues: {
      symbol: (row) => row.symbol,
      kind: (row) => row.kind,
      data: (row) => row.lastBarSort,
      status: (row) => String(row.isActive),
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

  const columns = useMemo<ColumnDef<InstrumentRow>[]>(
    () => [
      {
        id: "symbol",
        header: labels.symbolCol,
        meta: { label: labels.symbolCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.symbol}</span>
            <span className="text-xs text-muted-foreground">{row.original.displayName}</span>
          </div>
        ),
      },
      {
        id: "kind",
        header: labels.kindCol,
        meta: { label: labels.kindCol },
        // ADR-044 #5 — an enum member never renders raw.
        cell: ({ row }) => <Badge variant="outline">{humanizeKey(row.original.kind)}</Badge>,
      },
      {
        id: "data",
        header: labels.dataCol,
        meta: { label: labels.dataCol },
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Badge variant={freshnessTone(row.original.staleDays)}>
              {row.original.lastBarLabel ?? labels.neverSynced}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {row.original.barCount} {labels.barsSuffix}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "outline"}>
            {row.original.isActive ? labels.active : labels.inactive}
          </Badge>
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
            index={rows.findIndex((r) => r.id === row.original.id)}
            total={rows.length}
            canManage={canManage}
            onMove={move}
            labels={labels}
          />
        ),
      },
    ],
    [labels, rows, move, canManage],
  );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <LineChart aria-hidden />
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
        <FilterBarRow>
          {/* Toolbar filters declare their own width (ADR-057); a form field
              would be w-full. */}
          <AdminCombobox
            aria-label={labels.kindLabel}
            className="w-40"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "", label: labels.allKinds },
              ...MARKET_INSTRUMENT_KINDS.map((value) => ({
                value,
                label: humanizeKey(value),
              })),
            ]}
          />
          <AdminCombobox
            aria-label={labels.statusLabel}
            className="w-40"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "", label: labels.allStatuses },
              { value: "active", label: labels.active },
              { value: "inactive", label: labels.inactive },
            ]}
          />
        </FilterBarRow>
      }
    />
  );
}
