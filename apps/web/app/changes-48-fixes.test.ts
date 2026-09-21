// changes-48 — the owner's fix list, as guards (the `changes-40-fixes` shape).
//
// Each block names the complaint it answers, because a guard whose reason is
// lost is a guard the next person deletes.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import en from "@repo/i18n/messages/en.json" with { type: "json" };

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const ADMIN = "app/(admin)/admin/";

// ─── #1 "show the live button on every module if missing" ────────────────

describe("the quiz editor has a View live button", () => {
  const src = read(ADMIN + "learn/quizzes/[id]/quiz-editor.tsx");

  it("links the quiz's public page through liveHref, in a new tab", () => {
    const anchor = [...src.matchAll(/<a[\s\S]*?\/>/g)]
      .map(([m]) => m)
      .find((a) => a.includes("liveHref("));
    expect(anchor).toBeDefined();
    expect(anchor).toContain("/quizzes/");
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toMatch(/rel="noopener/);
  });

  it("offers it only once the quiz is published — a draft's page is a 404", () => {
    expect(src).toMatch(/initial\.status === "PUBLISHED" && liveSlug/);
  });
});

// ─── #2 "enable & disable … only effect the implemented toggle" ──────────
//
// One `useServerAction` was shared by every row, and each switch was
// `disabled={pending}`: flipping one tag greyed out every switch on the page.

describe("a table row's switch owns its own save", () => {
  const LISTS = [
    "articles/(browse)/tags/tag-controls.tsx",
    "articles/(browse)/categories/category-controls.tsx",
    "articles/(browse)/articles-table.tsx",
    "settings/social/social-links-manager.tsx",
  ];

  it.each(LISTS)("%s renders RowSwitch, never a switch disabled on the shared pending", (file) => {
    const src = read(ADMIN + file);
    expect(src).toContain("<RowSwitch");
    expect(src).not.toMatch(/<Switch[^>]*disabled=\{pending\}/);
  });

  it("RowSwitch is optimistic, reverts on failure and is not disabled while saving", () => {
    const src = read(ADMIN + "_components/row-switch.tsx");
    expect(src).toContain("onError: () => setValue(previous)");
    expect(src).toContain("disabled={disabled}");
    // The attribute, not the header comment that quotes the old bug.
    expect(src).not.toMatch(/^\s+disabled=\{[^}]*pending/m);
  });
});

// ─── #3 "video categories … as a page tab like the news … remove from menu" ─

describe("video categories and glossary topics are tabs, not sidebar rows", () => {
  const shell = read(ADMIN + "_components/admin-shell.tsx");

  it("the sidebar has no row for either", () => {
    expect(shell).not.toContain('"/admin/learn/videos/categories"');
    expect(shell).not.toContain('"/admin/glossary/topics"');
  });

  it.each([
    ["learn/videos/(browse)", ["/admin/learn/videos", "/admin/learn/videos/categories"]],
    ["glossary/(browse)", ["/admin/glossary", "/admin/glossary/topics"]],
  ] as const)("%s has a section layout with the tab strip", (group, hrefs) => {
    const layout = read(`${ADMIN}${group}/layout.tsx`);
    expect(layout).toContain("<SubNav");
    expect(layout).toContain("HeaderActionsProvider");
    for (const href of hrefs) expect(layout).toContain(`"${href}"`);
  });

  it("the editors stay outside the groups, so they do not inherit the strip", () => {
    for (const editor of ["learn/videos/[id]", "glossary/[id]", "glossary/topics/[id]"]) {
      expect(existsSync(resolve(process.cwd(), ADMIN + editor + "/page.tsx"))).toBe(true);
    }
  });

  it("a tab page renders no heading of its own", () => {
    for (const page of [
      "learn/videos/(browse)/page.tsx",
      "learn/videos/(browse)/categories/page.tsx",
      "glossary/(browse)/page.tsx",
      "glossary/(browse)/topics/page.tsx",
    ]) {
      expect(read(ADMIN + page)).not.toContain("<AdminPage");
    }
  });

  it("the Terms tab label exists", () => {
    expect(en.admin.glossaryTermsTab).toBeTruthy();
  });
});

// ─── #4 "add filters to view specific courses or modules … check pagination" ─

describe("the progress screen filters and pages", () => {
  const page = read(ADMIN + "learn/progress/page.tsx");
  const table = read(ADMIN + "learn/progress/_components/analytics-table.tsx");

  it("narrows through @repo/core and counts the tiles for the same scope", () => {
    expect(page).toContain("filterLearnAnalytics(");
    expect(page).toContain("loadLearnAnalyticsSummary(scope)");
    expect(page).toContain("<ProgressFilters");
  });

  it("no table is cut short — every one pages instead", () => {
    expect(page).not.toMatch(/\.slice\(0, 15\)/);
    expect(table).toContain("usePagedList(");
    expect(table).toContain("<ClientPagination");
  });

  it("has a label for every filter", () => {
    const labels = en.admin.analytics;
    for (const key of [
      "filterTrack",
      "filterAllTracks",
      "filterCourse",
      "filterAllCourses",
      "filterSection",
      "filterAllSections",
      "pagerLabel",
      "pagerPage",
      "morePages",
    ] as const) {
      expect(labels[key]).toBeTruthy();
    }
  });

  it("keeps its components private to the screen", () => {
    const dir = resolve(process.cwd(), ADMIN + "learn/progress/_components");
    expect(readdirSync(dir)).toEqual(
      expect.arrayContaining(["analytics-table.tsx", "progress-filters.tsx"]),
    );
  });
});
