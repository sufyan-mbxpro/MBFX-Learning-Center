// Real-MariaDB integration test (testing.md: mocking Prisma hides FK and
// constraint bugs — don't).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import { recordAudit } from "./index.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;

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
  ({ db } = await import("@repo/db"));
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("recordAudit", () => {
  it("writes an AuditLog row with the before/after payload (ADR-011: lives in @repo/core, not @repo/rbac)", async () => {
    await recordAudit({
      userId: null,
      action: "theme.update",
      entityType: "theme",
      entityId: "theme-1",
      changes: { before: { primary: "black" }, after: { primary: "white" } },
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    const row = await db.auditLog.findFirstOrThrow({
      where: { action: "theme.update", entityId: "theme-1" },
    });
    expect(row.changes).toEqual({ before: { primary: "black" }, after: { primary: "white" } });
    expect(row.ipAddress).toBe("127.0.0.1");
  });

  it("accepts a null userId (a system action, not tied to a signed-in actor)", async () => {
    await expect(
      recordAudit({ userId: null, action: "system.maintenance" }),
    ).resolves.not.toThrow();
  });
});
