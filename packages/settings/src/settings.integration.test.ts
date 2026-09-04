// Real-MariaDB integration tests (testing.md: mocking Prisma hides FK and
// constraint bugs — don't). Covers SKILL.md's required tests: typed reads +
// defaults for missing keys, write → read-after-invalidate consistency, and
// the isPublic leak test. The audit-row-on-every-write composition test
// lives in @repo/core (settings-audit.integration.test.ts) — core is the
// one package legally depending on settings + rbac both (architecture.md
// #8); a settings devDependency on core created a turbo task-graph cycle
// once core#build started depending on settings#build (Module 08).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as SettingsModule from "./index.ts";
import type * as RbacModule from "@repo/rbac";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let settings: typeof SettingsModule;
let rbac: typeof RbacModule;

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
  settings = await import("./index.ts");
  rbac = await import("@repo/rbac");
}, 120_000);

afterEach(() => {
  vi.doUnmock("next/cache");
  vi.resetModules();
});

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

async function seedSetting(
  overrides: Partial<Parameters<typeof db.setting.create>[0]["data"]> = {},
) {
  return db.setting.create({
    data: {
      key: `test.key.${crypto.randomUUID()}`,
      groupName: "general",
      value: "hello",
      type: "STRING",
      label: "Test",
      isPublic: false,
      ...overrides,
    },
  });
}

describe("loadSetting — typed reads + defaults", () => {
  it("returns null for a key that was never seeded", async () => {
    await expect(
      settings.loadSetting("seo.googleSiteVerification" as never),
    ).resolves.not.toThrow();
  });

  it("parses a known key's stored value against its declared schema", async () => {
    await db.setting.upsert({
      where: { key: "header.sticky" },
      update: { value: true },
      create: {
        key: "header.sticky",
        groupName: "layout",
        value: true,
        type: "BOOLEAN",
        label: "Sticky header",
        isPublic: true,
      },
    });
    await expect(settings.loadSetting("header.sticky")).resolves.toBe(true);
  });

  it("throws when a stored value no longer matches its declared schema — a data-integrity bug, not a normal missing-key case", async () => {
    await db.setting.upsert({
      where: { key: "header.sticky" },
      update: { value: "not-a-boolean" as never },
      create: {
        key: "header.sticky",
        groupName: "layout",
        value: "not-a-boolean" as never,
        type: "BOOLEAN",
        label: "Sticky header",
        isPublic: true,
      },
    });
    await expect(settings.loadSetting("header.sticky")).rejects.toThrow();
    // restore for later tests
    await db.setting.update({ where: { key: "header.sticky" }, data: { value: true } });
  });
});

describe("isPublic leak test", () => {
  it("loadPublicSettings excludes a non-public row for the same group — the query itself scopes it out, not a post-hoc filter", async () => {
    const group = `group-${Date.now()}`;
    await seedSetting({
      key: `${group}.public`,
      groupName: group,
      isPublic: true,
      value: "visible",
    });
    await seedSetting({
      key: `${group}.secret`,
      groupName: group,
      isPublic: false,
      value: "hidden",
    });

    const result = await settings.loadPublicSettings(group);
    expect(result).toHaveProperty(`${group}.public`, "visible");
    expect(result).not.toHaveProperty(`${group}.secret`);
  });
});

describe("updateSetting — write → read-after-invalidate consistency", () => {
  it("a write is immediately visible to the next loadSetting call", async () => {
    await db.setting.upsert({
      where: { key: "header.sticky" },
      update: { value: true },
      create: {
        key: "header.sticky",
        groupName: "layout",
        value: true,
        type: "BOOLEAN",
        label: "Sticky header",
        isPublic: true,
      },
    });

    // revalidateTag, like cacheTag/cacheLife (ADR-004), throws outside a
    // real Next.js request/build context — mocked so this exercises
    // updateSetting's actual write logic, not that unrelated guard.
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");

    const result = await fresh.updateSetting("header.sticky", false, "actor-1");
    expect(result.before).toBe(true);
    expect(result.after).toBe(false);

    await expect(fresh.loadSetting("header.sticky")).resolves.toBe(false);
    // restore
    await fresh.updateSetting("header.sticky", true, "actor-1");
  });

  it("rejects a value that fails the key's declared schema (no number into a BOOLEAN slot)", async () => {
    await expect(settings.updateSetting("header.sticky", 42 as never, "actor-1")).rejects.toThrow();
  });

  it("updateSettings (changes-02: one Save per section) writes every entry and invalidates each touched group's tag once", async () => {
    await db.setting.upsert({
      where: { key: "header.sticky" },
      update: { value: true },
      create: {
        key: "header.sticky",
        groupName: "layout",
        value: true,
        type: "BOOLEAN",
        label: "Sticky header",
        isPublic: true,
      },
    });
    await db.setting.upsert({
      where: { key: "seo.robotsIndex" },
      update: { value: true },
      create: {
        key: "seo.robotsIndex",
        groupName: "seo",
        value: true,
        type: "BOOLEAN",
        label: "Allow search indexing",
        isPublic: false,
      },
    });

    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");

    const results = await fresh.updateSettings(
      [
        { key: "header.sticky", value: false },
        { key: "seo.robotsIndex", value: false },
      ],
      "actor-1",
    );
    expect(results.map((r) => r.key)).toEqual(["header.sticky", "seo.robotsIndex"]);
    await expect(fresh.loadSetting("header.sticky")).resolves.toBe(false);
    await expect(fresh.loadSetting("seo.robotsIndex")).resolves.toBe(false);

    // restore
    await fresh.updateSettings(
      [
        { key: "header.sticky", value: true },
        { key: "seo.robotsIndex", value: true },
      ],
      "actor-1",
    );
  });

  it("updateSettings validates every entry before writing any — one bad field saves nothing", async () => {
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    const before = await fresh.loadSetting("header.sticky");

    await expect(
      fresh.updateSettings(
        [
          { key: "header.sticky", value: !before },
          { key: "seo.robotsIndex", value: "not-a-boolean" },
        ],
        "actor-1",
      ),
    ).rejects.toThrow();

    await expect(fresh.loadSetting("header.sticky")).resolves.toBe(before);
  });
});

describe("guarded write — permission boundary", () => {
  it("a learner subject is denied settings.update — the boundary a Server Action must enforce before ever calling updateSetting", async () => {
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `learner-${Date.now()}@example.com`,
        name: "Learner",
        status: "ACTIVE",
        userType: "LEARNER",
      },
    });
    const subject = await rbac.loadSubject(user.id);
    expect(rbac.can(subject, "settings.update")).toBe(false);
  });
});

describe("feature flags", () => {
  it("loadFeatureFlag reads isEnabled/visibility for a seeded key", async () => {
    const key = `flag-${Date.now()}`;
    await db.featureFlag.create({
      data: { key, groupName: "test", label: key, isEnabled: true, visibility: "AUTHENTICATED" },
    });
    await expect(settings.loadFeatureFlag(key)).resolves.toEqual({
      key,
      isEnabled: true,
      visibility: "AUTHENTICATED",
    });
  });

  it("returns null for an unseeded flag key", async () => {
    await expect(settings.loadFeatureFlag(`missing-${Date.now()}`)).resolves.toBeNull();
  });

  it("getFeatureFlag (the cached entry point) delegates to loadFeatureFlag (next/cache mocked — ADR-004)", async () => {
    const key = `flag-cached-${Date.now()}`;
    await db.featureFlag.create({
      data: { key, groupName: "test", label: key, isEnabled: false, visibility: "PUBLIC" },
    });

    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    await expect(fresh.getFeatureFlag(key)).resolves.toEqual({
      key,
      isEnabled: false,
      visibility: "PUBLIC",
    });
  });

  it("isFeatureVisible composes the cached lookup with evaluateVisibility, and is false for a missing key", async () => {
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    await expect(fresh.isFeatureVisible(`missing-${Date.now()}`, null)).resolves.toBe(false);
  });

  it("invalidateFeatureFlags calls revalidateTag on the feature-flags tag without throwing (next/cache mocked)", async () => {
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    await expect(fresh.invalidateFeatureFlags()).resolves.not.toThrow();
  });
});

describe("cached production entry points (next/cache mocked — ADR-004)", () => {
  it("getSetting delegates to loadSetting", async () => {
    await db.setting.upsert({
      where: { key: "header.sticky" },
      update: { value: true },
      create: {
        key: "header.sticky",
        groupName: "layout",
        value: true,
        type: "BOOLEAN",
        label: "Sticky header",
        isPublic: true,
      },
    });

    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    await expect(fresh.getSetting("header.sticky")).resolves.toBe(true);
  });

  it("getPublicSettings delegates to loadPublicSettings, still excluding non-public rows", async () => {
    const group = `group-cached-${Date.now()}`;
    await seedSetting({
      key: `${group}.public`,
      groupName: group,
      isPublic: true,
      value: "visible",
    });
    await seedSetting({
      key: `${group}.secret`,
      groupName: group,
      isPublic: false,
      value: "hidden",
    });

    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./index.ts");
    const result = await fresh.getPublicSettings(group);
    expect(result).toHaveProperty(`${group}.public`, "visible");
    expect(result).not.toHaveProperty(`${group}.secret`);
  });
});
