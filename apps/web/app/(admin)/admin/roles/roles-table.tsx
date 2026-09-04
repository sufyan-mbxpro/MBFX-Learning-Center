"use client";

// Roles on the shared DataTable, client-driven via useClientTable (the
// role list is tiny; the hook filters/sorts/slices locally). Replaces the
// former static <Table> with search, sortable columns and the shared empty
// state.
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Shield } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { useClientTable } from "../_hooks/use-client-table.ts";

export interface RoleRow {
  key: string;
  name: string;
  level: number;
  userCount: number;
  permissionCount: number;
  isSystem: boolean;
}

// Plain strings only — this crosses the RSC boundary, so the function-
// valued DataTableLabels entries are constructed client-side below.
export interface RolesTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  roleName: string;
  users: string;
  permissionsCol: string;
  type: string;
  actionsCol: string;
  open: string;
  level: string;
  systemBadge: string;
  customBadge: string;
  emptyTitle: string;
}

export function RolesTable({
  roles,
  totalPermissions,
  labels,
}: {
  roles: RoleRow[];
  totalPermissions: number;
  labels: RolesTableLabels;
}) {
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

  const { tableProps } = useClientTable(roles, {
    searchText: (r) => `${r.name} ${r.key}`,
    sortValues: {
      name: (r) => r.name,
      userCount: (r) => r.userCount,
      permissionCount: (r) => r.permissionCount,
    },
    initialPageSize: 25,
  });

  const columns = useMemo<ColumnDef<RoleRow>[]>(
    () => [
      {
        id: "name",
        header: labels.roleName,
        meta: { label: labels.roleName },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              href={`/admin/roles/${row.original.key}`}
              className="font-medium text-primary-interactive underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {labels.level} {row.original.level} · <code>{row.original.key}</code>
            </span>
          </div>
        ),
      },
      {
        accessorKey: "userCount",
        header: labels.users,
        meta: { label: labels.users },
      },
      {
        accessorKey: "permissionCount",
        header: labels.permissionsCol,
        meta: { label: labels.permissionsCol },
        cell: ({ row }) => `${row.original.permissionCount} / ${totalPermissions}`,
      },
      {
        id: "type",
        header: labels.type,
        meta: { label: labels.type },
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isSystem ? "secondary" : "outline"}>
            {row.original.isSystem ? labels.systemBadge : labels.customBadge}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/roles/${row.original.key}`} />}
            >
              {labels.open}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          </div>
        ),
      },
    ],
    [labels, totalPermissions],
  );

  return (
    <DataTable
      columns={columns}
      labels={tableLabels}
      {...tableProps}
      emptyState={
        <Empty className="border-none">
          <EmptyMedia>
            <Shield aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.noResults}</EmptyDescription>
        </Empty>
      }
    />
  );
}
