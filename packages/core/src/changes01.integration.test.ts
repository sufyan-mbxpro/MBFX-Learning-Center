// changes-01 services against real MariaDB: role manager CRUD (level +
// system-role + in-use guards, bulk permission set with ONE audit row),
// social link CRUD, notifications (write → read → scoped mark-read),
// password-reset bookkeeping (sessions revoked), employee status guard,
// own-profile update, and permission-scoped admin search.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as UsersModule from "./users.ts";
import type * as RolesModule from "./roles.ts";
import type * as AdminModule from "./admin.ts";
import type * as EmployeesModule from "./employees.ts";
import type * as NotificationsModule from "./notifications.ts";
import type * as SearchModule from "./search.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let users: typeof UsersModule;
let roles: typeof RolesModule;
let admin: typeof AdminModule;
let employees: typeof EmployeesModule;
let notifications: typeof NotificationsModule;
let search: typeof SearchModule;

async function actorSubject(
  level: number,
  allowed: string[],
  roleKeys: string[] = [],
): Promise<Subject> {
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `actor-${Date.now()}-${Math.random()}@x.com`,
      name: "Actor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  return {
    id: user.id,
    userType: "STAFF",
    roleKeys,
    maxRoleLevel: level,
    allowed: new Set(allowed),
    denied: new Set(),
  };
}

async function createUser(email: string, userType: "LEARNER" | "STAFF" = "STAFF") {
  return db.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0]!,
      status: "ACTIVE",
      userType,
    },
  });
}

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  users = await import("./users.ts");
  roles = await import("./roles.ts");
  admin = await import("./admin.ts");
  employees = await import("./employees.ts");
  notifications = await import("./notifications.ts");
  search = await import("./search.ts");

  await db.role.createMany({
    data: [
      { key: "sys_locked", name: "System Locked", level: 50, isSystem: true },
      { key: "plain", name: "Plain", level: 10 },
    ],
  });
  await db.permission.createMany({
    data: [
      { key: "users.view", groupName: "users", label: "View users", sortOrder: 1 },
      { key: "users.update", groupName: "users", label: "Update users", sortOrder: 2 },
      { key: "roles.view", groupName: "users", label: "View roles", sortOrder: 3 },
      { key: "settings.view", groupName: "settings", label: "View settings", sortOrder: 1 },
    ],
  });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

// ─── Role manager ────────────────────────────────────────────

describe("createRole", () => {
  it("rejects a role at/above the actor's ceiling with NO write", async () => {
    const actor = await actorSubject(40, ["roles.manage", "permissions.assign"]);
    await expect(
      roles.createRole(actor, { key: "too_high", name: "Too High", level: 40 }),
    ).rejects.toThrow(users.RoleLevelError);
    expect(await db.role.findUnique({ where: { key: "too_high" } })).toBeNull();
  });

  it("creates a custom role below the ceiling, with audit row", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    await roles.createRole(actor, {
      key: "helpdesk",
      name: "Helpdesk",
      level: 15,
      description: "d",
    });
    const created = await db.role.findUniqueOrThrow({ where: { key: "helpdesk" } });
    expect(created.isSystem).toBe(false);
    expect(created.level).toBe(15);
    expect(
      await db.auditLog.count({ where: { action: "roles.create", entityId: "helpdesk" } }),
    ).toBe(1);
  });

  it("rejects a duplicate key", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    await expect(
      roles.createRole(actor, { key: "helpdesk", name: "Again", level: 12 }),
    ).rejects.toThrow(/already exists/);
  });
});

describe("updateRoleMeta / deleteRole", () => {
  it("edits a system role's name/description but refuses its level and deletion (ADR-016)", async () => {
    const actor = await actorSubject(90, ["roles.manage", "permissions.assign"]);
    await roles.updateRoleMeta(actor, "sys_locked", { name: "Renamed", description: "desc" });
    const row = await db.role.findUniqueOrThrow({ where: { key: "sys_locked" } });
    expect(row.name).toBe("Renamed");
    expect(row.description).toBe("desc");
    expect(row.level).toBe(50);
    expect(row.isSystem).toBe(true);

    await expect(roles.updateRoleMeta(actor, "sys_locked", { level: 40 })).rejects.toThrow(
      roles.SystemRoleError,
    );
    await expect(roles.deleteRole(actor, "sys_locked")).rejects.toThrow(roles.SystemRoleError);
    const audits = await db.auditLog.count({
      where: { action: "roles.update", entityId: "sys_locked" },
    });
    expect(audits).toBe(1);
  });

  it("still refuses a system role at/above the actor's own level (strict <)", async () => {
    const peer = await actorSubject(50, ["roles.manage", "permissions.assign"]);
    await expect(roles.updateRoleMeta(peer, "sys_locked", { name: "nope" })).rejects.toThrow(
      users.RoleLevelError,
    );
  });

  it("refuses to delete a role that still has members", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    const member = await createUser(`member-${Date.now()}@x.com`);
    const role = await db.role.findUniqueOrThrow({ where: { key: "helpdesk" } });
    await db.userRole.create({ data: { userId: member.id, roleId: role.id } });

    await expect(roles.deleteRole(actor, "helpdesk")).rejects.toThrow(roles.RoleInUseError);
    expect(await db.role.findUnique({ where: { key: "helpdesk" } })).not.toBeNull();

    await db.userRole.deleteMany({ where: { roleId: role.id } });
  });

  it("updates meta and deletes an unassigned custom role, with audit rows", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    await roles.updateRoleMeta(actor, "helpdesk", { name: "Help Desk", level: 20 });
    const updated = await db.role.findUniqueOrThrow({ where: { key: "helpdesk" } });
    expect(updated.name).toBe("Help Desk");
    expect(updated.level).toBe(20);

    await roles.deleteRole(actor, "helpdesk");
    expect(await db.role.findUnique({ where: { key: "helpdesk" } })).toBeNull();
    expect(
      await db.auditLog.count({ where: { action: "roles.delete", entityId: "helpdesk" } }),
    ).toBe(1);
  });
});

describe("setRolePermissions (bulk)", () => {
  it("grants a whole group in one call with ONE audit row, then revokes", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    const keys = ["users.view", "users.update", "roles.view"];

    await roles.setRolePermissions(actor, "plain", keys, true);
    const role = await db.role.findUniqueOrThrow({ where: { key: "plain" } });
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(3);
    expect(
      await db.auditLog.count({ where: { action: "roles.grantPermissions", entityId: "plain" } }),
    ).toBe(1);

    // Idempotent re-grant (skipDuplicates) — still 3.
    await roles.setRolePermissions(actor, "plain", keys, true);
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(3);

    await roles.setRolePermissions(actor, "plain", ["users.view", "users.update"], false);
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(1);
  });

  it("rejects unknown permission keys atomically", async () => {
    const actor = await actorSubject(80, ["roles.manage", "permissions.assign"]);
    await expect(
      roles.setRolePermissions(actor, "plain", ["users.view", "nope.nothing"], true),
    ).rejects.toThrow(/Unknown permission keys/);
  });

  it("grants and revokes on a system role for an outranking actor (ADR-016), never for a peer", async () => {
    const actor = await actorSubject(90, ["roles.manage", "permissions.assign"]);
    const role = await db.role.findUniqueOrThrow({ where: { key: "sys_locked" } });
    await roles.setRolePermissions(actor, "sys_locked", ["users.view", "users.update"], true);
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(2);
    await roles.setRolePermission(actor, "sys_locked", "users.update", false);
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(1);

    const peer = await actorSubject(50, ["roles.manage", "permissions.assign"]);
    await expect(
      roles.setRolePermissions(peer, "sys_locked", ["users.view"], false),
    ).rejects.toThrow(users.RoleLevelError);
    expect(await db.rolePermission.count({ where: { roleId: role.id } })).toBe(1);
  });
});

describe("loadRoleList / loadRoleDetail", () => {
  it("reports user/permission counts and the grand total", async () => {
    const { roles: list, totalPermissions } = await roles.loadRoleList();
    expect(totalPermissions).toBe(4);
    const plain = list.find((r) => r.key === "plain");
    expect(plain?.permissionCount).toBe(1);

    const detail = await roles.loadRoleDetail("plain");
    expect(detail?.permissionKeys).toEqual(["roles.view"]);
    expect(await roles.loadRoleDetail("ghost")).toBeNull();
  });
});

// ─── Social links ────────────────────────────────────────────

describe("social link CRUD", () => {
  it("create → update → toggle → delete round-trip with audit rows", async () => {
    const actor = await actorSubject(80, ["social.manage"]);
    await admin.createSocialLink(actor.id, "tiktok", {
      label: "TikTok",
      url: "https://tiktok.com/@mbfx",
    });
    const created = await db.socialLink.findUniqueOrThrow({ where: { platform: "tiktok" } });
    expect(created.isActive).toBe(true);
    expect(created.icon).toBe("tiktok");

    await expect(
      admin.createSocialLink(actor.id, "tiktok", { label: "x", url: "https://x.example" }),
    ).rejects.toThrow(/already exists/);

    await admin.updateSocialLink(actor.id, "tiktok", { label: "TikTok HQ", isActive: false });
    const updated = await db.socialLink.findUniqueOrThrow({ where: { platform: "tiktok" } });
    expect(updated.label).toBe("TikTok HQ");
    expect(updated.isActive).toBe(false);

    await admin.deleteSocialLink(actor.id, "tiktok");
    expect(await db.socialLink.findUnique({ where: { platform: "tiktok" } })).toBeNull();

    for (const action of ["social.create", "social.update", "social.delete"]) {
      expect(await db.auditLog.count({ where: { action, entityId: "tiktok" } })).toBe(1);
    }
  });
});

// ─── Notifications (ADR-014) ─────────────────────────────────

describe("notifications", () => {
  it("write → list → unread count → mark-read, scoped to the recipient", async () => {
    const alice = await createUser(`alice-${Date.now()}@x.com`);
    const mallory = await createUser(`mallory-${Date.now()}@x.com`);

    await notifications.recordNotification({
      userId: alice.id,
      type: "roleAssigned",
      detail: "Editor",
      href: "/admin/profile",
    });
    expect(await notifications.countUnreadNotifications(alice.id)).toBe(1);
    const [row] = await notifications.listNotifications(alice.id);
    expect(row?.type).toBe("roleAssigned");
    expect(row?.detail).toBe("Editor");

    // A foreign user marking someone else's notification is a silent no-op.
    await notifications.markNotificationRead(mallory.id, row!.id);
    expect(await notifications.countUnreadNotifications(alice.id)).toBe(1);

    await notifications.markNotificationRead(alice.id, row!.id);
    expect(await notifications.countUnreadNotifications(alice.id)).toBe(0);
  });

  it("assignRole notifies a STAFF target but not a LEARNER", async () => {
    const actor = await actorSubject(80, ["permissions.assign"]);
    const staff = await createUser(`staff-${Date.now()}@x.com`, "STAFF");
    const learner = await createUser(`learner-${Date.now()}@x.com`, "LEARNER");

    await users.assignRole(actor, staff.id, "plain");
    await users.assignRole(actor, learner.id, "plain");

    expect(await db.notification.count({ where: { userId: staff.id, type: "roleAssigned" } })).toBe(
      1,
    );
    expect(await db.notification.count({ where: { userId: learner.id } })).toBe(0);
  });
});

// ─── Password reset bookkeeping ──────────────────────────────

describe("recordPasswordReset", () => {
  it("revokes every session, audits, and notifies the staff target", async () => {
    const actor = await actorSubject(80, ["users.password.reset"]);
    const target = await createUser(`reset-${Date.now()}@x.com`);
    await db.session.create({
      data: {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        userId: target.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await users.recordPasswordReset(actor, target.id);

    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    expect(
      await db.auditLog.count({ where: { action: "users.passwordReset", entityId: target.id } }),
    ).toBe(1);
    expect(
      await db.notification.count({ where: { userId: target.id, type: "passwordReset" } }),
    ).toBe(1);
  });
});

// ─── Employees ───────────────────────────────────────────────

describe("setEmployeeStatus", () => {
  it("changes status with audit, and refuses to touch a TERMINATED employee", async () => {
    const actor = await actorSubject(80, ["employees.update"]);
    const employee = await db.employee.create({
      data: {
        employeeCode: `E-${Date.now()}`,
        firstName: "Pat",
        lastName: "Doe",
        workEmail: `pat-${Date.now()}@work.com`,
        joinedAt: new Date(),
      },
    });

    await employees.setEmployeeStatus(actor.id, employee.id, "ON_LEAVE");
    expect((await db.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe(
      "ON_LEAVE",
    );
    expect(
      await db.auditLog.count({ where: { action: "employees.setStatus", entityId: employee.id } }),
    ).toBe(1);

    await db.employee.update({ where: { id: employee.id }, data: { status: "TERMINATED" } });
    await expect(employees.setEmployeeStatus(actor.id, employee.id, "ACTIVE")).rejects.toThrow(
      /terminated/i,
    );
  });
});

describe("loadEmployeeDetail", () => {
  it("returns the linked user with role keys, null for soft-deleted", async () => {
    const account = await createUser(`emp-acct-${Date.now()}@x.com`);
    const role = await db.role.findUniqueOrThrow({ where: { key: "plain" } });
    await db.userRole.create({ data: { userId: account.id, roleId: role.id } });
    const employee = await db.employee.create({
      data: {
        employeeCode: `E2-${Date.now()}`,
        firstName: "Lee",
        lastName: "Ray",
        workEmail: `lee-${Date.now()}@work.com`,
        joinedAt: new Date(),
        userId: account.id,
      },
    });

    const detail = await employees.loadEmployeeDetail(employee.id);
    expect(detail?.linkedUser?.email).toBe(account.email);
    expect(detail?.linkedUser?.roleKeys).toContain("plain");

    await db.employee.update({ where: { id: employee.id }, data: { deletedAt: new Date() } });
    expect(await employees.loadEmployeeDetail(employee.id)).toBeNull();
  });
});

// ─── Own profile ─────────────────────────────────────────────

describe("updateOwnProfile", () => {
  it("writes name/phone and audits under the user's own id", async () => {
    const me = await createUser(`me-${Date.now()}@x.com`);
    await users.updateOwnProfile(me.id, { name: "New Name", phone: "+123456" });
    const row = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(row.name).toBe("New Name");
    expect(row.phone).toBe("+123456");
    expect(
      await db.auditLog.count({
        where: { action: "users.profileUpdate", userId: me.id, entityId: me.id },
      }),
    ).toBe(1);
  });
});

// ─── Admin search ────────────────────────────────────────────

describe("searchAdmin", () => {
  it("only returns sections the subject can() see", async () => {
    await createUser(`findme-searchable@x.com`);
    const full = await actorSubject(80, [
      "users.view",
      "roles.view",
      "employees.view",
      "settings.view",
      "glossary.view",
    ]);
    const limited = await actorSubject(80, ["roles.view"]);

    const fullResults = await search.searchAdmin(full, "findme");
    expect(fullResults.users.some((hit) => hit.sublabel === "findme-searchable@x.com")).toBe(true);

    const limitedResults = await search.searchAdmin(limited, "findme");
    expect(limitedResults.users).toEqual([]);

    const roleHits = await search.searchAdmin(limited, "Plain");
    expect(roleHits.roles.some((hit) => hit.sublabel === "plain")).toBe(true);
  });

  it("returns nothing for a blank query", async () => {
    const full = await actorSubject(80, ["users.view"]);
    const results = await search.searchAdmin(full, "   ");
    expect(results.users).toEqual([]);
  });
});
