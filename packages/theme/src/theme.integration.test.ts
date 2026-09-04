// Real-MariaDB integration test for the one thing that can't be verified
// with in-memory fixtures: loadActiveTheme's DB query and scope-resolution
// precedence. This is the regression test SKILL.md calls out by name — the
// one that would have caught bug A5.1 (orderBy: { scope: "asc" } sorted
// "both" before "web" alphabetically, the opposite of "exact scope wins").
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { db as DbClient } from "@repo/db";
import { loadActiveTheme } from "./index.ts";

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
  db = (await import("@repo/db")).db;
}, 120_000);

afterEach(() => {
  vi.doUnmock("next/cache");
  vi.resetModules();
});

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

const brandColors = {
  primary: "#111111",
  secondary: "#222222",
  success: "#333333",
  error: "#444444",
  warning: "#555555",
  info: "#666666",
  accent: "#777777",
};
const surface = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F0F0",
  textPrimary: "#000000",
  textSecondary: "#333333",
  textMuted: "#666666",
  borderLight: "#DDDDDD",
  borderMedium: "#CCCCCC",
};
const layout = {
  radiusBase: "4px",
  containerWidth: "1400px",
  fontSans: "system" as const,
  fontMono: "systemmono" as const,
  baseFontSize: "14px",
};

describe("loadActiveTheme — scope resolution (A5.1 regression)", () => {
  it("when both a 'both'-scoped and a 'web'-scoped theme are active, the web loader returns the exact-scope ('web') row", async () => {
    await db.theme.create({
      data: {
        key: `both-${Date.now()}`,
        name: "Both",
        brandColors,
        lightSurface: surface,
        darkSurface: surface,
        layoutTokens: layout,
        isActive: true,
        scope: "both",
      },
    });
    const webRow = await db.theme.create({
      data: {
        key: `web-${Date.now()}`,
        name: "Web",
        brandColors,
        lightSurface: surface,
        darkSurface: surface,
        layoutTokens: layout,
        isActive: true,
        scope: "web",
      },
    });

    const resolved = await loadActiveTheme("web");
    expect(resolved.key).toBe(webRow.key);
  });

  it("the admin loader with only a 'both'-scoped theme active returns that 'both' row", async () => {
    await db.theme.updateMany({ data: { isActive: false }, where: {} });
    const bothRow = await db.theme.create({
      data: {
        key: `both-admin-${Date.now()}`,
        name: "Both Admin",
        brandColors,
        lightSurface: surface,
        darkSurface: surface,
        layoutTokens: layout,
        isActive: true,
        scope: "both",
      },
    });

    const resolved = await loadActiveTheme("admin");
    expect(resolved.key).toBe(bothRow.key);
  });

  it("falls back to branded defaults when no active theme row exists — the site must render branded on an empty database", async () => {
    await db.theme.updateMany({ data: { isActive: false }, where: {} });
    const resolved = await loadActiveTheme("web");
    expect(resolved.key).toBe("default");
    expect(resolved.lightCss).toContain("--primary:");
  });
});

describe("getActiveTheme — the production entry point", () => {
  it("delegates to loadActiveTheme with the given scope (next/cache mocked — ADR-004: cacheTag/cacheLife throw outside a real cacheComponents context)", async () => {
    await db.theme.updateMany({ data: { isActive: false }, where: {} });
    const webRow = await db.theme.create({
      data: {
        key: `getactive-${Date.now()}`,
        name: "GetActive",
        brandColors,
        lightSurface: surface,
        darkSurface: surface,
        layoutTokens: layout,
        isActive: true,
        scope: "web",
      },
    });

    vi.doMock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
    const fresh = await import("./index.ts");
    const resolved = await fresh.getActiveTheme("web");
    expect(resolved.key).toBe(webRow.key);
  });
});
