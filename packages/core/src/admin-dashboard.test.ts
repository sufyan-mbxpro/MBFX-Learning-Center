// changes-26, ADR-085 — the dashboard's content aggregation, in the parts that hold
// without a database.
//
// The queries themselves are Prisma and belong in an integration test; what
// is worth pinning here is the shape everything downstream trusts: the
// status fold always sums, the permission narrowing is a real filter rather
// than a UI courtesy, and the entity list and the permission list stay in
// step with each other.
import { ContentStatus } from "@repo/db";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CONTENT_ENTITIES,
  DASHBOARD_CONTENT_PERMISSIONS,
  DASHBOARD_CONTENT_STATUSES,
  DASHBOARD_RANGES,
  bucketSize,
  dashboardWindow,
  foldContentStatusCounts,
  visibleContentEntities,
  type DashboardRange,
} from "./admin-reads.ts";

/** What each range PROMISES the reader, written down here rather than imported: a test that
 * reads the implementation's own constant asserts nothing. */
const RANGE_DAYS: Record<DashboardRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

describe("DASHBOARD_CONTENT_STATUSES", () => {
  it("is the Prisma enum, not a copy of it", () => {
    expect([...DASHBOARD_CONTENT_STATUSES].sort()).toEqual(Object.values(ContentStatus).sort());
  });

  it("opens on DRAFT and ends on ARCHIVED — pipeline order, not the alphabet", () => {
    expect(DASHBOARD_CONTENT_STATUSES[0]).toBe(ContentStatus.DRAFT);
    expect(DASHBOARD_CONTENT_STATUSES.at(-1)).toBe(ContentStatus.ARCHIVED);
  });
});

describe("foldContentStatusCounts", () => {
  it("zero-fills every state, so the bars keep a stable segment order", () => {
    const { byStatus } = foldContentStatusCounts([
      { status: ContentStatus.PUBLISHED, _count: { _all: 3 } },
    ]);
    expect(Object.keys(byStatus).sort()).toEqual([...DASHBOARD_CONTENT_STATUSES].sort());
    expect(byStatus.DRAFT).toBe(0);
    expect(byStatus.PUBLISHED).toBe(3);
  });

  it("totals what it breaks down — the bars cannot under-fill their row", () => {
    const grouped = DASHBOARD_CONTENT_STATUSES.map((status, i) => ({
      status,
      _count: { _all: i + 1 },
    }));
    const { byStatus, total } = foldContentStatusCounts(grouped);
    const summed = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(summed);
    expect(total).toBe(grouped.length * (grouped.length + 1) * 0.5);
  });

  it("is all zeroes for a type with no rows at all", () => {
    const { byStatus, total } = foldContentStatusCounts([]);
    expect(total).toBe(0);
    expect(Object.values(byStatus).every((count) => count === 0)).toBe(true);
  });
});

describe("visibleContentEntities", () => {
  it("returns nothing for a subject holding no content key", () => {
    expect(visibleContentEntities(() => false)).toEqual([]);
  });

  it("returns every type for a subject holding all of them", () => {
    expect(visibleContentEntities(() => true)).toEqual([...DASHBOARD_CONTENT_ENTITIES]);
  });

  it("narrows to the types a key actually covers", () => {
    // `courses.view` alone: courses and nothing else. Lessons, quizzes and
    // videos all sit behind `lessons.view` (ADR-058 #6, ADR-068).
    expect(visibleContentEntities((p) => p === "courses.view")).toEqual(["courses"]);
  });

  it("gives lessons, quizzes and videos to the one key they share", () => {
    expect(visibleContentEntities((p) => p === "lessons.view")).toEqual([
      "lessons",
      "quizzes",
      "videos",
    ]);
  });

  it("keeps DASHBOARD_CONTENT_ENTITIES order regardless of which keys are held", () => {
    const held = new Set(["analysis.view", "courses.view"]);
    expect(visibleContentEntities((p) => held.has(p))).toEqual(["courses", "articles"]);
  });
});

describe("DASHBOARD_CONTENT_PERMISSIONS", () => {
  it("is deduped — three types share `lessons.view`", () => {
    expect(new Set(DASHBOARD_CONTENT_PERMISSIONS).size).toBe(DASHBOARD_CONTENT_PERMISSIONS.length);
    expect(DASHBOARD_CONTENT_PERMISSIONS.length).toBeLessThan(DASHBOARD_CONTENT_ENTITIES.length);
  });

  it("covers every entity — no type is reachable with no key at all", () => {
    for (const entity of DASHBOARD_CONTENT_ENTITIES) {
      const visible = DASHBOARD_CONTENT_PERMISSIONS.some((permission) =>
        visibleContentEntities((p) => p === permission).includes(entity),
      );
      expect(visible, `${entity} has no permission key`).toBe(true);
    }
  });

  it("only names `*.view` keys — the dashboard reads, it never writes", () => {
    for (const permission of DASHBOARD_CONTENT_PERMISSIONS) {
      expect(permission).toMatch(/\.view$/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// The window arithmetic every stat card and both series read.
//
// Regression cover for two defects found reviewing ADR-085's charts
// (testing.md #2): daily buckets were anchored at the current TIME of day
// while carrying a `yyyy-mm-dd` label, and the 1y range declared 12 monthly
// buckets for a 365-day window.
// ─────────────────────────────────────────────────────────────

describe("dashboardWindow", () => {
  const noon = new Date("2026-09-12T14:37:11.000Z");

  it("starts the window at the start of a UTC day, not at the current time", () => {
    const { periodStart } = dashboardWindow("30d", noon);
    expect(periodStart.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });

  it("spans the range's own number of calendar days, today included", () => {
    for (const range of DASHBOARD_RANGES) {
      const { periodStart } = dashboardWindow(range, noon);
      const todayStart = Date.UTC(2026, 8, 12);
      const spanDays = (todayStart - periodStart.getTime()) / 86_400_000 + 1;
      expect(spanDays, range).toBe(RANGE_DAYS[range]);
    }
  });

  it("puts the previous window immediately before, same length, no overlap", () => {
    for (const range of DASHBOARD_RANGES) {
      const { periodStart, previousStart } = dashboardWindow(range, noon);
      const length = periodStart.getTime() - previousStart.getTime();
      expect(length / 86_400_000, range).toBe(RANGE_DAYS[range]);
      // Both windows are half-open at `periodStart`, so nothing is counted twice.
      expect(previousStart.getTime()).toBeLessThan(periodStart.getTime());
    }
  });
});

describe("bucketSize", () => {
  it("covers the whole window — nothing is clamped into the last bucket", () => {
    const noon = new Date("2026-09-12T14:37:11.000Z");
    for (const range of DASHBOARD_RANGES) {
      const { unitDays, buckets } = bucketSize(range);
      const { periodStart } = dashboardWindow(range, noon);
      const covered = buckets * unitDays * 86_400_000;
      const span = Date.UTC(2026, 8, 12) - periodStart.getTime() + 86_400_000;
      expect(covered, `${range} loses its most recent rows`).toBeGreaterThanOrEqual(span);
    }
  });

  it("gives the 1y view a bucket for the last month", () => {
    // 12 × 30 = 360 < 365: the five most recent days were folded into a
    // bucket labelled a month earlier.
    const { unitDays, buckets } = bucketSize("1y");
    expect(unitDays).toBe(30);
    expect(buckets * unitDays).toBeGreaterThanOrEqual(365);
  });

  it("keeps a daily bucket on the ranges a reader reads day by day", () => {
    expect(bucketSize("7d")).toEqual({ unitDays: 1, buckets: 7 });
    expect(bucketSize("30d")).toEqual({ unitDays: 1, buckets: 30 });
  });
});
