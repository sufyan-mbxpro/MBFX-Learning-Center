// Real-MariaDB integration test (testing.md: mocking Prisma hides FK and
// constraint bugs — don't). Covers the DB-driven half of routing.ts's
// documented static/dynamic trade-off: an admin flipping `Locale.isActive`
// must be immediately visible here.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as I18nModule from "./locales.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let locales: typeof I18nModule;

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
  locales = await import("./locales.ts");
}, 120_000);

afterEach(() => {
  vi.doUnmock("next/cache");
  vi.resetModules();
});

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

describe("loadActiveLocales", () => {
  it("returns only isActive rows, ordered by sortOrder", async () => {
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
    await db.locale.create({
      data: {
        code: "es",
        name: "Spanish",
        nativeName: "Español",
        direction: "LTR",
        isActive: false,
        sortOrder: 4,
        fallbackCode: "en",
      },
    });
    await db.locale.create({
      data: {
        code: "ar",
        name: "Arabic",
        nativeName: "العربية",
        direction: "RTL",
        isActive: true,
        sortOrder: 3,
      },
    });

    const active = await locales.loadActiveLocales();
    expect(active.map((l) => l.code)).toEqual(["en", "ar"]);
    expect(active.find((l) => l.code === "ar")?.fallbackCode).toBeNull();
  });

  it("an admin activating a locale is reflected on the very next load — the dynamic half of the static/dynamic trade-off", async () => {
    await db.locale.updateMany({ data: { isActive: false }, where: {} });
    await db.locale.upsert({
      where: { code: "ur" },
      update: { isActive: false },
      create: {
        code: "ur",
        name: "Urdu",
        nativeName: "اردو",
        direction: "RTL",
        isActive: false,
        sortOrder: 2,
      },
    });

    const before = await locales.loadActiveLocales();
    expect(before.map((l) => l.code)).not.toContain("ur");

    await db.locale.update({ where: { code: "ur" }, data: { isActive: true } });
    const after = await locales.loadActiveLocales();
    expect(after.map((l) => l.code)).toContain("ur");
  });
});

describe("getActiveLocales / invalidateActiveLocales — production entry points (next/cache mocked — ADR-004)", () => {
  it("getActiveLocales delegates to loadActiveLocales", async () => {
    await db.locale.updateMany({ data: { isActive: false }, where: {} });
    await db.locale.upsert({
      where: { code: "en" },
      update: { isActive: true },
      create: {
        code: "en",
        name: "English",
        nativeName: "English",
        direction: "LTR",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
    });

    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./locales.ts");
    const active = await fresh.getActiveLocales();
    expect(active.map((l) => l.code)).toContain("en");
  });

  it("invalidateActiveLocales calls revalidateTag without throwing", async () => {
    vi.doMock("next/cache", () => ({
      cacheTag: () => {},
      cacheLife: () => {},
      revalidateTag: () => {},
    }));
    const fresh = await import("./locales.ts");
    await expect(fresh.invalidateActiveLocales()).resolves.not.toThrow();
  });
});

// ADR-091. The rule these pin is "a locale is served when it is active", and
// each test covers one of the two directions it can be got wrong in: an
// untranslated locale being published, and a routable locale being dropped.
describe("getServableLocales / isServableLocale (ADR-091)", () => {
  const cacheStub = () => ({ cacheTag: () => {}, cacheLife: () => {}, revalidateTag: () => {} });

  async function seedLocales(active: string[]): Promise<typeof I18nModule> {
    await db.locale.updateMany({ data: { isActive: false }, where: {} });
    for (const code of active) {
      await db.locale.upsert({
        where: { code },
        update: { isActive: true },
        create: {
          code,
          name: code,
          nativeName: code,
          direction: "LTR",
          isActive: true,
          sortOrder: 1,
        },
      });
    }
    vi.doMock("next/cache", cacheStub);
    return import("./locales.ts");
  }

  it("publishes an active locale and withholds a seeded-but-inactive one", async () => {
    const fresh = await seedLocales(["en"]);
    const servable = await fresh.getServableLocales();

    expect(servable).toEqual(["en"]);
    // es is in routing.locales and seeded in the database. It is NOT served,
    // because it is not active — this is the whole of ADR-091 in one line, and
    // the reason `next build` no longer prerenders three untranslated locales.
    expect(servable).not.toContain("es");
    await expect(fresh.isServableLocale("es")).resolves.toBe(false);
    await expect(fresh.isServableLocale("en")).resolves.toBe(true);
  });

  it("serves a locale the moment it is activated — no rule of its own beyond isActive", async () => {
    const fresh = await seedLocales(["en", "es"]);
    await expect(fresh.getServableLocales()).resolves.toContain("es");
    await expect(fresh.isServableLocale("es")).resolves.toBe(true);
  });

  it("drops an active row that next-intl cannot route", async () => {
    // `de` is active in the database but absent from routing.locales, so no
    // prefix reaches the app for it. Prerendering it would emit pages nothing
    // can request; the intersection has to cut both ways.
    const fresh = await seedLocales(["en", "de"]);
    const servable = await fresh.getServableLocales();

    expect(servable).toEqual(["en"]);
    await expect(fresh.isServableLocale("de")).resolves.toBe(false);
  });

  it("falls back to the default locale rather than serving nothing", async () => {
    // No active locale is a misconfiguration, but returning [] would make
    // `generateStaticParams` prerender zero pages — a site with no pages is a
    // worse answer than the default one.
    const fresh = await seedLocales([]);
    await expect(fresh.getServableLocales()).resolves.toEqual(["en"]);
  });
});
