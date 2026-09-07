import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadAssignableRoles, loadRoleMatrix, loadUserDetail } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Badge } from "@repo/ui/components/badge";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import { StatusBadge, USER_STATUS_TONE, statusTone } from "../../_components/status-badge.tsx";
import {
  OverrideControls,
  ResetPasswordButton,
  RoleControls,
  StatusControl,
} from "./detail-controls.tsx";

// User detail (changes-01 rework, MBX user page): header + sectioned cards
// for personal info, account status & roles, and permission overrides.
// IDOR discipline (security.md #7): the load is scoped to non-deleted
// users and 404s when absent — existence isn't leaked.
export default async function UserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const subject = await requirePermission("users.view");
  const { id } = await params;

  const [t, user, roles, matrix] = await Promise.all([
    getTranslations("admin"),
    loadUserDetail(id),
    loadAssignableRoles(),
    loadRoleMatrix(),
  ]);
  if (!user) notFound();

  const allPermissionKeys = matrix.groups.flatMap((g) => g.permissions.map((p) => p.key));
  const canUpdate = can(subject, "users.update");
  const canAssign = can(subject, "permissions.assign");
  const canResetPassword = can(subject, "users.password.reset");

  const statusLabels = {
    ACTIVE: t("statusActive"),
    INACTIVE: t("statusInactive"),
    SUSPENDED: t("statusSuspended"),
    PENDING_VERIFICATION: t("statusPending"),
  } as Record<string, string>;

  const confirmLabels = {
    confirmTitle: t("confirmTitle"),
    confirm: t("confirm"),
    cancel: t("cancel"),
  };

  return (
    <AdminPage
      title={user.name}
      description={t("pageDesc.userDetail")}
      backHref="/admin/users"
      backLabel={t("backToList")}
      meta={
        <>
          <Badge variant="outline">
            {user.userType === "STAFF" ? t("typeStaff") : t("typeLearner")}
          </Badge>
          <StatusBadge tone={statusTone(USER_STATUS_TONE, user.status)}>
            {statusLabels[user.status] ?? user.status}
          </StatusBadge>
        </>
      }
      actions={
        canResetPassword ? (
          <ResetPasswordButton
            userId={user.id}
            userLabel={user.email}
            labels={{
              resetPassword: t("resetPassword"),
              resetDescription: t("resetPasswordDescription"),
              newPassword: t("newPassword"),
              generate: t("generatePassword"),
              confirm: t("confirm"),
              cancel: t("cancel"),
              done: t("resetPasswordDone"),
            }}
          />
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title={t("personalInformation")}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("nameCol")}</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted-foreground">{t("emailCol")}</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted-foreground">{t("phoneCol")}</dt>
            <dd>{user.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("created")}</dt>
            <dd>{user.createdAt.toISOString().slice(0, 10)}</dd>
            <dt className="text-muted-foreground">{t("lastLogin")}</dt>
            <dd>{user.lastLoginAt?.toISOString().slice(0, 10) ?? "—"}</dd>
          </dl>
        </AdminSection>

        <AdminSection title={t("accountStatus")}>
          {canUpdate ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("status")}</span>
              <StatusControl
                userId={user.id}
                status={user.status}
                statusLabels={statusLabels}
                labels={{
                  status: t("status"),
                  confirmStatusChange: t("confirmStatusChange"),
                  ...confirmLabels,
                }}
              />
            </div>
          ) : (
            <StatusBadge tone={statusTone(USER_STATUS_TONE, user.status)}>
              {statusLabels[user.status] ?? user.status}
            </StatusBadge>
          )}
        </AdminSection>
      </div>

      {canAssign && (
        <>
          <AdminSection title={t("rolesCol")}>
            <RoleControls
              userId={user.id}
              currentRoles={user.roleKeys}
              availableRoles={roles}
              labels={{
                assignRole: t("assignRole"),
                remove: t("removeRole"),
                confirmRemoveRole: t("confirmRemoveRole"),
                level: t("level"),
                ...confirmLabels,
              }}
            />
          </AdminSection>

          <AdminSection title={t("overrides")}>
            <OverrideControls
              userId={user.id}
              overrides={user.overrides}
              permissionKeys={allPermissionKeys}
              labels={{
                addOverride: t("addOverride"),
                reason: t("reason"),
                allow: t("allow"),
                deny: t("deny"),
                permission: t("permission"),
                remove: t("removeRole"),
                confirmRemoveOverride: t("confirmRemoveOverride"),
                ...confirmLabels,
              }}
            />
          </AdminSection>
        </>
      )}
    </AdminPage>
  );
}
