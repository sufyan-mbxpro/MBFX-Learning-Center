// Role manager services (Module 10). System roles are clone-only — never
// deleted, never permission-edited directly (lockout risk); the strict-<
// level guard applies to editing a role's permissions the same as to
// assigning it.
import { revalidateTag } from "next/cache";
import { db } from "@repo/db";
import { canAssignRole, type Subject } from "@repo/rbac";
import { recordAudit } from "./index.ts";
import { RoleLevelError } from "./users.ts";

export interface RoleMatrixRow {
  id: string;
  key: string;
  name: string;
  level: number;
  isSystem: boolean;
  permissionKeys: string[];
}

export interface PermissionGroup {
  groupName: string;
  permissions: { key: string; label: string }[];
}

export async function loadRoleMatrix(): Promise<{
  roles: RoleMatrixRow[];
  groups: PermissionGroup[];
}> {
  const [roles, permissions] = await Promise.all([
    db.role.findMany({
      orderBy: { level: "desc" },
      include: { permissions: { select: { permission: { select: { key: true } } } } },
    }),
    db.permission.findMany({ orderBy: [{ groupName: "asc" }, { key: "asc" }] }),
  ]);

  const groupNames = [...new Set(permissions.map((p) => p.groupName))];
  return {
    roles: roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      level: r.level,
      isSystem: r.isSystem,
      permissionKeys: r.permissions.map((p) => p.permission.key),
    })),
    groups: groupNames.map((groupName) => ({
      groupName,
      permissions: permissions
        .filter((p) => p.groupName === groupName)
        .map((p) => ({ key: p.key, label: p.label })),
    })),
  };
}

export class SystemRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SystemRoleError";
  }
}

export class RoleInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleInUseError";
  }
}

// ─── Role manager (changes-01: list/detail pages, create/delete) ──

export interface RoleListRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
}

export async function loadRoleList(): Promise<{ roles: RoleListRow[]; totalPermissions: number }> {
  const [roles, totalPermissions] = await Promise.all([
    db.role.findMany({
      orderBy: { level: "desc" },
      include: { _count: { select: { users: true, permissions: true } } },
    }),
    db.permission.count(),
  ]);
  return {
    roles: roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      level: r.level,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionCount: r._count.permissions,
    })),
    totalPermissions,
  };
}

export interface RoleDetail extends RoleListRow {
  permissionKeys: string[];
  updatedAt: Date;
}

export async function loadRoleDetail(roleKey: string): Promise<RoleDetail | null> {
  const role = await db.role.findUnique({
    where: { key: roleKey },
    include: {
      _count: { select: { users: true, permissions: true } },
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) return null;
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    level: role.level,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissionCount: role._count.permissions,
    permissionKeys: role.permissions.map((p) => p.permission.key),
    updatedAt: role.updatedAt,
  };
}

export async function createRole(
  actor: Subject,
  input: { key: string; name: string; level: number; description?: string },
): Promise<void> {
  // Strict < (frozen, Module 03): an actor can only mint roles BELOW their
  // own ceiling — an Editor cannot create another Editor-level role.
  if (!canAssignRole(actor, input.level)) {
    throw new RoleLevelError(`Cannot create a role at level ${input.level}`);
  }
  const existing = await db.role.findUnique({ where: { key: input.key }, select: { id: true } });
  if (existing) throw new Error(`Role key "${input.key}" already exists`);

  await db.role.create({
    data: {
      key: input.key,
      name: input.name,
      level: input.level,
      description: input.description,
      isSystem: false,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "roles.create",
    entityType: "role",
    entityId: input.key,
    changes: { after: { name: input.name, level: input.level } },
  });
}

export async function updateRoleMeta(
  actor: Subject,
  roleKey: string,
  input: { name?: string; level?: number; description?: string | null },
): Promise<void> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  // ADR-016: system roles take name/description edits like any other role;
  // only their key/level/existence stay locked (the level guard below is
  // what keeps super_admin untouchable for everyone).
  if (role.isSystem && input.level !== undefined && input.level !== role.level) {
    throw new SystemRoleError("A system role's level cannot be changed");
  }
  if (
    !canAssignRole(actor, role.level) ||
    (input.level !== undefined && !canAssignRole(actor, input.level))
  ) {
    throw new RoleLevelError(`Cannot edit a role at level ${input.level ?? role.level}`);
  }

  await db.role.update({
    where: { id: role.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "roles.update",
    entityType: "role",
    entityId: role.key,
    changes: {
      before: { name: role.name, level: role.level, description: role.description },
      after: input,
    },
  });
  // A level change moves every member's maxRoleLevel — flush them.
  if (input.level !== undefined && input.level !== role.level) {
    const members = await db.userRole.findMany({
      where: { roleId: role.id },
      select: { userId: true },
    });
    for (const member of members) revalidateTag(`rbac:${member.userId}`, { expire: 0 });
  }
}

/**
 * Custom roles only, and only while unassigned — deleting a role out from
 * under its members would silently strip their permissions (the quieter
 * cousin of the lockout risk that makes system roles undeletable).
 */
export async function deleteRole(actor: Subject, roleKey: string): Promise<void> {
  const role = await db.role.findUniqueOrThrow({
    where: { key: roleKey },
    include: { _count: { select: { users: true } } },
  });
  if (role.isSystem) throw new SystemRoleError("System roles cannot be deleted");
  if (!canAssignRole(actor, role.level)) {
    throw new RoleLevelError(`Cannot delete a role at level ${role.level}`);
  }
  if (role._count.users > 0) {
    throw new RoleInUseError("Remove this role from all users before deleting it");
  }

  await db.role.delete({ where: { id: role.id } }); // RolePermission rows cascade
  await recordAudit({
    userId: actor.id,
    action: "roles.delete",
    entityType: "role",
    entityId: role.key,
    changes: { before: { name: role.name, level: role.level } },
  });
}

/**
 * Bulk grant/revoke — one call per "select all in group" / "grant all"
 * toggle, one audit row, one rbac flush per member (not per key).
 */
export async function setRolePermissions(
  actor: Subject,
  roleKey: string,
  permissionKeys: string[],
  granted: boolean,
): Promise<void> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  // ADR-016: system roles' permission sets are editable; the strict-< level
  // guard is the lock that matters (nobody outranks super_admin).
  if (!canAssignRole(actor, role.level)) {
    throw new RoleLevelError(`Cannot edit a role at level ${role.level}`);
  }
  const permissions = await db.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  });
  if (permissions.length !== permissionKeys.length) {
    const known = new Set(permissions.map((p) => p.key));
    const unknown = permissionKeys.filter((k) => !known.has(k));
    throw new Error(`Unknown permission keys: ${unknown.join(", ")}`);
  }

  if (granted) {
    await db.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  } else {
    await db.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { in: permissions.map((p) => p.id) } },
    });
  }
  await recordAudit({
    userId: actor.id,
    action: granted ? "roles.grantPermissions" : "roles.revokePermissions",
    entityType: "role",
    entityId: role.key,
    changes: { after: { permissionKeys, granted } },
  });
  const members = await db.userRole.findMany({
    where: { roleId: role.id },
    select: { userId: true },
  });
  for (const member of members) revalidateTag(`rbac:${member.userId}`, { expire: 0 });
}

export async function setRolePermission(
  actor: Subject,
  roleKey: string,
  permissionKey: string,
  granted: boolean,
): Promise<void> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  // ADR-016: system roles' permission sets are editable; the strict-< level
  // guard is the lock that matters (nobody outranks super_admin).
  if (!canAssignRole(actor, role.level)) {
    throw new RoleLevelError(`Cannot edit a role at level ${role.level}`);
  }
  const permission = await db.permission.findUniqueOrThrow({ where: { key: permissionKey } });

  if (granted) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  } else {
    await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });
  }
  await recordAudit({
    userId: actor.id,
    action: granted ? "roles.grantPermission" : "roles.revokePermission",
    entityType: "role",
    entityId: role.key,
    changes: { after: { permissionKey, granted } },
  });
  // Role membership drives every member's subject — flush them all.
  const members = await db.userRole.findMany({
    where: { roleId: role.id },
    select: { userId: true },
  });
  for (const member of members) revalidateTag(`rbac:${member.userId}`, { expire: 0 });
}

export async function cloneRole(
  actor: Subject,
  sourceRoleKey: string,
  newKey: string,
  newName: string,
): Promise<void> {
  const source = await db.role.findUniqueOrThrow({
    where: { key: sourceRoleKey },
    include: { permissions: true },
  });
  if (!canAssignRole(actor, source.level)) {
    throw new RoleLevelError(`Cannot clone a role at level ${source.level}`);
  }

  const clone = await db.role.create({
    data: {
      key: newKey,
      name: newName,
      level: source.level,
      isSystem: false,
      description: `Clone of ${source.name}`,
    },
  });
  if (source.permissions.length > 0) {
    await db.rolePermission.createMany({
      data: source.permissions.map((p) => ({ roleId: clone.id, permissionId: p.permissionId })),
    });
  }
  await recordAudit({
    userId: actor.id,
    action: "roles.clone",
    entityType: "role",
    entityId: newKey,
    changes: { after: { sourceRoleKey, newKey } },
  });
}

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  userType: string;
  status: string;
  phone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  roleKeys: string[];
  overrides: { permissionKey: string; effect: string; reason: string | null }[];
}

export async function loadUserDetail(userId: string): Promise<UserDetail | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      roles: { select: { role: { select: { key: true } } } },
      permissions: {
        select: { effect: true, reason: true, permission: { select: { key: true } } },
      },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    userType: user.userType,
    status: user.status,
    phone: user.phone,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    roleKeys: user.roles.map((r) => r.role.key),
    overrides: user.permissions.map((p) => ({
      permissionKey: p.permission.key,
      effect: p.effect,
      reason: p.reason,
    })),
  };
}

export async function loadAssignableRoles(): Promise<
  { key: string; name: string; level: number }[]
> {
  const roles = await db.role.findMany({
    orderBy: { level: "asc" },
    select: { key: true, name: true, level: true },
  });
  return roles;
}
