// Shared Testcontainers bootstrap for Module 16's cms/* integration test
// files. The rest of this package intentionally repeats this boilerplate
// per file (articles.integration.test.ts, db.integration.test.ts, ...) to
// keep each file's setup self-contained and greppable; factored out here
// because four cms/* files need the identical thing, not as a general rule.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";

const dbPackageRoot = fileURLToPath(new URL("../../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

export interface CmsTestContext {
  container: StartedMariaDbContainer;
  db: typeof DbClient;
}

export async function startCmsTestDb(): Promise<CmsTestContext> {
  const container = await new MariaDbContainer("mariadb:11.4")
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
  const db = (await import("@repo/db")).db;
  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });

  return { container, db };
}

export async function stopCmsTestDb(ctx: CmsTestContext): Promise<void> {
  await ctx.db.$disconnect();
  await ctx.container.stop();
}

/**
 * A Subject with exactly `permissions`, backed by a real `User` row.
 * `Page.createdById`/`updatedById`/`PageVersion.authorId` are plain string
 * columns with no FK (see the schema comment above the CMS models) and
 * would accept any string — but `recordAudit()`'s `AuditLog.userId` DOES
 * have a real FK to `User`, and every cms/* mutation calls it, so the
 * actor has to exist for real or every mutation in these tests 500s on
 * its own audit write.
 */
export async function makeActor(
  db: CmsTestContext["db"],
  id: string,
  permissions: string[],
): Promise<Subject> {
  await db.user.create({
    data: { id, email: `${id}@cms-test.example`, name: id, userType: "STAFF", status: "ACTIVE" },
  });
  return {
    id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 50,
    allowed: new Set(permissions),
    denied: new Set(),
  };
}

export const ALL_CMS_PERMISSIONS = [
  "cms.pages.view",
  "cms.pages.create",
  "cms.pages.update",
  "cms.pages.delete",
  "cms.pages.publish",
  "cms.parts.publish",
  "redirects.manage",
];
