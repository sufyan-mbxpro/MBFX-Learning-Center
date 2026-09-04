// The guarded settings-write composition (ADR-011 pattern): a Server
// Action call site does requirePermission → updateSetting → recordAudit.
// This test lives in @repo/core — the one package that legally depends on
// settings + rbac both (architecture.md #8; a settings devDependency on
// core created a turbo task-graph cycle once core depended on settings).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as RbacModule from "@repo/rbac";
import type * as CoreModule from "./index.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let rbac: typeof RbacModule;
let core: typeof CoreModule;

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
  rbac = await import("@repo/rbac");
  core = await import("./index.ts");
}, 120_000);

afterEach(() => {
  vi.doUnmock("next/cache");
  vi.resetModules();
});

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("guarded settings write — audit row on every write", () => {
  it("can(settings.update) → updateSetting → recordAudit: write lands, audit row is durable with before/after", async () => {
    const role = await db.role.create({
      data: { key: `settings-editor-${Date.now()}`, name: "Settings Editor", level: 10 },
    });
    const permission = await db.permission.upsert({
      where: { key: "settings.update" },
      update: {},
      create: { key: "settings.update", groupName: "settings", label: "Edit settings" },
    });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });

    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `editor-${Date.now()}@example.com`,
        name: "Editor",
        status: "ACTIVE",
        userType: "STAFF",
      },
    });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });

    await db.setting.upsert({
      where: { key: "layout.showBreadcrumbs" },
      update: { value: true },
      create: {
        key: "layout.showBreadcrumbs",
        groupName: "layout",
        value: true,
        type: "BOOLEAN",
        label: "Show breadcrumbs",
        isPublic: true,
      },
    });

    const subject = await rbac.loadSubject(user.id);
    expect(rbac.can(subject, "settings.update")).toBe(true);

    // next/cache is stubbed config-wide (vitest.config.ts alias) — no
    // per-test mock needed for the transitive @repo/settings import.
    const settings = await import("@repo/settings");

    const result = await settings.updateSetting("layout.showBreadcrumbs", false, user.id);
    await core.recordAudit({
      userId: user.id,
      action: "settings.update",
      entityType: "setting",
      entityId: "layout.showBreadcrumbs",
      changes: { before: result.before, after: result.after },
    });

    const auditRow = await db.auditLog.findFirstOrThrow({
      where: { action: "settings.update", entityId: "layout.showBreadcrumbs", userId: user.id },
    });
    expect(auditRow.changes).toEqual({ before: true, after: false });
  });
});
