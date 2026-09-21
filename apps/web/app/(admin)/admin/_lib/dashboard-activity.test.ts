// changes-43 — the dashboard's recent-activity glyphs and the stat tiles'
// ratio bars.
//
// apps/web has no jsdom; like `dashboard-stat-card.test.ts`, the page-level
// half is read as source.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Activity, Pencil, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { activityKind } from "./dashboard-activity.ts";

describe("activityKind", () => {
  it.each([
    ["article.publish", Send],
    ["course.created", Plus],
    ["user.delete", Trash2],
    ["user.role.assign", ShieldCheck],
    ["theme.update", Pencil],
  ])("%s", (action, icon) => {
    expect(activityKind(action).icon).toBe(icon);
  });

  it("matches whole segments, so `ban` does not claim `banner`", () => {
    expect(activityKind("banner.update").icon).toBe(Pencil);
    expect(activityKind("settings.bulk").icon).toBe(Activity);
  });

  it("falls back to the neutral mark rather than guessing", () => {
    expect(activityKind("something.unheard_of").icon).toBe(Activity);
  });
});

const page = readFileSync(resolve(process.cwd(), "app/(admin)/admin/(dashboard)/page.tsx"), "utf8");

describe("the stat tiles' ratio bars", () => {
  it("draw nothing against a zero or unread denominator", () => {
    // An empty bar reads as "0%", a claim about data nobody measured — the
    // same rule that makes a hidden tile absent rather than zero.
    expect(page).toMatch(/if \(total === undefined \|\| total <= 0\) return undefined;/);
  });

  it("keep every tile a watermark", () => {
    const grid = page.slice(page.indexOf("statCards.map"));
    expect(grid.slice(0, grid.indexOf("))}"))).toMatch(/\bwatermark\b/);
  });
});
