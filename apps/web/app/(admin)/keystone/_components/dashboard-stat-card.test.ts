// changes-26 round two — the meta line under a dashboard figure.
//
// The bug: `DashboardStatCard` rendered its meta line only when a PERCENTAGE
// could be computed, and a previous period of 0 makes the percentage
// undefined. So on a young platform — every content card's previous window
// empty — the line ADR-085 added to the content cards ("12 published this
// period") rendered nowhere at all, which is exactly the case it was written
// for. Found in the dev-server pass, which is why that pass was owed.
//
// Read as source, like the other app-level guards (`top-bar-icons.test.ts`):
// apps/web has no jsdom, its suites are node-environment guards.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const card = readFileSync(
  resolve(process.cwd(), "app/(admin)/keystone/_components/dashboard-stat-card.tsx"),
  "utf8",
);
const page = readFileSync(resolve(process.cwd(), "app/(admin)/keystone/dashboard/page.tsx"), "utf8");

/** The fallback branch: a note with no percentage to hang on still renders. */
const NOTE_FALLBACK = /\)\s*:\s*note\s*\?/;

describe("dashboard stat card", () => {
  it("renders a note with no trend to hang it on", () => {
    expect(card).toMatch(NOTE_FALLBACK);
  });

  it("keeps the trend label a suffix to the percentage", () => {
    // `trendLabel` reads "vs previous period" and means nothing on its own,
    // so it stays inside the branch that prints a number. If it ever moves
    // out, the top row says "vs previous period" next to nothing.
    const trendBranch = card.slice(card.indexOf("trend != null && trendLabel"));
    expect(trendBranch).toMatch(/\{trend\}%/);
    const fallback = trendBranch.search(NOTE_FALLBACK);
    expect(fallback).toBeGreaterThan(-1);
    expect(trendBranch.indexOf("{trendLabel}")).toBeLessThan(fallback);
  });
});

describe("the content library cards", () => {
  it("state the period's own count as a note, not as a trend suffix", () => {
    // The figure on these cards is the LIVE total while the trend compares
    // what was published in each window, so this sentence is what keeps the
    // percentage from being read against the wrong denominator (ADR-085).
    expect(page).toMatch(/note=\{t\("dashboardPublishedInPeriod"/);
    expect(page).not.toMatch(/trendLabel=\{t\("dashboardPublishedInPeriod"/);
  });
});
