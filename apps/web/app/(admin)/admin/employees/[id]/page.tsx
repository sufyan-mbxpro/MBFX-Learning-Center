import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  listDepartments,
  listDesignations,
  listEmployees,
  loadAssignableRoles,
  loadEmployeeDetail,
} from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { AdminPage, AdminSection } from "../../_components/admin-page.tsx";
import {
  EMPLOYEE_STATUS_TONE,
  StatusBadge,
  USER_STATUS_TONE,
  statusTone,
} from "../../_components/status-badge.tsx";
import { ResetPasswordButton, RoleControls } from "../../users/[id]/detail-controls.tsx";
import { OffboardButton } from "../offboard-button.tsx";
import { EmployeeEditDialog, EmployeeStatusControl } from "./employee-controls.tsx";

// Dedicated employee detail page (changes-01): sectioned cards for basic
// info, employment status, role update (via the linked user account),
// password reset, and offboarding. IDOR discipline: scoped load, 404 when
// absent.
export default async function EmployeeDetailPage({ params }: PageProps<"/admin/employees/[id]">) {
  const subject = await requirePermission("employees.view");
  const { id } = await params;

  const [t, employee] = await Promise.all([getTranslations("admin"), loadEmployeeDetail(id)]);
  if (!employee) notFound();

  const canUpdate = can(subject, "employees.update");
  const canAssign = can(subject, "permissions.assign");
  const canResetPassword = can(subject, "users.password.reset");

  const [departments, designations, allEmployees, assignableRoles] = await Promise.all([
    canUpdate ? listDepartments() : Promise.resolve([]),
    canUpdate ? listDesignations() : Promise.resolve([]),
    canUpdate ? listEmployees() : Promise.resolve([]),
    canAssign && employee.linkedUser ? loadAssignableRoles() : Promise.resolve([]),
  ]);

  const employeeStatusLabels = {
    ACTIVE: t("statusActive"),
    ON_LEAVE: t("statusOnLeave"),
    NOTICE_PERIOD: t("statusNoticePeriod"),
    RESIGNED: t("statusResigned"),
  } as Record<string, string>;
  const fullStatusLabel =
    employee.status === "TERMINATED"
      ? t("statusTerminated")
      : (employeeStatusLabels[employee.status] ?? employee.status);

  const userStatusLabels = {
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
      title={`${employee.firstName} ${employee.lastName}`}
      description={t("pageDesc.employeeDetail")}
      backHref="/admin/employees"
      backLabel={t("backToList")}
      meta={
        <>
          <StatusBadge tone={statusTone(EMPLOYEE_STATUS_TONE, employee.status)}>
            {fullStatusLabel}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">{employee.employeeCode}</span>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title={t("personalInformation")}>
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("nameCol")}</dt>
              <dd>
                {employee.firstName} {employee.lastName}
              </dd>
              <dt className="text-muted-foreground">{t("emailCol")}</dt>
              <dd className="break-all">{employee.workEmail}</dd>
              <dt className="text-muted-foreground">{t("phoneCol")}</dt>
              <dd>{employee.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("locationCol")}</dt>
              <dd>{employee.location ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("departmentCol")}</dt>
              <dd>{employee.departmentName ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("designationCol")}</dt>
              <dd>{employee.designationTitle ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("reportingTo")}</dt>
              <dd>{employee.reportingToName ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("joinedAt")}</dt>
              <dd>{employee.joinedAt.toISOString().slice(0, 10)}</dd>
            </dl>
            {canUpdate && employee.status !== "TERMINATED" && (
              <div>
                <EmployeeEditDialog
                  employeeId={employee.id}
                  initial={{
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                    phone: employee.phone ?? "",
                    location: employee.location ?? "",
                    departmentId: employee.departmentId ?? "",
                    designationId: employee.designationId ?? "",
                    reportingToId: employee.reportingToId ?? "",
                    notes: employee.notes ?? "",
                  }}
                  departments={departments}
                  designations={designations}
                  reportingOptions={allEmployees
                    .filter((e) => e.id !== employee.id && e.status !== "TERMINATED")
                    .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
                  labels={{
                    edit: t("edit"),
                    save: t("save"),
                    cancel: t("cancel"),
                    firstName: t("firstNameCol"),
                    lastName: t("lastNameCol"),
                    phone: t("phoneCol"),
                    location: t("locationCol"),
                    department: t("departmentCol"),
                    designation: t("designationCol"),
                    reportingTo: t("reportingTo"),
                    notes: t("notesCol"),
                    none: t("noneOption"),
                  }}
                />
              </div>
            )}
          </div>
        </AdminSection>

        <AdminSection title={t("employmentStatus")}>
          {canUpdate && employee.status !== "TERMINATED" ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("status")}</span>
              <EmployeeStatusControl
                employeeId={employee.id}
                status={employee.status}
                statusLabels={employeeStatusLabels}
                labels={{
                  status: t("status"),
                  confirmStatusChange: t("confirmStatusChange"),
                  ...confirmLabels,
                }}
              />
            </div>
          ) : (
            <StatusBadge tone={statusTone(EMPLOYEE_STATUS_TONE, employee.status)}>
              {fullStatusLabel}
            </StatusBadge>
          )}
          {canUpdate && employee.status !== "TERMINATED" && (
            <div className="mt-2 border-t pt-4">
              <OffboardButton
                employeeId={employee.id}
                label={t("offboard")}
                confirmText={t("offboardConfirm")}
                confirmLabel={t("confirm")}
                cancelLabel={t("cancel")}
              />
            </div>
          )}
        </AdminSection>
      </div>

      {employee.linkedUser ? (
        <AdminSection title={t("linkedAccount")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={`/admin/users/${employee.linkedUser.id}`}
                className="text-primary-interactive underline-offset-4 hover:underline"
              >
                {employee.linkedUser.email}
              </Link>
              <StatusBadge tone={statusTone(USER_STATUS_TONE, employee.linkedUser.status)}>
                {userStatusLabels[employee.linkedUser.status] ?? employee.linkedUser.status}
              </StatusBadge>
              {canResetPassword && (
                <div className="ms-auto">
                  <ResetPasswordButton
                    userId={employee.linkedUser.id}
                    userLabel={employee.linkedUser.email}
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
                </div>
              )}
            </div>
            {canAssign && (
              <RoleControls
                userId={employee.linkedUser.id}
                currentRoles={employee.linkedUser.roleKeys}
                availableRoles={assignableRoles}
                labels={{
                  assignRole: t("assignRole"),
                  remove: t("removeRole"),
                  confirmRemoveRole: t("confirmRemoveRole"),
                  level: t("level"),
                  ...confirmLabels,
                }}
              />
            )}
          </div>
        </AdminSection>
      ) : (
        <AdminSection title={t("linkedAccount")}>
          <p className="text-sm text-muted-foreground">{t("noLinkedAccount")}</p>
        </AdminSection>
      )}
    </AdminPage>
  );
}
