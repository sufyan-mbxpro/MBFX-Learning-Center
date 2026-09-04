// Real-MariaDB integration tests (testing.md: mocking Prisma hides FK and
// constraint bugs — don't). One Testcontainers instance for the whole file;
// migrations apply once in beforeAll, and each describe block uses
// business keys scoped to itself so tests don't collide with each other's
// fixture data.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "../prisma/seed.ts";
import { PrismaClient } from "./generated/client/client.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: PrismaClient;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  // @testcontainers/mariadb returns a `mariadb://` scheme; Prisma's `mysql`
  // datasource provider (and @prisma/adapter-mariadb) only recognize `mysql://`.
  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");

  // "Migrations apply cleanly from zero" (SKILL.md) — this *is* the test;
  // execFileSync throws on a non-zero exit.
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  db = new PrismaClient({ adapter: new PrismaMariaDb(url) });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("seed idempotency", () => {
  it("produces identical row counts on a second run, and preserves an admin-edited Setting.value", async () => {
    await seed(db);

    const countsAfterFirst = await Promise.all([
      db.permission.count(),
      db.role.count(),
      db.locale.count(),
      db.setting.count(),
      db.featureFlag.count(),
      db.socialLink.count(),
      db.department.count(),
      db.designation.count(),
      db.menuItem.count(),
    ]);

    // Simulate an admin editing a setting's value in the admin UI.
    await db.setting.update({
      where: { key: "site.name" },
      data: { value: "Admin-Edited Site Name" },
    });

    await seed(db);

    const countsAfterSecond = await Promise.all([
      db.permission.count(),
      db.role.count(),
      db.locale.count(),
      db.setting.count(),
      db.featureFlag.count(),
      db.socialLink.count(),
      db.department.count(),
      db.designation.count(),
      db.menuItem.count(),
    ]);

    expect(countsAfterSecond).toEqual(countsAfterFirst);

    const siteName = await db.setting.findUniqueOrThrow({ where: { key: "site.name" } });
    expect(siteName.value).toBe("Admin-Edited Site Name");
  });
});

describe("FK integrity", () => {
  it("cascades a Course delete to its translations", async () => {
    const course = await db.course.create({
      data: {
        translations: {
          create: { locale: "en", title: "FK Test Course", slug: "fk-test-course" },
        },
      },
    });

    await db.course.delete({ where: { id: course.id } });

    const translations = await db.courseTranslation.findMany({ where: { courseId: course.id } });
    expect(translations).toHaveLength(0);
  });

  it("SetNulls Employee.departmentId when the department is deleted", async () => {
    const department = await db.department.create({
      data: { key: "fk-test-dept", name: "FK Test Department" },
    });
    const employee = await db.employee.create({
      data: {
        employeeCode: "FK-TEST-001",
        firstName: "FK",
        lastName: "Test",
        workEmail: "fk-test@example.com",
        joinedAt: new Date(),
        departmentId: department.id,
      },
    });

    await db.department.delete({ where: { id: department.id } });

    const reloaded = await db.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(reloaded.departmentId).toBeNull();
  });
});

describe("unique constraints", () => {
  it("rejects a (locale, slug) collision across two different lessons", async () => {
    const module_ = await db.module.create({
      data: {
        course: {
          create: {
            translations: {
              create: { locale: "en", title: "Slug Test", slug: "slug-test-course" },
            },
          },
        },
      },
    });

    await db.lesson.create({
      data: {
        moduleId: module_.id,
        translations: {
          create: { locale: "en", title: "First", slug: "duplicate-slug" },
        },
      },
    });

    await expect(
      db.lesson.create({
        data: {
          moduleId: module_.id,
          translations: {
            create: { locale: "en", title: "Second", slug: "duplicate-slug" },
          },
        },
      }),
    ).rejects.toThrow();
  });
});

describe("soft-delete convention", () => {
  it("excludes deletedAt rows from a fixture query scoped to non-deleted content", async () => {
    const module_ = await db.module.create({
      data: {
        course: {
          create: {
            translations: {
              create: { locale: "en", title: "Soft Delete Test", slug: "soft-delete-test" },
            },
          },
        },
      },
    });

    const lesson = await db.lesson.create({
      data: {
        moduleId: module_.id,
        translations: { create: { locale: "en", title: "Doomed", slug: "soft-delete-lesson" } },
      },
    });

    await db.lesson.update({ where: { id: lesson.id }, data: { deletedAt: new Date() } });

    const visible = await db.lesson.findMany({
      where: { moduleId: module_.id, deletedAt: null },
    });
    expect(visible.map((l) => l.id)).not.toContain(lesson.id);

    const withDeleted = await db.lesson.findMany({ where: { moduleId: module_.id } });
    expect(withDeleted.map((l) => l.id)).toContain(lesson.id);
  });
});
