// Real-MariaDB integration tests (testing.md: mocking Prisma hides FK and
// constraint bugs — don't). `loadSubject` is tested directly rather than
// `getSubject` — ADR-004: Next's "use cache" directive is a compiler
// transform that's inert outside a real Next.js build/dev process, so a
// Vitest-only run can't exercise the cache layer itself. What's verified
// here is the data path `invalidateSubject`'s tag is meant to invalidate:
// that a role/permission mutation is immediately visible on the next load.
// Tests that go through `requirePermission` (which does call `getSubject`)
// mock `next/cache`'s `cacheTag`/`cacheLife` — those throw outside a real
// `cacheComponents` context rather than silently no-op (ADR-004) — so the
// test exercises requirePermission's actual logic, not that unrelated guard.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as RbacModule from "./index.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
// Populated after DATABASE_URL is set and @repo/db's lazy singleton is safe to import.
let db: typeof DbClient;
let rbac: typeof RbacModule;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  // @testcontainers/mariadb returns a `mariadb://` scheme; Prisma's `mysql`
  // datasource provider (and @prisma/adapter-mariadb) only recognize `mysql://`.
  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  // @repo/db's client is lazy (built on first property access) specifically
  // so setting DATABASE_URL right before first use, like this, works.
  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  rbac = await import("./index.ts");
}, 120_000);

afterEach(() => {
  vi.doUnmock("@repo/auth");
  vi.doUnmock("next/cache");
  vi.resetModules();
});

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

async function seedRolePermission(roleKey: string, level: number, permissionKeys: string[]) {
  const role = await db.role.create({ data: { key: roleKey, name: roleKey, level } });
  for (const key of permissionKeys) {
    const permission = await db.permission.upsert({
      where: { key },
      update: {},
      create: { key, groupName: "test", label: key },
    });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }
  return role;
}

describe("loadSubject", () => {
  it("returns null for a deleted user", async () => {
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `deleted-${Date.now()}@example.com`,
        name: "Deleted",
        status: "ACTIVE",
        deletedAt: new Date(),
      },
    });
    await expect(rbac.loadSubject(user.id)).resolves.toBeNull();
  });

  it("returns null for an inactive (non-ACTIVE status) user", async () => {
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `inactive-${Date.now()}@example.com`,
        name: "Inactive",
        status: "SUSPENDED",
      },
    });
    await expect(rbac.loadSubject(user.id)).resolves.toBeNull();
  });

  it("aggregates role permissions and reflects role level, and picks it up on the next load after a mutation", async () => {
    const role = await seedRolePermission(`role-${Date.now()}`, 42, [`content.view.${Date.now()}`]);
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `staff-${Date.now()}@example.com`,
        name: "Staff",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const before = await rbac.loadSubject(user.id);
    expect(before?.maxRoleLevel).toBe(42);
    expect(before?.roleKeys).toContain(role.key);

    // Mutate — the exact write invalidateSubject's tag is meant to cover —
    // and confirm the next load reflects it immediately.
    await db.userRole.delete({ where: { userId_roleId: { userId: user.id, roleId: role.id } } });
    const after = await rbac.loadSubject(user.id);
    expect(after?.maxRoleLevel).toBe(0);
    expect(after?.roleKeys).not.toContain(role.key);
  });

  it("a per-user DENY override wins over a role grant", async () => {
    const permKey = `deny-test.${Date.now()}`;
    const role = await seedRolePermission(`role-deny-${Date.now()}`, 10, [permKey]);
    const permission = await db.permission.findUniqueOrThrow({ where: { key: permKey } });
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `deny-${Date.now()}@example.com`,
        name: "Denied",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await db.userPermission.create({
      data: { userId: user.id, permissionId: permission.id, effect: "DENY" },
    });

    const subject = await rbac.loadSubject(user.id);
    expect(rbac.can(subject, permKey)).toBe(false);
  });
});

describe("requirePermission / requireAnyPermission — the real enforcement boundary", () => {
  // getSubject's "use cache" scope calls cacheTag()/cacheLife() (ADR-004),
  // which throw outside a real Next.js cacheComponents context — including
  // under Vitest. Mocked here as no-ops so these tests exercise
  // requirePermission's actual logic (auth resolution, permission
  // evaluation) rather than failing on an unrelated Next.js runtime guard.
  function mockNextCache() {
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
  }

  it("throws UnauthenticatedError when there is no session", async () => {
    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => null }));
    const fresh = await import("./index.ts");
    await expect(fresh.requirePermission("anything")).rejects.toBeInstanceOf(
      fresh.UnauthenticatedError,
    );
  });

  it("throws ForbiddenError when the session's subject lacks the permission", async () => {
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `forbidden-${Date.now()}@example.com`,
        name: "Nobody",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => ({ user: { id: user.id } }) }));
    const fresh = await import("./index.ts");
    await expect(fresh.requirePermission("nonexistent.permission")).rejects.toBeInstanceOf(
      fresh.ForbiddenError,
    );
  });

  it("returns the subject when the session's subject has the permission", async () => {
    const permKey = `enforce-test.${Date.now()}`;
    const role = await seedRolePermission(`role-enforce-${Date.now()}`, 10, [permKey]);
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `enforced-${Date.now()}@example.com`,
        name: "Someone",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => ({ user: { id: user.id } }) }));
    const fresh = await import("./index.ts");
    const subject = await fresh.requirePermission(permKey);
    expect(subject.id).toBe(user.id);
  });

  it("requireAnyPermission succeeds if the subject has at least one of the listed permissions", async () => {
    const permKey = `any-test.${Date.now()}`;
    const role = await seedRolePermission(`role-any-${Date.now()}`, 10, [permKey]);
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `any-${Date.now()}@example.com`,
        name: "Any",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => ({ user: { id: user.id } }) }));
    const fresh = await import("./index.ts");
    const subject = await fresh.requireAnyPermission(["nonexistent.permission", permKey]);
    expect(subject.id).toBe(user.id);
  });

  it("requireAnyPermission throws ForbiddenError if none of the listed permissions match", async () => {
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `any-forbidden-${Date.now()}@example.com`,
        name: "AnyForbidden",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => ({ user: { id: user.id } }) }));
    const fresh = await import("./index.ts");
    await expect(
      fresh.requireAnyPermission(["nonexistent.one", "nonexistent.two"]),
    ).rejects.toBeInstanceOf(fresh.ForbiddenError);
  });
});

describe("Can — UI gate (presentation only; requirePermission is the real boundary)", () => {
  const mockNextCache = () =>
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));

  it("renders fallback when there is no session", async () => {
    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => null }));
    const fresh = await import("./index.ts");
    const result = await fresh.Can({ permission: "anything", children: "yes", fallback: "no" });
    expect(result).toBe("no");
  });

  it("renders children when permission matches, fallback otherwise", async () => {
    const permKey = `can-test.${Date.now()}`;
    const role = await seedRolePermission(`role-can-${Date.now()}`, 10, [permKey]);
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `can-${Date.now()}@example.com`,
        name: "Can",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

    mockNextCache();
    vi.doMock("@repo/auth", () => ({ auth: async () => ({ user: { id: user.id } }) }));
    const fresh = await import("./index.ts");

    expect(await fresh.Can({ permission: permKey, children: "yes", fallback: "no" })).toBe("yes");
    expect(await fresh.Can({ permission: "not-granted", children: "yes", fallback: "no" })).toBe(
      "no",
    );
    expect(await fresh.Can({ anyOf: [permKey], children: "yes", fallback: "no" })).toBe("yes");
  });
});
