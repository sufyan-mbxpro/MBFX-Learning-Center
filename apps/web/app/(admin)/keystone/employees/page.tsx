import { getTranslations } from "next-intl/server";
import { buildOrgChart, listEmployees, type OrgChartNode } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { EmployeesTable, type EmployeesTableLabels } from "./employees-table.tsx";

function OrgNode({ node, depth }: { node: OrgChartNode; depth: number }) {
  return (
    <li className={depth > 0 ? "ms-6 border-s ps-4" : ""}>
      <span className="text-sm">
        {node.firstName} {node.lastName}
        <span className="text-xs text-muted-foreground">
          {" "}
          — {node.designationTitle ?? node.employeeCode}
        </span>
      </span>
      {node.reports.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {node.reports.map((report) => (
            <OrgNode key={report.id} node={report} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Employees list (changes-01 rework): shared DataTable (client-driven —
// search/sort/paginate over the already-loaded list); per-employee controls
// (status, role, reset password, offboard) live on the detail page.
export default async function EmployeesPage() {
  await requirePermission("employees.view");
  const [t, employees] = await Promise.all([getTranslations("admin"), listEmployees()]);
  const chart = buildOrgChart(employees.filter((e) => e.status !== "TERMINATED"));

  const labels: EmployeesTableLabels = {
    search: t("searchEmployees"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    perPageSuffix: t("perPageSuffix"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    nameCol: t("nameCol"),
    emailCol: t("emailCol"),
    departmentCol: t("departmentCol"),
    designationCol: t("designationCol"),
    statusCol: t("status"),
    actionsCol: t("actionsCol"),
    open: t("open"),
    emptyTitle: t("noEmployees"),
    statusLabels: {
      ACTIVE: t("statusActive"),
      ON_LEAVE: t("statusOnLeave"),
      NOTICE_PERIOD: t("statusNoticePeriod"),
      TERMINATED: t("statusTerminated"),
      RESIGNED: t("statusResigned"),
    },
  };

  return (
    <AdminPage title={t("employees")} description={t("pageDesc.employees")}>
      <EmployeesTable
        employees={employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          employeeCode: e.employeeCode,
          workEmail: e.workEmail,
          departmentName: e.departmentName,
          designationTitle: e.designationTitle,
          status: e.status,
        }))}
        labels={labels}
      />

      <AdminSection title={t("orgChart")}>
        <div className="overflow-x-auto">
          <ul className="flex min-w-fit flex-col gap-1">
            {chart.map((node) => (
              <OrgNode key={node.id} node={node} depth={0} />
            ))}
          </ul>
        </div>
      </AdminSection>
    </AdminPage>
  );
}
