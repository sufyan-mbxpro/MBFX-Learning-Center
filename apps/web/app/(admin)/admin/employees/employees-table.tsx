"use client";

// Employees on the shared DataTable, client-driven via useClientTable (the
// full list is small and already loaded — the hook plays the server's role:
// filter → sort → slice). Search, sortable columns, pagination and the
// shared empty state replace the former static <Table>.
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, IdCard } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { EMPLOYEE_STATUS_TONE, StatusBadge, statusTone } from "../_components/status-badge.tsx";
import { useClientTable } from "../_hooks/use-client-table.ts";

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workEmail: string;
  departmentName: string | null;
  designationTitle: string | null;
  status: string;
}

// Plain strings only — this crosses the RSC boundary, so the function-
// valued DataTableLabels entries are constructed client-side below.
export interface EmployeesTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  perPageSuffix: string;
  previous: string;
  next: string;
  noResults: string;
  nameCol: string;
  emailCol: string;
  departmentCol: string;
  designationCol: string;
  statusCol: string;
  actionsCol: string;
  open: string;
  emptyTitle: string;
  statusLabels: Record<string, string>;
}

export function EmployeesTable({
  employees,
  labels,
}: {
  employees: EmployeeRow[];
  labels: EmployeesTableLabels;
}) {
  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, c) => `${labels.pageWord} ${p} ${labels.ofWord} ${c}`,
    pageSize: (n) => `${n} ${labels.perPageSuffix}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  const { tableProps } = useClientTable(employees, {
    searchText: (e) =>
      `${e.firstName} ${e.lastName} ${e.employeeCode} ${e.workEmail} ${e.departmentName ?? ""} ${e.designationTitle ?? ""}`,
    sortValues: {
      name: (e) => `${e.firstName} ${e.lastName}`,
      workEmail: (e) => e.workEmail,
      departmentName: (e) => e.departmentName,
      designationTitle: (e) => e.designationTitle,
      status: (e) => labels.statusLabels[e.status] ?? e.status,
    },
  });

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      {
        id: "name",
        header: labels.nameCol,
        meta: { label: labels.nameCol },
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              href={`/admin/employees/${row.original.id}`}
              className="font-medium text-primary-interactive underline-offset-4 hover:underline"
            >
              {row.original.firstName} {row.original.lastName}
            </Link>
            <code className="text-xs text-muted-foreground">{row.original.employeeCode}</code>
          </div>
        ),
      },
      {
        accessorKey: "workEmail",
        header: labels.emailCol,
        meta: { label: labels.emailCol },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.workEmail}</span>,
      },
      {
        accessorKey: "departmentName",
        header: labels.departmentCol,
        meta: { label: labels.departmentCol },
        cell: ({ row }) => row.original.departmentName ?? "—",
      },
      {
        accessorKey: "designationTitle",
        header: labels.designationCol,
        meta: { label: labels.designationCol },
        cell: ({ row }) => row.original.designationTitle ?? "—",
      },
      {
        accessorKey: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={statusTone(EMPLOYEE_STATUS_TONE, row.original.status)}>
            {labels.statusLabels[row.original.status] ?? row.original.status}
          </StatusBadge>
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
              render={<Link href={`/admin/employees/${row.original.id}`} />}
            >
              {labels.open}
              <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
            </Button>
          </div>
        ),
      },
    ],
    [labels],
  );

  return (
    <DataTable
      columns={columns}
      labels={tableLabels}
      pageSizeOptions={[20, 50, 100]}
      {...tableProps}
      emptyState={
        <Empty className="border-none">
          <EmptyMedia>
            <IdCard aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.noResults}</EmptyDescription>
        </Empty>
      }
    />
  );
}
