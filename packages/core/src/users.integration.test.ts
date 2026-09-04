// Module 10 required tests against real MariaDB: escalation rejected with
// NO write, last-super_admin protections, permission overrides with
// required reason, server-side pagination/sort for the DataTable contract,
// and offboarding atomicity with fault injection.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as UsersModule from "./users.ts";
import type * as EmployeesModule from "./employees.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let users: typeof UsersModule;
let employees: typeof EmployeesModule;

// AuditLog.userId is a real FK — actor subjects must be backed by real
// user rows (a fake id fails the constraint, which is itself a good sign:
// audit rows can't reference ghosts).
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
  employees = await import("./employees.ts");

  await db.role.createMany({
    data: [
      { key: "super_admin", name: "Super Admin", level: 100 },
      { key: "admin", name: "Admin", level: 80 },
      { key: "editor", name: "Editor", level: 40 },
    ],
  });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("assignRole — escalation guard (strict <)", () => {
  it("an Editor-level actor granting an Admin-level role is rejected AND nothing is written", async () => {
    const target = await createUser(`t1-${Date.now()}@x.com`);
    const editor = await actorSubject(40, ["permissions.assign"]);

    await expect(users.assignRole(editor, target.id, "admin")).rejects.toThrow(
      users.RoleLevelError,
    );
    expect(await db.userRole.count({ where: { userId: target.id } })).toBe(0);
    expect(
      await db.auditLog.count({ where: { entityId: target.id, action: "roles.assign" } }),
    ).toBe(0);
  });

  it("an equal-level grant is rejected too (strict <, not <=)", async () => {
    const target = await createUser(`t2-${Date.now()}@x.com`);
    const editor = await actorSubject(40, ["permissions.assign"]);
    await expect(users.assignRole(editor, target.id, "editor")).rejects.toThrow(
      users.RoleLevelError,
    );
  });

  it("a higher-level actor CAN grant a lower role, and it lands with an audit row", async () => {
    const target = await createUser(`t3-${Date.now()}@x.com`);
    const admin = await actorSubject(80, ["permissions.assign"]);
    await users.assignRole(admin, target.id, "editor");
    expect(await db.userRole.count({ where: { userId: target.id } })).toBe(1);
    await expect(
      db.auditLog.findFirstOrThrow({ where: { entityId: target.id, action: "roles.assign" } }),
    ).resolves.toBeTruthy();
  });
});

describe("last super_admin protections", () => {
  it("removing the only super_admin's role is blocked; deactivating them is blocked; both allowed once a second one exists", async () => {
    const sa1 = await createUser(`sa1-${Date.now()}@x.com`);
    const saRole = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
    await db.userRole.create({ data: { userId: sa1.id, roleId: saRole.id } });
    const superActor = await actorSubject(100, [], ["super_admin"]);

    await expect(users.removeRole(superActor, sa1.id, "super_admin")).rejects.toThrow(
      users.LastSuperAdminError,
    );
    await expect(users.setUserStatus(superActor, sa1.id, "SUSPENDED")).rejects.toThrow(
      users.LastSuperAdminError,
    );

    const sa2 = await createUser(`sa2-${Date.now()}@x.com`);
    await db.userRole.create({ data: { userId: sa2.id, roleId: saRole.id } });
    await users.removeRole(superActor, sa1.id, "super_admin");
    expect(await db.userRole.count({ where: { userId: sa1.id, roleId: saRole.id } })).toBe(0);
  });
});

describe("setUserStatus — deactivation revokes sessions", () => {
  it("suspending a user deletes their sessions in the same operation", async () => {
    const target = await createUser(`t4-${Date.now()}@x.com`);
    await db.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: target.id,
        token: `tok-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const superActor = await actorSubject(100, [], ["super_admin"]);
    await users.setUserStatus(superActor, target.id, "SUSPENDED");
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
  });
});

describe("permission overrides", () => {
  it("requires a reason; a DENY override lands with the reason audited", async () => {
    const target = await createUser(`t5-${Date.now()}@x.com`);
    await db.permission.upsert({
      where: { key: "courses.delete" },
      update: {},
      create: { key: "courses.delete", groupName: "content", label: "Delete courses" },
    });
    const superActor = await actorSubject(100, [], ["super_admin"]);

    await expect(
      users.setPermissionOverride(superActor, target.id, "courses.delete", "DENY", "  "),
    ).rejects.toThrow(/reason/i);

    await users.setPermissionOverride(
      superActor,
      target.id,
      "courses.delete",
      "DENY",
      "Incident #42 — revoked pending review",
    );
    const override = await db.userPermission.findFirstOrThrow({ where: { userId: target.id } });
    expect(override.effect).toBe("DENY");
    expect(override.reason).toContain("Incident #42");
    const audit = await db.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: "permissions.override" },
    });
    expect(JSON.stringify(audit.changes)).toContain("Incident #42");
  });
});

describe("listUsers — server-driven DataTable contract", () => {
  it("paginates, sorts, and filters server-side against seeded fixtures", async () => {
    const stamp = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.user.create({
        data: {
          id: crypto.randomUUID(),
          email: `page-${stamp}-${i}@fixture.com`,
          name: `Fixture ${i}`,
          status: "ACTIVE",
          userType: "LEARNER",
        },
      });
    }

    const page1 = await users.listUsers({
      page: 0,
      pageSize: 2,
      search: `page-${stamp}`,
      sortBy: "email",
      sortDir: "asc",
    });
    expect(page1.total).toBe(5);
    expect(page1.pageCount).toBe(3);
    expect(page1.rows.map((r) => r.email)).toEqual([
      `page-${stamp}-0@fixture.com`,
      `page-${stamp}-1@fixture.com`,
    ]);

    const page3 = await users.listUsers({
      page: 2,
      pageSize: 2,
      search: `page-${stamp}`,
      sortBy: "email",
      sortDir: "asc",
    });
    expect(page3.rows).toHaveLength(1);

    const staffOnly = await users.listUsers({
      page: 0,
      pageSize: 10,
      search: `page-${stamp}`,
      userType: "STAFF",
    });
    expect(staffOnly.total).toBe(0);
  });
});

describe("offboardEmployee — atomicity with fault injection", () => {
  async function fixture() {
    const actor = await createUser(`offactor-${Date.now()}-${Math.random()}@x.com`);
    const user = await createUser(`emp-${Date.now()}-${Math.random()}@x.com`);
    await db.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: `tok-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const employee = await db.employee.create({
      data: {
        userId: user.id,
        employeeCode: `E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        firstName: "Jo",
        lastName: "Doe",
        workEmail: `w-${Date.now()}-${Math.random()}@x.com`,
        joinedAt: new Date(),
        status: "ACTIVE",
      },
    });
    return { actor, user, employee };
  }

  it("happy path: employee TERMINATED + user INACTIVE + sessions gone + audit row, in one transaction", async () => {
    const { actor, user, employee } = await fixture();
    await employees.offboardEmployee(actor.id, employee.id);

    expect((await db.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe(
      "TERMINATED",
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("INACTIVE");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(
      db.auditLog.findFirstOrThrow({
        where: { action: "employees.offboard", entityId: employee.id },
      }),
    ).resolves.toBeTruthy();
  });

  it("fault injection: a failure after the status writes rolls EVERYTHING back — employee stays ACTIVE, user stays ACTIVE, sessions intact, no audit row", async () => {
    const { actor, user, employee } = await fixture();

    await expect(
      employees.offboardEmployee(actor.id, employee.id, () => {
        throw new Error("injected revocation failure");
      }),
    ).rejects.toThrow("injected revocation failure");

    expect((await db.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe(
      "ACTIVE",
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await db.auditLog.count({ where: { action: "employees.offboard", entityId: employee.id } }),
    ).toBe(0);
  });
});
