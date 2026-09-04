"use client";

// Client half of the server-driven users table (changes-01 rework):
// type/status filters pushed into the URL, status badges, and a per-row
// actions menu (view / activate / suspend / reset password) — every
// destructive choice behind a confirmation popup, every item gated by the
// flags the server computed from the subject's real permissions.
import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Users } from "lucide-react";
import type { ColumnDef, PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ResetPasswordDialog } from "../_components/reset-password-dialog.tsx";
import { setUserStatusAction } from "../_actions/user-actions.ts";
import { FilterBar } from "../_components/filter-bar.tsx";
import { StatusBadge, USER_STATUS_TONE, statusTone } from "../_components/status-badge.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";

export interface UserTableRow {
  id: string;
  email: string;
  name: string;
  userType: string;
  status: string;
  createdAt: string;
  lastLoginAt: string;
  roles: string;
}

// Plain strings only — this crosses the RSC boundary, so the function-
// valued DataTableLabels entries are constructed HERE, client-side.
export interface UsersTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  activate: string;
  deactivate: string;
  email: string;
  name: string;
  type: string;
  status: string;
  rolesCol: string;
  created: string;
  lastLogin: string;
  actions: string;
  view: string;
  resetPassword: string;
  confirmTitle: string;
  confirmActivate: string;
  confirmDeactivate: string;
  cancel: string;
  confirm: string;
  allTypes: string;
  allStatuses: string;
  selectAll: string;
  emptyTitle: string;
  perPageSuffix: string;
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  resetTitle: string;
  resetDescription: string;
  newPassword: string;
  generate: string;
  resetDone: string;
}

export function UsersTable({
  rows,
  pageCount,
  page,
  pageSize,
  sortBy,
  sortDir,
  search,
  userType,
  status,
  canUpdate,
  canResetPassword,
  labels,
}: {
  rows: UserTableRow[];
  pageCount: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  search: string;
  userType: string;
  status: string;
  canUpdate: boolean;
  canResetPassword: boolean;
  labels: UsersTableLabels;
}) {
  const { run } = useServerAction();
  const setParams = useUrlFilters();
  const [confirmTarget, setConfirmTarget] = React.useState<{
    rows: UserTableRow[];
    status: "ACTIVE" | "SUSPENDED";
  } | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserTableRow | null>(null);

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, total) => `${labels.pageWord} ${p} ${labels.ofWord} ${total}`,
    pageSize: (n) => `${n} ${labels.perPageSuffix}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  const pagination: PaginationState = { pageIndex: page, pageSize };
  const sorting: SortingState = [{ id: sortBy, desc: sortDir === "desc" }];

  const applyStatus = (targets: UserTableRow[], nextStatus: "ACTIVE" | "SUSPENDED") =>
    run(async () => {
      for (const row of targets) await setUserStatusAction(row.id, nextStatus);
    });

  const columns: ColumnDef<UserTableRow>[] = [
    {
      id: "select",
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          onCheckedChange={(c) => table.toggleAllRowsSelected(c === true)}
          aria-label={labels.selectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(c) => row.toggleSelected(c === true)}
          aria-label={row.original.email}
        />
      ),
    },
    {
      accessorKey: "email",
      header: labels.email,
      meta: { label: labels.email },
      cell: ({ row }) => (
        <Link
          href={`/admin/users/${row.original.id}`}
          className="text-primary-interactive underline-offset-4 hover:underline"
        >
          {row.original.email}
        </Link>
      ),
    },
    { accessorKey: "name", header: labels.name, meta: { label: labels.name } },
    {
      accessorKey: "userType",
      header: labels.type,
      meta: { label: labels.type },
      enableSorting: false,
      cell: ({ row }) => labels.typeLabels[row.original.userType] ?? row.original.userType,
    },
    {
      accessorKey: "status",
      header: labels.status,
      meta: { label: labels.status },
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge tone={statusTone(USER_STATUS_TONE, row.original.status)}>
          {labels.statusLabels[row.original.status] ?? row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "roles",
      header: labels.rolesCol,
      meta: { label: labels.rolesCol },
      enableSorting: false,
    },
    { accessorKey: "createdAt", header: labels.created, meta: { label: labels.created } },
    { accessorKey: "lastLoginAt", header: labels.lastLogin, meta: { label: labels.lastLogin } },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      meta: { label: labels.actions },
      header: () => <span className="sr-only">{labels.actions}</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${labels.actions}: ${row.original.email}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              render={<Link href={`/admin/users/${row.original.id}`}>{labels.view}</Link>}
            />
            {canUpdate && (
              <>
                <DropdownMenuSeparator />
                {row.original.status !== "ACTIVE" && (
                  <DropdownMenuItem
                    onClick={() => setConfirmTarget({ rows: [row.original], status: "ACTIVE" })}
                  >
                    {labels.activate}
                  </DropdownMenuItem>
                )}
                {row.original.status !== "SUSPENDED" && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmTarget({ rows: [row.original], status: "SUSPENDED" })}
                  >
                    {labels.deactivate}
                  </DropdownMenuItem>
                )}
              </>
            )}
            {canResetPassword && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setResetTarget(row.original)}>
                  {labels.resetPassword}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Select
          value={userType}
          onValueChange={(value) => setParams({ userType: (value as string) || null })}
        >
          <SelectTrigger aria-label={labels.type} className="min-w-36">
            <SelectValue>
              {userType ? (labels.typeLabels[userType] ?? userType) : labels.allTypes}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{labels.allTypes}</SelectItem>
            {Object.entries(labels.typeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setParams({ status: (value as string) || null })}
        >
          <SelectTrigger aria-label={labels.status} className="min-w-36">
            <SelectValue>
              {status ? (labels.statusLabels[status] ?? status) : labels.allStatuses}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{labels.allStatuses}</SelectItem>
            {Object.entries(labels.statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        labels={tableLabels}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={(updater: Updater<PaginationState>) => {
          const next = typeof updater === "function" ? updater(pagination) : updater;
          setParams({
            page: next.pageIndex > 0 ? String(next.pageIndex) : null,
            pageSize: next.pageSize !== 10 ? String(next.pageSize) : null,
          });
        }}
        sorting={sorting}
        onSortingChange={(updater: Updater<SortingState>) => {
          const next = typeof updater === "function" ? updater(sorting) : updater;
          const first = next[0];
          setParams({
            sortBy: first?.id ?? null,
            sortDir: first ? (first.desc ? "desc" : "asc") : null,
          });
        }}
        globalFilter={search}
        onGlobalFilterChange={(value) => setParams({ q: value || null })}
        enableRowSelection
        getRowId={(row) => row.id}
        pageSizeOptions={[10, 25, 50]}
        emptyState={
          <Empty className="border-none">
            <EmptyMedia>
              <Users aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>{labels.noResults}</EmptyDescription>
          </Empty>
        }
        bulkActions={
          canUpdate
            ? [
                {
                  key: "activate",
                  label: labels.activate,
                  onClick: (targets) => setConfirmTarget({ rows: targets, status: "ACTIVE" }),
                },
                {
                  key: "deactivate",
                  label: labels.deactivate,
                  onClick: (targets) => setConfirmTarget({ rows: targets, status: "SUSPENDED" }),
                },
              ]
            : []
        }
        exportFileName="users"
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmTarget(null);
        }}
        title={labels.confirmTitle}
        description={
          confirmTarget
            ? `${confirmTarget.status === "ACTIVE" ? labels.confirmActivate : labels.confirmDeactivate} ${
                confirmTarget.rows.length === 1
                  ? (confirmTarget.rows[0]?.email ?? "")
                  : `${confirmTarget.rows.length} ${labels.selectedSuffix}`
              }`
            : ""
        }
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        destructive={confirmTarget?.status === "SUSPENDED"}
        onConfirm={() => {
          if (confirmTarget) applyStatus(confirmTarget.rows, confirmTarget.status);
          setConfirmTarget(null);
        }}
      />

      {resetTarget && (
        <ResetPasswordDialog
          userId={resetTarget.id}
          userLabel={resetTarget.email}
          open
          onOpenChange={(next) => {
            if (!next) setResetTarget(null);
          }}
          labels={{
            title: labels.resetTitle,
            description: labels.resetDescription,
            newPassword: labels.newPassword,
            generate: labels.generate,
            confirm: labels.confirm,
            cancel: labels.cancel,
            done: labels.resetDone,
          }}
        />
      )}
    </div>
  );
}
