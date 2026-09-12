// changes-26, ADR-085 — the dashboard's content registries have to be extended
// together.
//
// `@repo/core`'s `CONTENT_MODELS` is the one place a content type is declared
// (its queries, its permission key). Four presentation maps hang off that
// list, and each of them is a `Record<DashboardContentEntity, …>` — so
// TypeScript already catches a missing icon, href or label KEY. What it
// cannot catch is the half that lives outside the type system:
//
//   1. a label key with no value in the catalog (ADR-044 #5's actual
//      failure mode: the raw identifier is what renders when `t()` misses),
//   2. a workflow status that no pipeline bucket claims — added as an eighth
//      state, it would be silently dropped from every bar and the totals
//      would quietly stop summing to `total`,
//   3. a permission key that is not in the seed registry, which is the
//      typo'd-key silent-403 bug testing.md #5 exists for, in its read form:
//      a misspelled key here hides a block from everyone, forever, quietly.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CONTENT_ENTITIES,
  DASHBOARD_CONTENT_PERMISSIONS,
  DASHBOARD_CONTENT_STATUSES,
  DASHBOARD_OVERVIEW_PERMISSIONS,
  DASHBOARD_OVERVIEW_TILES,
  visibleOverviewTiles,
} from "@repo/core";
import {
  ENTITY_HREFS,
  ENTITY_ICONS,
  ENTITY_LABEL_KEYS,
  PIPELINE_BUCKETS,
  PIPELINE_LABEL_KEYS,
} from "./(admin)/admin/_lib/dashboard-content.ts";

const catalog = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../packages/i18n/messages/en.json"), "utf8"),
) as { admin: Record<string, unknown> };

const seed = readFileSync(resolve(process.cwd(), "../../packages/db/prisma/seed.ts"), "utf8");

describe("dashboard content entities", () => {
  it.each(DASHBOARD_CONTENT_ENTITIES)("%s has an icon, a destination and a label", (entity) => {
    // lucide icons are forwardRef objects, not plain functions.
    expect(ENTITY_ICONS[entity]).toBeTruthy();
    expect(ENTITY_HREFS[entity]).toMatch(/^\/admin\//);
    expect(catalog.admin[ENTITY_LABEL_KEYS[entity]]).toBeTypeOf("string");
  });

  it("sends every card to a distinct screen", () => {
    const hrefs = Object.values(ENTITY_HREFS);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("pipeline buckets", () => {
  it("claims every workflow status exactly once", () => {
    const claimed = PIPELINE_BUCKETS.flatMap((bucket) => [...bucket.statuses]);
    expect([...claimed].sort()).toEqual([...DASHBOARD_CONTENT_STATUSES].sort());
  });

  it("labels every bucket from the catalog", () => {
    for (const bucket of PIPELINE_BUCKETS) {
      expect(catalog.admin[PIPELINE_LABEL_KEYS[bucket.key]]).toBeTypeOf("string");
    }
  });

  // A hex here would fail lint anyway (code-style.md #1); this says the
  // stronger thing — the fill is a THEME token, so an admin's palette
  // change reaches the chart (ADR-072).
  it("fills every bucket from a theme token", () => {
    for (const bucket of PIPELINE_BUCKETS) {
      expect(bucket.color).toMatch(/^var\(--color-[a-z-]+\)$/);
    }
  });

  it("gives each bucket its own fill", () => {
    const colors = PIPELINE_BUCKETS.map((bucket) => bucket.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("dashboard content permissions", () => {
  it.each(DASHBOARD_CONTENT_PERMISSIONS)("%s is a seeded permission key", (permission) => {
    expect(seed).toContain(`"${permission}"`);
  });
});

// ─── The platform tiles (changes-21 F8 §2.2 #9) ──────────────
//
// ADR-085 gated the content blocks and left the four tiles that predate it
// ungated: any STAFF member opening `/admin` saw the user count, the employee
// headcount and the published-article count. The registry below closes that,
// and these tests are what keep it closed — a tile added without a permission
// entry cannot compile, but a tile added with a MISSPELLED one would hide
// itself from everyone, silently, forever (testing.md #5 in its read form).

describe("dashboard platform tiles", () => {
  it("declares a tile for every field the overview can return", () => {
    // The loader's return type is optional per field, so TypeScript cannot
    // tell a field that is absent because it was not permitted from one that
    // was never wired. This is the list that says which is which.
    expect([...DASHBOARD_OVERVIEW_TILES].sort()).toEqual([
      "articles",
      "deliveries",
      "employees",
      "flags",
      "newUsers",
      "settings",
      "users",
    ]);
  });

  it.each(DASHBOARD_OVERVIEW_PERMISSIONS)("%s is a seeded permission key", (permission) => {
    expect(seed).toContain(`"${permission}"`);
  });

  it("shows nothing to a subject with no permissions at all", () => {
    // The dashboard has no page-level permission — the STAFF gate covers the
    // route — so "holds nothing" has to be a real, empty answer rather than
    // an unreachable case.
    expect(visibleOverviewTiles(() => false)).toEqual([]);
  });

  it("shows both user tiles together, because they read the same rows", () => {
    const tiles = visibleOverviewTiles((permission) => permission === "users.view");
    expect(tiles).toEqual(["users", "newUsers"]);
  });

  it("gives an employees-only subject the headcount and nothing else", () => {
    expect(visibleOverviewTiles((permission) => permission === "employees.view")).toEqual([
      "employees",
    ]);
  });

  it("no longer counts menu items — /admin/navigation is hidden (ADR-038)", () => {
    // The card it fed linked to a screen nobody can open, so the number was
    // unactionable and the link went nowhere useful. `deliveries` replaced it.
    expect(DASHBOARD_OVERVIEW_TILES).not.toContain("menuItems");
    expect(catalog.admin["dashboardActiveMenuItems"]).toBeUndefined();
    expect(catalog.admin["dashboardEmailDeliveries"]).toBeTypeOf("string");
  });

  it("has no ungated dashboard count left in core", () => {
    // `loadAdminDashboardCounts()` was four unpermissioned totals, exported
    // and called by nothing. Deleted in F8 rather than left as a convenience,
    // because what it was convenient for is the leak F8 fixes.
    const adminReads = readFileSync(
      resolve(process.cwd(), "../../packages/core/src/admin-reads.ts"),
      "utf8",
    );
    expect(adminReads).not.toContain("export async function loadAdminDashboardCounts");
  });
});
