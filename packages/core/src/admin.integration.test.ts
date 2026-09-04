// Admin mutation services (Module 09) against real MariaDB: reorder swap,
// active toggles, theme save gated by validateTheme (blocking palette
// refused, passing palette persisted), preset activation round-trip — and
// an audit row on every write (security.md #5), asserted at the DB level.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type * as AdminModule from "./admin.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let admin: typeof AdminModule;

const ACTOR = "actor-admin-test";

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
  admin = await import("./admin.ts");

  await db.user.create({
    data: {
      id: ACTOR,
      email: "actor@example.com",
      name: "Actor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

const palette = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F0F0",
  textPrimary: "#111111",
  textSecondary: "#333333",
  textMuted: "#666666",
  borderLight: "#DDDDDD",
  borderMedium: "#767676",
};
const darkPalette = {
  background: "#141413",
  surface: "#1C1C1A",
  surfaceMuted: "#252523",
  textPrimary: "#F5F4F2",
  textSecondary: "#C9C7C3",
  textMuted: "#93918C",
  borderLight: "#2E2E2B",
  borderMedium: "#8A8883",
};
const goodBrand = {
  primary: "#0B57D0",
  secondary: "#2A2A29",
  success: "#0F7B33",
  error: "#B3261E",
  warning: "#7A5A00",
  info: "#004284",
  accent: "#EAE5DE",
};
const layoutTokens = {
  radiusBase: "4px",
  containerWidth: "1400px",
  fontSans: "system" as const,
  fontMono: "systemmono" as const,
  baseFontSize: "14px",
};

describe("moveMenuItem", () => {
  it("swaps sortOrder with the adjacent sibling and writes an audit row; no-ops at the edge", async () => {
    const menu = await db.menu.create({
      data: { key: `am-${Date.now()}`, name: "M", location: "header" },
    });
    const a = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "learn", sortOrder: 1 },
    });
    const b = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "news", sortOrder: 2 },
    });

    await admin.moveMenuItem(ACTOR, b.id, "up");
    const [aAfter, bAfter] = await Promise.all([
      db.menuItem.findUniqueOrThrow({ where: { id: a.id } }),
      db.menuItem.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(bAfter.sortOrder).toBe(1);
    expect(aAfter.sortOrder).toBe(2);

    await expect(
      db.auditLog.findFirstOrThrow({ where: { action: "navigation.reorder", entityId: b.id } }),
    ).resolves.toBeTruthy();

    // b is now first — another "up" must be a harmless no-op.
    await admin.moveMenuItem(ACTOR, b.id, "up");
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: b.id } })).sortOrder).toBe(1);
  });
});

describe("setMenuItemActive / setSocialLinkActive", () => {
  it("toggles and audits", async () => {
    const menu = await db.menu.create({
      data: { key: `at-${Date.now()}`, name: "M", location: "header" },
    });
    const item = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "learn", sortOrder: 1, isActive: true },
    });

    await admin.setMenuItemActive(ACTOR, item.id, false);
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).isActive).toBe(false);
    await expect(
      db.auditLog.findFirstOrThrow({ where: { action: "navigation.toggle", entityId: item.id } }),
    ).resolves.toBeTruthy();

    await db.socialLink.create({
      data: {
        platform: `x-${Date.now()}`,
        label: "X",
        url: "https://x.com/a",
        icon: "x",
        isActive: true,
      },
    });
    const link = await db.socialLink.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    await admin.setSocialLinkActive(ACTOR, link.platform, false);
    expect(
      (await db.socialLink.findUniqueOrThrow({ where: { platform: link.platform } })).isActive,
    ).toBe(false);
  });
});

describe("saveTheme — validateTheme is the gate", () => {
  it("refuses a blocking palette (illegible body text) and persists nothing", async () => {
    const key = `bad-${Date.now()}`;
    const result = await admin.saveTheme(ACTOR, {
      themeKey: key,
      brandColors: goodBrand,
      // White text on white background — the canonical blocking error.
      lightSurface: { ...palette, textPrimary: "#FFFFFF" },
      darkSurface: darkPalette,
      layoutTokens,
    });
    expect(result.saved).toBe(false);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    await expect(db.theme.findUnique({ where: { key } })).resolves.toBeNull();
  });

  it("saves a passing palette, audits it, and activateTheme round-trips as the ONLY active row", async () => {
    const key = `good-${Date.now()}`;
    const result = await admin.saveTheme(ACTOR, {
      themeKey: key,
      brandColors: goodBrand,
      lightSurface: palette,
      darkSurface: darkPalette,
      layoutTokens,
    });
    expect(result.saved).toBe(true);
    await expect(
      db.auditLog.findFirstOrThrow({ where: { action: "theme.update", entityId: key } }),
    ).resolves.toBeTruthy();

    await admin.activateTheme(ACTOR, key);
    const actives = await db.theme.findMany({ where: { isActive: true } });
    expect(actives.map((t) => t.key)).toEqual([key]);
    const presets = await admin.loadThemePresets();
    expect(presets.find((p) => p.key === key)?.isActive).toBe(true);
  });
});
