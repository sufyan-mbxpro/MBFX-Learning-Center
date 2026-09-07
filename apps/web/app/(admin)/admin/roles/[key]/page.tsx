import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadRoleDetail, loadRoleMatrix } from "@repo/core";
import { can, canAssignRole, requirePermission } from "@repo/rbac";
import { Badge } from "@repo/ui/components/badge";
import { humanizeKey } from "@repo/utils";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import { RoleActions } from "./role-actions.tsx";
import { RolePermissions } from "./role-permissions.tsx";

// Role detail (changes-01, image-2): profile card + grouped permission
// panel with select-all / grant-all and autosave. Editability (name,
// description, permissions — ADR-016, changes-02) = roles.manage AND the
// actor's strict-< level ceiling; a role's key/level/existence stay locked
// when it's a system role. All re-enforced server-side in the actions
// regardless of what renders here.
export default async function RoleDetailPage({ params }: PageProps<"/admin/roles/[key]">) {
  const subject = await requirePermission("roles.view");
  const { key } = await params;

  const [t, role, matrix] = await Promise.all([
    getTranslations("admin"),
    loadRoleDetail(key),
    loadRoleMatrix(),
  ]);
  if (!role) notFound();

  const canManage = can(subject, "roles.manage");
  const withinLevel = canAssignRole(subject, role.level);
  // ADR-016: system roles are editable in place (permissions included) for
  // any actor who outranks them — only the key/level/existence stay locked.
  const editable = canManage && withinLevel;

  return (
    <AdminPage
      title={role.name}
      description={t("pageDesc.roleDetail")}
      backHref="/admin/roles"
      backLabel={t("backToList")}
      meta={
        <Badge variant={role.isSystem ? "secondary" : "outline"}>
          {role.isSystem ? t("systemBadge") : t("customBadge")}
        </Badge>
      }
      actions={
        <>
          {canManage && withinLevel && (
            <RoleActions
              roleKey={role.key}
              name={role.name}
              description={role.description}
              level={role.level}
              isSystem={role.isSystem}
              canEdit
              maxLevel={subject.maxRoleLevel}
              labels={{
                edit: t("edit"),
                clone: t("clone"),
                delete: t("delete"),
                save: t("save"),
                cancel: t("cancel"),
                name: t("roleName"),
                level: t("level"),
                description: t("roleDescription"),
                deleteTitle: t("roleDeleteTitle"),
                deleteConfirm: t("roleDeleteConfirm"),
              }}
            />
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <AdminSection title={t("roleProfile")} className="lg:w-72 lg:shrink-0">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("roleKey")}</dt>
              <dd>{humanizeKey(role.key)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("level")}</dt>
              <dd>{role.level}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("roleDescription")}</dt>
              <dd>{role.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("assignedUsers")}</dt>
              <dd>{role.userCount}</dd>
            </div>
          </dl>
        </AdminSection>

        <AdminSection title={t("permissionsCol")} className="min-w-0 flex-1">
          <RolePermissions
            roleKey={role.key}
            groups={matrix.groups}
            grantedKeys={role.permissionKeys}
            readOnly={!editable}
            labels={{
              grantAll: t("grantAll"),
              selectAll: t("selectAllGroup"),
              search: t("searchPermissions"),
              enabledOf: t("enabledOf"),
            }}
          />
        </AdminSection>
      </div>
    </AdminPage>
  );
}
