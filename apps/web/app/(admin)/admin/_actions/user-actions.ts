"use server";

// Module 10 mutations — same discipline as admin-actions.ts:
// requirePermission first, Zod-parsed input, service does the write +
// audit + invalidation. The level guards (strict <, last-super_admin) are
// INSIDE the services, keyed to the actor's real Subject.
import { z } from "zod";
import { setUserPassword } from "@repo/auth";
import {
  adminResetPasswordSchema,
  createRoleSchema,
  employeeStatusSchema,
  setRolePermissionsSchema,
  updateEmployeeSchema,
  updateRoleSchema,
} from "@repo/contracts";
import {
  assignRole,
  cloneRole,
  createRole,
  deleteRole,
  offboardEmployee,
  recordEmployeeUpdate,
  recordPasswordReset,
  removePermissionOverride,
  removeRole,
  setEmployeeStatus,
  setPermissionOverride,
  setRolePermission,
  setRolePermissions,
  setUserStatus,
  updateRoleMeta,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";

const id = z.string().min(1);
// Literal unions rather than the @repo/db enums — apps stay off the db
// package (architecture.md #2); the values are the schema's, verified by
// the service's typed signature.
const statusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]);
const effectSchema = z.enum(["ALLOW", "DENY"]);

export async function setUserStatusAction(userId: string, status: string): Promise<void> {
  const subject = await requirePermission("users.update");
  await setUserStatus(subject, id.parse(userId), statusSchema.parse(status));
}

export async function assignRoleAction(userId: string, roleKey: string): Promise<void> {
  const subject = await requirePermission("permissions.assign");
  await assignRole(subject, id.parse(userId), id.parse(roleKey));
}

export async function removeRoleAction(userId: string, roleKey: string): Promise<void> {
  const subject = await requirePermission("permissions.assign");
  await removeRole(subject, id.parse(userId), id.parse(roleKey));
}

export async function setOverrideAction(
  userId: string,
  permissionKey: string,
  effect: string,
  reason: string,
): Promise<void> {
  const subject = await requirePermission("permissions.assign");
  await setPermissionOverride(
    subject,
    id.parse(userId),
    id.parse(permissionKey),
    effectSchema.parse(effect),
    z.string().min(3).parse(reason),
  );
}

export async function removeOverrideAction(userId: string, permissionKey: string): Promise<void> {
  const subject = await requirePermission("permissions.assign");
  await removePermissionOverride(subject, id.parse(userId), id.parse(permissionKey));
}

export async function setRolePermissionAction(
  roleKey: string,
  permissionKey: string,
  granted: boolean,
): Promise<void> {
  const subject = await requirePermission("roles.manage");
  await setRolePermission(
    subject,
    id.parse(roleKey),
    id.parse(permissionKey),
    z.boolean().parse(granted),
  );
}

export async function cloneRoleAction(
  sourceRoleKey: string,
  newKey: string,
  newName: string,
): Promise<void> {
  const subject = await requirePermission("roles.manage");
  await cloneRole(
    subject,
    id.parse(sourceRoleKey),
    z
      .string()
      .min(2)
      .regex(/^[a-z0-9_]+$/)
      .parse(newKey),
    z.string().min(2).parse(newName),
  );
}

export async function offboardEmployeeAction(employeeId: string): Promise<void> {
  const subject = await requirePermission("employees.update");
  await offboardEmployee(subject.id, id.parse(employeeId));
}

// ─── changes-01 additions ────────────────────────────────────

export async function resetUserPasswordAction(input: unknown): Promise<void> {
  const subject = await requirePermission("users.password.reset");
  const parsed = adminResetPasswordSchema.parse(input);
  // Credential replacement lives in @repo/auth (same Argon2id path sign-in
  // verifies against); core records the event, revokes sessions, notifies.
  await setUserPassword(parsed.userId, parsed.newPassword);
  await recordPasswordReset(subject, parsed.userId);
}

export async function createRoleAction(input: unknown): Promise<void> {
  const subject = await requirePermission("roles.manage");
  await createRole(subject, createRoleSchema.parse(input));
}

export async function updateRoleMetaAction(roleKey: string, input: unknown): Promise<void> {
  const subject = await requirePermission("roles.manage");
  await updateRoleMeta(subject, id.parse(roleKey), updateRoleSchema.parse(input));
}

export async function deleteRoleAction(roleKey: string): Promise<void> {
  const subject = await requirePermission("roles.manage");
  await deleteRole(subject, id.parse(roleKey));
}

export async function setRolePermissionsAction(input: unknown): Promise<void> {
  const subject = await requirePermission("roles.manage");
  const parsed = setRolePermissionsSchema.parse(input);
  await setRolePermissions(subject, parsed.roleKey, parsed.permissionKeys, parsed.granted);
}

export async function updateEmployeeAction(employeeId: string, input: unknown): Promise<void> {
  const subject = await requirePermission("employees.update");
  await recordEmployeeUpdate(subject.id, id.parse(employeeId), updateEmployeeSchema.parse(input));
}

export async function setEmployeeStatusAction(employeeId: string, status: string): Promise<void> {
  const subject = await requirePermission("employees.update");
  await setEmployeeStatus(subject.id, id.parse(employeeId), employeeStatusSchema.parse(status));
}
