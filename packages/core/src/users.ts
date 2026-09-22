// User/role administration services (Module 10). Already-authorized
// writes (the actions run requirePermission first), but the AUTHORITY
// checks that depend on the actor — canAssignRole's strict-< level guard,
// the last-super_admin protections — live HERE, server-side, not in UI
// (SKILL.md: "enforced SERVER-side").
import { revalidateTag } from "next/cache";
import { db, UserStatus, type PermissionEffect, type UserType } from "@repo/db";
import { canAssignRole, type Subject } from "@repo/rbac";
import { sendTemplatedEmail } from "@repo/email";
import { recordAudit } from "./index.ts";
import { recordNotification } from "./notifications.ts";

/** ADR-014: notifications go only to STAFF accounts (they're admin-surface UI). */
async function notifyIfStaff(
  userId: string,
  type: string,
  detail: string,
  href?: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { userType: true } });
  if (user?.userType === "STAFF") await recordNotification({ userId, type, detail, href });
}

function invalidateSubjectTag(userId: string) {
  revalidateTag(`rbac:${userId}`, { expire: 0 });
}

// ─── Listing (server-driven DataTable contract) ──────────────

export interface ListUsersParams {
  page: number;
  pageSize: number;
  sortBy?: "email" | "name" | "createdAt" | "lastLoginAt";
  sortDir?: "asc" | "desc";
  search?: string;
  userType?: UserType;
  status?: UserStatus;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  roleKeys: string[];
}

export interface ListUsersResult {
  rows: UserRow[];
  total: number;
  pageCount: number;
}

export async function listUsers(params: ListUsersParams): Promise<ListUsersResult> {
  const where = {
    deletedAt: null,
    ...(params.userType ? { userType: params.userType } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [{ email: { contains: params.search } }, { name: { contains: params.search } }],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { [params.sortBy ?? "createdAt"]: params.sortDir ?? "desc" },
      skip: params.page * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);

  return {
    rows: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      userType: u.userType,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      roleKeys: u.roles.map((r) => r.role.key),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

// ─── Guards ──────────────────────────────────────────────────

export class RoleLevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleLevelError";
  }
}

export class LastSuperAdminError extends Error {
  constructor() {
    super("The last super_admin cannot be demoted or deactivated");
    this.name = "LastSuperAdminError";
  }
}

async function countOtherSuperAdmins(excludingUserId: string): Promise<number> {
  return db.userRole.count({
    where: {
      role: { key: "super_admin" },
      userId: { not: excludingUserId },
      user: { deletedAt: null, status: "ACTIVE" },
    },
  });
}

async function isSuperAdmin(userId: string): Promise<boolean> {
  const row = await db.userRole.findFirst({
    where: { userId, role: { key: "super_admin" } },
    select: { userId: true },
  });
  return row !== null;
}

// ─── Mutations ───────────────────────────────────────────────

export async function setUserStatus(
  actor: Subject,
  userId: string,
  status: UserStatus,
): Promise<void> {
  if (status !== UserStatus.ACTIVE && (await isSuperAdmin(userId))) {
    if ((await countOtherSuperAdmins(userId)) === 0) throw new LastSuperAdminError();
  }

  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { status: true },
  });
  await db.user.update({ where: { id: userId }, data: { status } });
  // Deactivation must bite immediately: sessions are DB-backed and
  // loadSubject rejects non-ACTIVE users, but revoke outright too
  // (security.md #11).
  if (status !== UserStatus.ACTIVE) {
    await db.session.deleteMany({ where: { userId } });
  }
  await recordAudit({
    userId: actor.id,
    action: "users.setStatus",
    entityType: "user",
    entityId: userId,
    changes: { before: { status: before.status }, after: { status } },
  });
  invalidateSubjectTag(userId);
}

export async function assignRole(actor: Subject, userId: string, roleKey: string): Promise<void> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  // Strict < on level (frozen, Module 03): an equal-level grant is rejected
  // too — Editor cannot mint another Editor, let alone an Admin.
  if (!canAssignRole(actor, role.level)) {
    throw new RoleLevelError(`Cannot assign role at level ${role.level}`);
  }

  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
  await recordAudit({
    userId: actor.id,
    action: "roles.assign",
    entityType: "user",
    entityId: userId,
    changes: { after: { roleKey } },
  });
  await notifyIfStaff(userId, "roleAssigned", role.name, "/keystone/profile");
  invalidateSubjectTag(userId);
}

export async function removeRole(actor: Subject, userId: string, roleKey: string): Promise<void> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  if (!canAssignRole(actor, role.level)) {
    throw new RoleLevelError(`Cannot remove role at level ${role.level}`);
  }
  if (roleKey === "super_admin" && (await countOtherSuperAdmins(userId)) === 0) {
    throw new LastSuperAdminError();
  }

  await db.userRole.deleteMany({ where: { userId, roleId: role.id } });
  await recordAudit({
    userId: actor.id,
    action: "roles.remove",
    entityType: "user",
    entityId: userId,
    changes: { before: { roleKey } },
  });
  await notifyIfStaff(userId, "roleRemoved", role.name, "/keystone/profile");
  invalidateSubjectTag(userId);
}

/** Per-user override. A DENY beats everything (frozen rbac semantics) — which is exactly why the reason is REQUIRED and audited. */
export async function setPermissionOverride(
  actor: Subject,
  userId: string,
  permissionKey: string,
  effect: PermissionEffect,
  reason: string,
): Promise<void> {
  if (!reason.trim()) throw new Error("A reason is required for permission overrides");
  const permission = await db.permission.findUniqueOrThrow({ where: { key: permissionKey } });

  await db.userPermission.upsert({
    where: { userId_permissionId: { userId, permissionId: permission.id } },
    update: { effect, reason },
    create: { userId, permissionId: permission.id, effect, reason },
  });
  await recordAudit({
    userId: actor.id,
    action: "permissions.override",
    entityType: "user",
    entityId: userId,
    changes: { after: { permissionKey, effect, reason } },
  });
  invalidateSubjectTag(userId);
}

/**
 * The bookkeeping half of an admin password reset (changes-01 / Module 10,
 * guarded by `users.password.reset` at the action). The credential itself
 * is replaced via @repo/auth's setUserPassword — kept OUT of core so the
 * hash path stays owned by the auth package; this records the event and
 * kills every live session, because a reset whose old sessions survive
 * hasn't actually reset anything.
 */
export async function recordPasswordReset(actor: Subject, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
  await recordAudit({
    userId: actor.id,
    action: "users.passwordReset",
    entityType: "user",
    entityId: userId,
  });
  await notifyIfStaff(userId, "passwordReset", "");
  // An admin replacing someone's password is still their password changing,
  // and they hear about it the same way (ADR-079 #6). In-app notification
  // reaches staff only; this reaches whoever it happened to.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, locale: true },
  });
  if (user) {
    await sendTemplatedEmail({
      key: "auth.password_changed",
      to: user.email,
      locale: user.locale,
      recipientName: user.name,
      variables: { "changed.at": new Date().toISOString() },
    });
  }
  invalidateSubjectTag(userId);
}

/** Self-service profile update (changes-01 profile page) — session-scoped,
 * no permission key: the actor can only ever write their OWN row. */
export async function updateOwnProfile(
  userId: string,
  input: {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  },
): Promise<void> {
  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, firstName: true, lastName: true, phone: true },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    },
  });
  await recordAudit({
    userId,
    action: "users.profileUpdate",
    entityType: "user",
    entityId: userId,
    changes: { before, after: input },
  });
}

export interface OwnProfile {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  image: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  roleNames: string[];
}

export async function loadOwnProfile(userId: string): Promise<OwnProfile | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      image: true,
      createdAt: true,
      lastLoginAt: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    image: user.image,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    roleNames: user.roles.map((r) => r.role.name),
  };
}

export async function removePermissionOverride(
  actor: Subject,
  userId: string,
  permissionKey: string,
): Promise<void> {
  const permission = await db.permission.findUniqueOrThrow({ where: { key: permissionKey } });
  await db.userPermission.deleteMany({ where: { userId, permissionId: permission.id } });
  await recordAudit({
    userId: actor.id,
    action: "permissions.overrideRemove",
    entityType: "user",
    entityId: userId,
    changes: { before: { permissionKey } },
  });
  invalidateSubjectTag(userId);
}

// ─── Admin user record (changes-45, ADR-142) ─────────────────

export class SelfSessionRevokeError extends Error {
  constructor() {
    super("Signing yourself out everywhere is done from your own profile.");
    this.name = "SelfSessionRevokeError";
  }
}

/** The new address already belongs to another account (the unique index). */
export class EmailInUseError extends Error {
  constructor() {
    super("That email address already belongs to another account.");
    this.name = "EmailInUseError";
  }
}

/**
 * Changing someone's address is changing where their password-reset link
 * goes, so it is an account takeover in two steps. The same strict `<` that
 * `canAssignRole` applies to a role grant applies here to the target's
 * highest role: an Editor can correct a learner's typo, not an Admin's address.
 */
export class EmailChangeForbiddenError extends Error {
  constructor() {
    super("You can only change the address of an account below your own role level.");
    this.name = "EmailChangeForbiddenError";
  }
}

export class NotImpersonatableError extends Error {
  constructor() {
    super("Only an active learner account can be entered.");
    this.name = "NotImpersonatableError";
  }
}

/**
 * The "Edit details" dialog's write. Already authorised (`users.update`);
 * a status change goes through `setUserStatus` so the last-super_admin guard
 * and the session revocation it owns are not re-implemented here.
 *
 * changes-46 — the address. Checked BEFORE anything is written, so a refused
 * address changes nothing else either:
 *   - the target must rank below the actor (`EmailChangeForbiddenError`), a
 *     super_admin excepted, and so is the actor's own row;
 *   - the address must be free (`EmailInUseError`); the unique index is the
 *     real guard, the pre-check is only what turns a race into the same error;
 *   - a NEW address is unverified unless this same save says it is verified.
 *     The dialog unticks "Email verified" the moment the address is edited,
 *     so leaving it on is the admin vouching for the new address, not a
 *     stale switch carried over from the old one.
 * Nothing else is revoked: sessions stay, because the person did not change
 * and the credential account is keyed by user id, not by address.
 */
export async function adminUpdateUser(
  actor: Subject,
  input: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: UserStatus;
    emailVerified: boolean;
  },
): Promise<void> {
  const before = await db.user.findFirstOrThrow({
    where: { id: input.userId, deletedAt: null },
    select: {
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      emailVerified: true,
      roles: { select: { role: { select: { level: true } } } },
    },
  });

  const email = input.email.trim().toLowerCase();
  const emailChanged = email !== before.email.toLowerCase();
  if (emailChanged) {
    const targetLevel = Math.max(0, ...before.roles.map((r) => r.role.level));
    const outranks =
      actor.id === input.userId ||
      actor.roleKeys.includes("super_admin") ||
      targetLevel < actor.maxRoleLevel;
    if (!outranks) throw new EmailChangeForbiddenError();
    const taken = await db.user.findFirst({
      where: { email, id: { not: input.userId } },
      select: { id: true },
    });
    if (taken) throw new EmailInUseError();
  }

  if (input.status !== before.status) await setUserStatus(actor, input.userId, input.status);

  const lastName = input.lastName === "" ? null : input.lastName;
  const after = {
    ...(emailChanged ? { email } : {}),
    name: [input.firstName, lastName].filter(Boolean).join(" "),
    firstName: input.firstName,
    lastName,
    phone: input.phone === "" ? null : input.phone,
    emailVerified: input.emailVerified,
  };
  try {
    await db.user.update({ where: { id: input.userId }, data: after });
  } catch (error) {
    // P2002: another request took the address between the check and here.
    if (emailChanged && (error as { code?: string }).code === "P2002") throw new EmailInUseError();
    throw error;
  }
  await recordAudit({
    userId: actor.id,
    action: "users.update",
    entityType: "user",
    entityId: input.userId,
    changes: {
      before: {
        ...(emailChanged ? { email: before.email } : {}),
        name: before.name,
        firstName: before.firstName,
        lastName: before.lastName,
        phone: before.phone,
        emailVerified: before.emailVerified,
      },
      after,
    },
  });
  invalidateSubjectTag(input.userId);
}

/** "Sign out everywhere" for someone else's account. Already authorised. */
export async function revokeUserSessions(actor: Subject, userId: string): Promise<number> {
  if (actor.id === userId) throw new SelfSessionRevokeError();
  const { count } = await db.session.deleteMany({ where: { userId } });
  await recordAudit({
    userId: actor.id,
    action: "users.sessionsRevoke",
    entityType: "user",
    entityId: userId,
    changes: { after: { revoked: count } },
  });
  return count;
}

/**
 * The start half of "Login as user" (ADR-142 §3): the target check and the
 * audit row, written BEFORE the cookies move so a start that then fails still
 * left a trace. The cookie swap is @repo/auth's `impersonateLearner`, which
 * re-checks the target on its own read.
 */
export async function recordImpersonationStart(actor: Subject, userId: string): Promise<void> {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { userType: true, deletedAt: true, status: true },
  });
  if (
    !target ||
    target.userType !== "LEARNER" ||
    target.deletedAt !== null ||
    target.status === UserStatus.SUSPENDED
  ) {
    throw new NotImpersonatableError();
  }
  await recordAudit({
    userId: actor.id,
    action: "users.impersonateStart",
    entityType: "user",
    entityId: userId,
  });
}

/** The record page's "Email verified" switch. Already authorised (`users.update`). */
export async function setUserEmailVerified(
  actor: Subject,
  userId: string,
  emailVerified: boolean,
): Promise<void> {
  const before = await db.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: { emailVerified: true },
  });
  await db.user.update({ where: { id: userId }, data: { emailVerified } });
  await recordAudit({
    userId: actor.id,
    action: "users.update",
    entityType: "user",
    entityId: userId,
    changes: { before, after: { emailVerified } },
  });
}
