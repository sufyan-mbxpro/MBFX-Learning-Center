// Real-MariaDB integration tests (testing.md: mocking Prisma hides FK and
// constraint bugs — don't). One Testcontainers instance for the whole file;
// migrations apply once in beforeAll, and each describe block uses
// business keys scoped to itself so tests don't collide with each other's
// fixture data.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
      db.page.count(),
      db.pageTranslation.count(),
      db.pageVersion.count(),
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
      db.page.count(),
      db.pageTranslation.count(),
      db.pageVersion.count(),
    ]);

    expect(countsAfterSecond).toEqual(countsAfterFirst);

    const siteName = await db.setting.findUniqueOrThrow({ where: { key: "site.name" } });
    expect(siteName.value).toBe("Admin-Edited Site Name");
    // Two full seeds against a fresh container, and the seed's cost is
    // dominated by Argon2id hashing (deliberately slow) rather than by row
    // count. It measured ~80s here once changes-09 added the About menu, so
    // the default 60s budget was already marginal — this timeout buys room
    // without weakening what the test asserts.
  }, 180_000);

  // STALE-TEST FIX (changes-07 PR 2). This asserted plan v2.2 PR 1.1's
  // behaviour — home seeded as an unpublished DRAFT with an empty layout — but
  // PR 2.7 changed the seed to publish it with a real layout and never updated
  // this test, so it had been failing since 2026-09-05. The seed is
  // authoritative; the assertions are corrected to match it.
  //
  // What the published row MEANS has changed twice since, and neither change
  // is this test's business: ADR-042 cancelled the Website Builder, and
  // changes-07 PR 0 removed `renderCmsHome()`, so `[locale]/page.tsx` now
  // serves "/" from `_sections/registry.ts` regardless of this row. It is
  // retained-but-unrendered data (ADR-042 Decision #2). Whether the seed
  // should stop publishing it at all is ADR-042 open decision #3, tracked in
  // changes-07-plan.md §10.4 — deliberately NOT settled here.
  it("seeds the `home` page as a published STATIC page (plan v2.2 PR 2.7)", async () => {
    const home = await db.page.findUniqueOrThrow({
      where: { key: "home" },
      include: { translations: true, versions: true },
    });
    expect(home.kind).toBe("STATIC");
    expect(home.status).toBe("PUBLISHED");
    expect(home.publishedVersionId).not.toBeNull();
    expect(home.draftVersionId).not.toBeNull();

    expect(home.translations).toHaveLength(1);
    expect(home.translations[0]).toMatchObject({ locale: "en", slug: "", path: "/" });

    // Draft (number 0) + published (number 1), both carrying the real layout.
    expect(home.versions).toHaveLength(2);
    const draft = home.versions.find((v) => v.id === home.draftVersionId);
    const published = home.versions.find((v) => v.id === home.publishedVersionId);
    expect(draft).toMatchObject({ number: 0, revision: 0 });
    expect(published).toMatchObject({ number: 1, revision: 0 });
    // Not the empty `{version:1,nodes:[]}` placeholder PR 1.1 seeded.
    expect((published?.layout as { nodes: unknown[] }).nodes.length).toBeGreaterThan(0);
  });
});

describe("CMS page model (Module 16, ADR-021 / ADR-032 §6 / ADR-033 §4)", () => {
  async function createPage(key: string, parentId?: string) {
    return db.page.create({ data: { key, createdById: "test", parentId } });
  }

  it("rejects a (locale, path) collision across two pages", async () => {
    const a = await createPage("cms-collision-a");
    const b = await createPage("cms-collision-b");
    await db.pageTranslation.create({
      data: { pageId: a.id, locale: "en", title: "A", slug: "about", path: "/about" },
    });
    await expect(
      db.pageTranslation.create({
        data: { pageId: b.id, locale: "en", title: "B", slug: "about", path: "/about" },
      }),
    ).rejects.toThrow();
  });

  it("cascades a Page delete to its translations and versions", async () => {
    const page = await createPage("cms-cascade");
    await db.pageTranslation.create({
      data: { pageId: page.id, locale: "en", title: "X", slug: "cascade", path: "/cascade" },
    });
    await db.pageVersion.create({
      data: { pageId: page.id, number: 0, layout: { version: 1, nodes: [] }, authorId: "test" },
    });

    await db.page.delete({ where: { id: page.id } });

    expect(await db.pageTranslation.count({ where: { pageId: page.id } })).toBe(0);
    expect(await db.pageVersion.count({ where: { pageId: page.id } })).toBe(0);
  });

  it("SetNulls children.parentId when the parent page is deleted", async () => {
    const parent = await createPage("cms-parent");
    const child = await createPage("cms-child", parent.id);

    await db.page.delete({ where: { id: parent.id } });

    const reloaded = await db.page.findUniqueOrThrow({ where: { id: child.id } });
    expect(reloaded.parentId).toBeNull();
  });

  it("enforces (pageId, number) uniqueness — one draft row per page", async () => {
    const page = await createPage("cms-one-draft");
    await db.pageVersion.create({
      data: { pageId: page.id, number: 0, layout: { version: 1, nodes: [] }, authorId: "test" },
    });
    await expect(
      db.pageVersion.create({
        data: { pageId: page.id, number: 0, layout: { version: 1, nodes: [] }, authorId: "test" },
      }),
    ).rejects.toThrow();
  });

  // The CHECK constraints below live in the migration SQL only (Prisma
  // cannot express them) — these tests are what keeps them from being lost
  // in a future migration. There is deliberately no self-parent CHECK:
  // MariaDB refuses CHECK constraints on FK-governed columns (error 1901),
  // so the cycle guard is service-level (plan §5.1 rule 5, PR 1.3).
  it("CHECK: a translation path must start with '/'", async () => {
    const page = await createPage("cms-bad-path");
    await expect(
      db.pageTranslation.create({
        data: { pageId: page.id, locale: "en", title: "Bad", slug: "bad", path: "bad" },
      }),
    ).rejects.toThrow();
  });

  it("CHECK: version number and revision are never negative", async () => {
    const page = await createPage("cms-negative");
    await expect(
      db.pageVersion.create({
        data: { pageId: page.id, number: -1, layout: { version: 1, nodes: [] }, authorId: "t" },
      }),
    ).rejects.toThrow();
    await expect(
      db.pageVersion.create({
        data: {
          pageId: page.id,
          number: 0,
          revision: -1,
          layout: { version: 1, nodes: [] },
          authorId: "t",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate ContentReference row for one (source, target, field)", async () => {
    const row = {
      sourceType: "PAGE_VERSION" as const,
      sourceId: "v1",
      refType: "MEDIA" as const,
      refId: "asset-1",
      field: "props.image",
    };
    await db.contentReference.create({ data: row });
    await expect(db.contentReference.create({ data: row })).rejects.toThrow();
  });
});

describe("FK integrity", () => {
  it("cascades a Course delete to its translations", async () => {
    const course = await db.course.create({
      data: {
        track: "forex",
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
    const section = await db.courseSection.create({
      data: {
        course: {
          create: {
            track: "forex",
            translations: {
              create: { locale: "en", title: "Slug Test", slug: "slug-test-course" },
            },
          },
        },
      },
    });

    await db.lesson.create({
      data: {
        sectionId: section.id,
        translations: {
          create: { locale: "en", title: "First", slug: "duplicate-slug" },
        },
      },
    });

    await expect(
      db.lesson.create({
        data: {
          sectionId: section.id,
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
    const section = await db.courseSection.create({
      data: {
        course: {
          create: {
            track: "forex",
            translations: {
              create: { locale: "en", title: "Soft Delete Test", slug: "soft-delete-test" },
            },
          },
        },
      },
    });

    const lesson = await db.lesson.create({
      data: {
        sectionId: section.id,
        translations: { create: { locale: "en", title: "Doomed", slug: "soft-delete-lesson" } },
      },
    });

    await db.lesson.update({ where: { id: lesson.id }, data: { deletedAt: new Date() } });

    const visible = await db.lesson.findMany({
      where: { sectionId: section.id, deletedAt: null },
    });
    expect(visible.map((l) => l.id)).not.toContain(lesson.id);

    const withDeleted = await db.lesson.findMany({ where: { sectionId: section.id } });
    expect(withDeleted.map((l) => l.id)).toContain(lesson.id);
  });
});

describe("data migration — home promotions band (changes-52, ADR-167)", () => {
  const migration = readFileSync(
    fileURLToPath(
      new URL(
        "../prisma/migrations/20260929120000_home_promotions_band_changes52/migration.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  // The file is one UPDATE after its comments; run it the way `migrate deploy` would.
  const statement = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();

  type Entry = { key: string; enabled: boolean; order: number };
  const sections = async () =>
    (await db.setting.findUniqueOrThrow({ where: { key: "home.sections" } })).value as Entry[];

  it("appends the band to an install that predates it, once, as a real boolean", async () => {
    if (!(await db.setting.findUnique({ where: { key: "home.sections" } }))) await seed(db);
    const before = await sections();
    const withoutBand = before.filter((entry) => entry.key !== "promotions");
    await db.setting.update({ where: { key: "home.sections" }, data: { value: withoutBand } });

    try {
      await db.$executeRawUnsafe(statement);
      await db.$executeRawUnsafe(statement); // bounded: a second run matches nothing

      const after = await sections();
      const bands = after.filter((entry) => entry.key === "promotions");
      expect(bands).toEqual([{ key: "promotions", enabled: true, order: 2 }]);
      // Nothing else moved.
      expect(after.filter((entry) => entry.key !== "promotions")).toEqual(withoutBand);
    } finally {
      await db.setting.update({ where: { key: "home.sections" }, data: { value: before } });
    }
  });

  it("leaves an install that already places the band alone", async () => {
    const before = await sections();
    const moved = [
      ...before.filter((entry) => entry.key !== "promotions"),
      { key: "promotions", enabled: false, order: 9 },
    ];
    await db.setting.update({ where: { key: "home.sections" }, data: { value: moved } });
    try {
      await db.$executeRawUnsafe(statement);
      expect((await sections()).filter((entry) => entry.key === "promotions")).toEqual([
        { key: "promotions", enabled: false, order: 9 },
      ]);
    } finally {
      await db.setting.update({ where: { key: "home.sections" }, data: { value: before } });
    }
  });
});

describe("data migration: quiz and video keys (ADR-177)", () => {
  const migration = readFileSync(
    fileURLToPath(
      new URL(
        "../prisma/migrations/20261001120000_quiz_video_permissions_adr177/migration.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  // Several statements: drop the comments, then split on the `;` that ends each.
  const statements = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

  const roleKeys = async (roleId: string) =>
    (
      await db.rolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { key: true } } },
      })
    )
      .map((row) => row.permission.key)
      .sort();

  it("gives a custom role and a user override the twins of what they held", async () => {
    // The migration itself creates the quiz and video rows, so ask for a key
    // only the seed writes.
    if (!(await db.permission.findUnique({ where: { key: "lessons.view" } }))) await seed(db);
    const key = (k: string) => db.permission.findUniqueOrThrow({ where: { key: k } });

    // A role an admin made: the seed never rewrites it, so only the migration
    // can keep its Quizzes and Videos screens.
    const role = await db.role.create({
      data: { key: "adr177_custom", name: "ADR-177 custom", level: 40 },
    });
    for (const k of ["lessons.view", "lessons.update", "employees.update"]) {
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: (await key(k)).id },
      });
    }
    const user = await db.user.create({
      data: { id: "adr177user", email: "adr177@staff.example", name: "ADR-177", userType: "STAFF" },
    });
    await db.userPermission.create({
      data: { userId: user.id, permissionId: (await key("lessons.delete")).id, effect: "DENY" },
    });

    for (const statement of statements) await db.$executeRawUnsafe(statement);
    for (const statement of statements) await db.$executeRawUnsafe(statement); // idempotent

    expect(await roleKeys(role.id)).toEqual(
      [
        "employees.delete",
        "employees.update",
        "lessons.update",
        "lessons.view",
        "quizzes.update",
        "quizzes.view",
        "videos.update",
        "videos.view",
      ].sort(),
    );
    // Not held before, so not granted: no publish appears from nowhere.
    expect(await roleKeys(role.id)).not.toContain("quizzes.publish");

    const overrides = await db.userPermission.findMany({
      where: { userId: user.id },
      select: { effect: true, permission: { select: { key: true } } },
    });
    // A DENY on the lesson key is a DENY on its twins, or the split would
    // hand this user a delete they were refused.
    expect(overrides.map((row) => `${row.permission.key}:${row.effect}`).sort()).toEqual([
      "lessons.delete:DENY",
      "quizzes.delete:DENY",
      "videos.delete:DENY",
    ]);
  });

  it("files the old rows under the new cards", async () => {
    const group = async (k: string) =>
      (await db.permission.findUniqueOrThrow({ where: { key: k } })).groupName;
    expect(await group("courses.view")).toBe("courses");
    expect(await group("lessons.publish")).toBe("lessons");
    expect(await group("roles.manage")).toBe("roles");
    expect(await group("videos.delete")).toBe("videos");
  });
});
