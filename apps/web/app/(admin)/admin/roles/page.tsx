import { getTranslations } from "next-intl/server";
import { loadRoleList } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage } from "../_components/admin-page.tsx";
import { CreateRoleDialog } from "./create-role-dialog.tsx";
import { RolesTable, type RolesTableLabels } from "./roles-table.tsx";

// Roles & permissions list (changes-01, image-1): role, users, permissions
// x/total, type, Open → the role's own detail page — now on the shared
// DataTable (client-driven; the role list is tiny). The old whole-matrix
// screen is superseded by per-role permission panels.
export default async function RolesPage() {
  const subject = await requirePermission("roles.view");
  const [t, { roles, totalPermissions }] = await Promise.all([
    getTranslations("admin"),
    loadRoleList(),
  ]);
  const canManage = can(subject, "roles.manage");

  const labels: RolesTableLabels = {
    search: t("searchRoles"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    roleName: t("roleName"),
    users: t("users"),
    permissionsCol: t("permissionsCol"),
    type: t("type"),
    actionsCol: t("actionsCol"),
    open: t("open"),
    level: t("level"),
    systemBadge: t("systemBadge"),
    customBadge: t("customBadge"),
    emptyTitle: t("noRoles"),
  };

  return (
    <AdminPage
      title={t("roles")}
      description={t("rolesSubtitle")}

      actions={
        canManage ? (
          <CreateRoleDialog
            maxLevel={subject.maxRoleLevel}
            labels={{
              createRole: t("createRole"),
              createRoleDescription: t("dialogDesc.createRole"),
              name: t("roleName"),
              key: t("roleKey"),
              level: t("level"),
              description: t("roleDescription"),
              save: t("save"),
              cancel: t("cancel"),
            }}
          />
        ) : undefined
      }
    >
      <RolesTable
        roles={roles.map((r) => ({
          key: r.key,
          name: r.name,
          level: r.level,
          userCount: r.userCount,
          permissionCount: r.permissionCount,
          isSystem: r.isSystem,
        }))}
        totalPermissions={totalPermissions}
        labels={labels}
      />
    </AdminPage>
  );
}
