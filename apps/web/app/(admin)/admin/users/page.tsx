import { getTranslations } from "next-intl/server";
import { listUsers } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { humanizeKey } from "@repo/utils";
import { userStatusFilterSchema, userTypeFilterSchema } from "@repo/contracts";
import { UsersTable } from "./users-table.tsx";
import { AdminPage } from "../_components/admin-page.tsx";

// Users list on the shared DataTable — SERVER-driven end to end: this page
// parses the table state from searchParams, @repo/core does the actual
// pagination/sort/filter in SQL, the client table just reports state
// changes back into the URL. Row-action visibility flags come from the
// subject's real permissions — the actions re-check server-side anyway.
export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const subject = await requirePermission("users.view");
  const params = await searchParams;

  const page = Math.max(0, Number(params.page ?? 0) || 0);
  const pageSize = ([10, 25, 50] as const).find((s) => s === Number(params.pageSize)) ?? 10;
  const sortBy = (["email", "name", "createdAt", "lastLoginAt"] as const).find(
    (s) => s === params.sortBy,
  );
  const sortDir = params.sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const search = typeof params.q === "string" ? params.q : "";
  const userType = userTypeFilterSchema.safeParse(params.userType).data;
  const status = userStatusFilterSchema.safeParse(params.status).data;

  const [t, result] = await Promise.all([
    getTranslations("admin"),
    listUsers({
      page,
      pageSize,
      sortBy,
      sortDir,
      search: search || undefined,
      userType,
      status,
    }),
  ]);

  const statusLabels = {
    ACTIVE: t("statusActive"),
    INACTIVE: t("statusInactive"),
    SUSPENDED: t("statusSuspended"),
    PENDING_VERIFICATION: t("statusPending"),
  };
  const typeLabels = { LEARNER: t("typeLearner"), STAFF: t("typeStaff") };

  return (
    <AdminPage title={t("users")} description={t("pageDesc.users")}>
      <UsersTable
        rows={result.rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString().slice(0, 10),
          lastLoginAt: r.lastLoginAt?.toISOString().slice(0, 10) ?? "",
          // changes-08 #2: role keys are identifiers, so they render as
          // words — `super_admin` reads "Super Admin".
          roles: r.roleKeys.map((key) => humanizeKey(key)).join(", "),
        }))}
        pageCount={result.pageCount}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy ?? "createdAt"}
        sortDir={sortDir}
        search={search}
        userType={userType ?? ""}
        status={status ?? ""}
        canUpdate={can(subject, "users.update")}
        canResetPassword={can(subject, "users.password.reset")}
        labels={{
          search: t("searchUsers"),
          columns: t("columns"),
          export: t("export"),
          selectedSuffix: t("selectedCount"),
          pageWord: t("pageWord"),
          ofWord: t("ofWord"),
          previous: t("previous"),
          next: t("next"),
          noResults: t("noResults"),
          activate: t("activateUsers"),
          deactivate: t("deactivateUsers"),
          email: t("emailCol"),
          name: t("nameCol"),
          type: t("type"),
          status: t("status"),
          rolesCol: t("rolesCol"),
          created: t("created"),
          lastLogin: t("lastLogin"),
          actions: t("actionsCol"),
          view: t("view"),
          resetPassword: t("resetPassword"),
          confirmTitle: t("confirmTitle"),
          confirmActivate: t("confirmActivate"),
          confirmDeactivate: t("confirmDeactivate"),
          cancel: t("cancel"),
          confirm: t("confirm"),
          allTypes: t("allTypes"),
          allStatuses: t("allStatuses"),
          selectAll: t("selectAllGroup"),
          emptyTitle: t("noUsers"),
          perPageSuffix: t("perPageSuffix"),
          statusLabels,
          typeLabels,
          resetTitle: t("resetPassword"),
          resetDescription: t("resetPasswordDescription"),
          newPassword: t("newPassword"),
          generate: t("generatePassword"),
          resetDone: t("resetPasswordDone"),
        }}
      />
    </AdminPage>
  );
}
