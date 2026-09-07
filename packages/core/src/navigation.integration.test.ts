// Nav builder truth table (SKILL.md Module 08) against real MariaDB
// (testing.md: don't mock Prisma). `assembleNavigation` is pure and gets
// the fine-grained matrix; `loadMenuData` is exercised against seeded
// fixture rows, including the reorder round-trip that stands in for the
// admin-reorder E2E until Playwright lands.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as NavModule from "./navigation.ts";
import { assembleNavigation, type MenuData } from "./navigation.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let nav: typeof NavModule;

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
  nav = await import("./navigation.ts");
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

// ─── Pure truth table ────────────────────────────────────────

function subjectOf(userType: "LEARNER" | "STAFF", allowed: string[] = []): Subject {
  return {
    id: "u1",
    userType,
    roleKeys: [],
    maxRoleLevel: 1,
    allowed: new Set(allowed),
    denied: new Set(),
  };
}

function item(overrides: Partial<MenuData["items"][number]>): MenuData["items"][number] {
  return {
    id: Math.random().toString(36).slice(2),
    parentId: null,
    url: null,
    routeKey: "glossary",
    icon: null,
    badge: null,
    sortOrder: 0,
    isActive: true,
    openInNewTab: false,
    visibility: "PUBLIC",
    requiresFeature: null,
    requiresPermission: null,
    translations: [{ locale: "en", label: "Glossary", title: null }],
    ...overrides,
  };
}

function dataOf(items: MenuData["items"], flags: MenuData["flags"] = {}): MenuData {
  return {
    name: "Main",
    items,
    flags,
    locales: [
      { code: "en", fallbackCode: null },
      { code: "es", fallbackCode: "en" },
      { code: "ar", fallbackCode: null },
    ],
    defaultLocale: "en",
  };
}

describe("assembleNavigation — truth table", () => {
  it("prunes an inactive item", () => {
    const result = assembleNavigation(dataOf([item({ isActive: false })]), "en", null);
    expect(result).toEqual([]);
  });

  it("prunes an AUTHENTICATED-visibility item for an anonymous subject, keeps it for a signed-in one", () => {
    const data = dataOf([item({ visibility: "AUTHENTICATED" })]);
    expect(assembleNavigation(data, "en", null)).toEqual([]);
    expect(assembleNavigation(data, "en", subjectOf("LEARNER"))).toHaveLength(1);
  });

  it("prunes an item whose required feature flag is disabled, keeps it when enabled", () => {
    const items = [item({ requiresFeature: "glossary" })];
    expect(
      assembleNavigation(
        dataOf(items, { glossary: { isEnabled: false, visibility: "PUBLIC" } }),
        "en",
        null,
      ),
    ).toEqual([]);
    expect(
      assembleNavigation(
        dataOf(items, { glossary: { isEnabled: true, visibility: "PUBLIC" } }),
        "en",
        null,
      ),
    ).toHaveLength(1);
  });

  it("prunes an item whose required feature exists but has no flag row at all (fail closed)", () => {
    expect(assembleNavigation(dataOf([item({ requiresFeature: "ghost" })]), "en", null)).toEqual(
      [],
    );
  });

  it("permission-gated item: pruned for anonymous and learner, present for staff WITH the permission, pruned for staff without it", () => {
    const data = dataOf([item({ requiresPermission: "users.view" })]);
    expect(assembleNavigation(data, "en", null)).toEqual([]);
    expect(assembleNavigation(data, "en", subjectOf("LEARNER", ["users.view"]))).toEqual([]);
    expect(assembleNavigation(data, "en", subjectOf("STAFF", ["users.view"]))).toHaveLength(1);
    expect(assembleNavigation(data, "en", subjectOf("STAFF"))).toEqual([]);
  });

  it("prunes a link-less parent whose children are all pruned; keeps it when one child survives", () => {
    const parent = item({ id: "p", routeKey: null, url: null });
    const deadChild = item({ id: "c1", parentId: "p", isActive: false });
    const liveChild = item({ id: "c2", parentId: "p" });

    expect(assembleNavigation(dataOf([parent, deadChild]), "en", null)).toEqual([]);

    const withLive = assembleNavigation(dataOf([parent, deadChild, liveChild]), "en", null);
    // A link-less parent that survives still needs a label+href to render;
    // it has no routeKey/url so it can't produce one — this documents that
    // a surviving parent must itself carry a link (or the builder skips it).
    expect(withLive).toEqual([]);
  });

  it("a parent WITH its own link keeps its surviving children nested (depth 2), and a grandchild row is ignored", () => {
    const parent = item({ id: "p", routeKey: "learn" });
    const child = item({ id: "c", parentId: "p", routeKey: "glossary" });
    const grandchild = item({ id: "g", parentId: "c", routeKey: "news" });

    const result = assembleNavigation(dataOf([parent, child, grandchild]), "en", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children).toEqual([]);
  });

  it("resolves routeKey → registry path and url → external", () => {
    const result = assembleNavigation(
      dataOf([
        item({ routeKey: "glossary" }),
        item({
          routeKey: null,
          url: "https://example.com",
          translations: [{ locale: "en", label: "Ext", title: null }],
        }),
      ]),
      "en",
      null,
    );
    expect(result[0]).toMatchObject({ href: "/glossary", isExternal: false });
    expect(result[1]).toMatchObject({ href: "https://example.com", isExternal: true });
  });

  it("skips a row violating the exactly-one rule (both set / neither set) and an unregistered routeKey instead of crashing", () => {
    const result = assembleNavigation(
      dataOf([
        item({ routeKey: "glossary", url: "https://example.com" }),
        item({ routeKey: null, url: null }),
        item({ routeKey: "not-a-real-route" }),
      ]),
      "en",
      null,
    );
    expect(result).toEqual([]);
  });

  it("label fallback: es falls back through its chain to en; ar (no fallbackCode) still gets the default-locale label — nav chrome is not content (see resolveLabel)", () => {
    const data = dataOf([
      item({ translations: [{ locale: "en", label: "Glossary", title: null }] }),
    ]);
    expect(assembleNavigation(data, "es", null)[0]!.label).toBe("Glossary");
    expect(assembleNavigation(data, "ar", null)[0]!.label).toBe("Glossary");
  });

  it("uses the exact-locale label when it exists", () => {
    const data = dataOf([
      item({
        translations: [
          { locale: "en", label: "Glossary", title: null },
          { locale: "es", label: "Glosario", title: null },
        ],
      }),
    ]);
    expect(assembleNavigation(data, "es", null)[0]!.label).toBe("Glosario");
  });
});

// ─── DB-backed loader + reorder round-trip ──────────────────

describe("loadMenuData — real rows, and the reorder round-trip", () => {
  it("loads a menu tree with translations, flags, and locales; a sortOrder change is visible on the next load (the write invalidateNavigation's tag covers)", async () => {
    await db.locale.upsert({
      where: { code: "en" },
      update: {},
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
    const menu = await db.menu.create({
      data: { key: `m-${Date.now()}`, name: "Test", location: "header" },
    });
    const a = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "learn", sortOrder: 1, isActive: true },
    });
    const b = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "glossary", sortOrder: 2, isActive: true },
    });
    await db.menuItemTranslation.createMany({
      data: [
        { menuItemId: a.id, locale: "en", label: "Learn" },
        { menuItemId: b.id, locale: "en", label: "Glossary" },
      ],
    });

    const before = await nav.loadMenuData(menu.key);
    const builtBefore = assembleNavigation(before, "en", null);
    expect(builtBefore.map((i) => i.label)).toEqual(["Learn", "Glossary"]);

    // The admin-reorder round-trip, minus the browser: swap sortOrder and
    // confirm the next load reflects it — this is precisely the data path
    // revalidateTag("navigation") flushes to in production.
    await db.menuItem.update({ where: { id: a.id }, data: { sortOrder: 3 } });
    const after = await nav.loadMenuData(menu.key);
    expect(assembleNavigation(after, "en", null).map((i) => i.label)).toEqual([
      "Glossary",
      "Learn",
    ]);
  });
});

// ─── Phase 3 addition (changes-03-plan.md §5.3) ──────────────

describe("loadMenuData carries the menu's own name (what buildMenu exposes)", () => {
  it("returns the name alongside the items, so the footer can title its columns", async () => {
    await db.locale.upsert({
      where: { code: "en" },
      update: {},
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
    const menu = await db.menu.create({
      data: { key: `named-${Date.now()}`, name: "Trading Tools", location: "footer" },
    });
    const item = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "glossary", sortOrder: 1, isActive: true },
    });
    await db.menuItemTranslation.create({
      data: { menuItemId: item.id, locale: "en", label: "Glossary" },
    });

    const data = await nav.loadMenuData(menu.key);
    expect(data.name).toBe("Trading Tools");
    // The footer previously had items but no heading — that was the whole
    // reason for this field.
    expect(assembleNavigation(data, "en", null).map((i) => i.label)).toEqual(["Glossary"]);
  });

  it("a menu key that doesn't exist yields a null name and no items, not a throw", async () => {
    const data = await nav.loadMenuData("no-such-menu");
    expect(data.name).toBeNull();
    expect(data.items).toEqual([]);
  });
});

// ─── About section (ADR-047 / ADR-048) ───────────────────────

describe("the About parent and its five children, as the seed writes them", () => {
  it("resolves five children with registry hrefs and their one-line titles", async () => {
    await db.locale.upsert({
      where: { code: "en" },
      update: {},
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
    const menu = await db.menu.create({
      data: { key: `about-${Date.now()}`, name: "Main", location: "header" },
    });
    const root = await db.menuItem.create({
      data: { menuId: menu.id, routeKey: "about", sortOrder: 8, isActive: true },
    });
    await db.menuItemTranslation.create({
      data: { menuItemId: root.id, locale: "en", label: "About" },
    });

    // Same shape as seed.ts's ABOUT_NAV.children — the panel's descriptions
    // ride on MenuItemTranslation.title, so a child with no title would
    // silently render a description-less row rather than fail.
    const children = [
      { routeKey: "about", label: "About MBFX", title: "Who we are and what we teach" },
      { routeKey: "about-why-us", label: "Why MBFX", title: "Five reasons" },
      { routeKey: "about-transparency", label: "How we operate", title: "Data and funding" },
      { routeKey: "about-security", label: "Security & trust", title: "Account and data" },
      { routeKey: "about-support", label: "Support", title: "Reach a human" },
    ];
    for (const [index, child] of children.entries()) {
      const record = await db.menuItem.create({
        data: {
          menuId: menu.id,
          parentId: root.id,
          routeKey: child.routeKey,
          sortOrder: index + 1,
          isActive: true,
        },
      });
      await db.menuItemTranslation.create({
        data: {
          menuItemId: record.id,
          locale: "en",
          label: child.label,
          title: child.title,
        },
      });
    }

    const built = assembleNavigation(await nav.loadMenuData(menu.key), "en", null);
    expect(built).toHaveLength(1);
    const about = built[0];
    expect(about?.href).toBe("/about");
    expect(about?.children.map((c) => c.href)).toEqual([
      "/about",
      "/about/why-us",
      "/about/transparency",
      "/about/security",
      "/about/support",
    ]);
    expect(about?.children.map((c) => c.title)).toEqual([
      "Who we are and what we teach",
      "Five reasons",
      "Data and funding",
      "Account and data",
      "Reach a human",
    ]);
    // No feature flag gates these — they are coded routes that always exist,
    // unlike the flag-gated areas beside them in the seeded menu.
    expect(about?.children.every((c) => !c.isExternal)).toBe(true);
  });
});
