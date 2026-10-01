// ADR-083 — the permission registry's groups are page-shaped, ordered by code,
// and every key names a group that exists.
//
// Like `role-exclusions.test.ts`, half of this reads `prisma/seed.ts` as SOURCE
// rather than importing it: the seed is a script that connects to a database,
// so importing it to inspect a tuple array would mean standing up MariaDB to
// assert a list of strings. The claim is textual — "every tuple's first element
// is a registered group" — which is exactly what source reading can settle, and
// `check-permission-keys.mjs` reads the same file the same way.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONTENT_LIFECYCLE_GROUPS,
  PERMISSION_GROUPS,
  PERMISSION_GROUP_SECTIONS,
  PERMISSION_SECTIONS,
  permissionGroupOrder,
  permissionGroupSection,
} from "./permission-groups.ts";

const seed = readFileSync(fileURLToPath(new URL("../prisma/seed.ts", import.meta.url)), "utf8");

/** The `["group", "key", "label"]` tuples of the PERMISSIONS registry. */
function permissionTuples(): { group: string; key: string }[] {
  const start = seed.indexOf("const PERMISSIONS = [");
  const end = seed.indexOf("] as const;", start);
  expect(start, "PERMISSIONS registry not found in seed.ts").toBeGreaterThan(-1);
  const block = seed.slice(start, end);
  return [...block.matchAll(/\[\s*"([\w-]+)"\s*,\s*"([a-zA-Z][\w.]*)"\s*,/g)].map((m) => ({
    group: m[1]!,
    key: m[2]!,
  }));
}

describe("the group registry", () => {
  it("lists every group the seed assigns, and nothing it doesn't", () => {
    const used = new Set(permissionTuples().map((t) => t.group));
    // Both directions on purpose. A group in the seed but not here would sort
    // last and render as `humanizeKey()` output; a group here with no keys
    // would draw an empty card with a "Select all" that selects nothing.
    expect([...used].sort()).toEqual([...PERMISSION_GROUPS].sort());
  });

  it("has no duplicate entries", () => {
    expect(new Set(PERMISSION_GROUPS).size).toBe(PERMISSION_GROUPS.length);
  });

  it("orders the cards the way the admin sidebar orders its entries", () => {
    // Learning → Content → People → System, and within each the order of the
    // sidebar's rows (ADR-177). The role editor reads this array's INDEX, so
    // reordering it reorders the screen, which is why the expectation is
    // spelled out rather than derived.
    expect([...PERMISSION_GROUPS]).toEqual([
      "courses",
      "lessons",
      "quizzes",
      "videos",
      "glossary",
      "articles",
      "promotions",
      "tools",
      "market",
      "media",
      "website",
      "users",
      "roles",
      "employees",
      "newsletter",
      "announcements",
      "settings",
      "email",
      "ai",
      "translations",
      "seo",
      "system",
    ]);
  });

  it("puts every card under a sidebar section, in one run per section", () => {
    // The role editor draws a heading wherever the section changes, so a
    // section split in two would draw its heading twice.
    const sections = PERMISSION_GROUPS.map((g) => PERMISSION_GROUP_SECTIONS[g]);
    const runs = sections.filter((section, i) => section !== sections[i - 1]);
    expect(runs).toEqual([...PERMISSION_SECTIONS]);
  });

  it("files an unregistered group under System", () => {
    expect(permissionGroupSection("video_topics")).toBe("system");
    expect(permissionGroupSection("quizzes")).toBe("learning");
  });

  it("sorts an unregistered group last instead of throwing", () => {
    // A database seeded before a rename still holds the old value. It has to
    // render somewhere an admin can see it; vanishing from the editor would
    // hide granted permissions, which is the failure that matters.
    expect(permissionGroupOrder("video_topics")).toBe(PERMISSION_GROUPS.length);
    expect(permissionGroupOrder("courses")).toBe(0);
  });
});

describe("the split of the old `content` group", () => {
  it("covers exactly the keys `content` used to hold, plus their quiz and video twins", () => {
    // `content_manager` was seeded with every key in the one `content` group.
    // The split is display-shaped, so its grant set must not have moved,
    // except for the quiz and video keys ADR-177 cut out of `lessons.*`.
    const covered = permissionTuples()
      .filter((t) => (CONTENT_LIFECYCLE_GROUPS as readonly string[]).includes(t.group))
      .map((t) => t.key)
      .sort();
    expect(covered).toEqual(
      [
        "courses.view",
        "courses.create",
        "courses.update",
        "courses.delete",
        "courses.publish",
        "lessons.view",
        "lessons.create",
        "lessons.update",
        "lessons.delete",
        "lessons.publish",
        // ADR-177: what `lessons.*` used to grant on the quiz and video screens.
        "quizzes.view",
        "quizzes.create",
        "quizzes.update",
        "quizzes.delete",
        "quizzes.publish",
        "videos.view",
        "videos.create",
        "videos.update",
        "videos.delete",
        "videos.publish",
        "glossary.view",
        "glossary.create",
        "glossary.update",
        "glossary.delete",
        "glossary.publish",
        "media.view",
        "media.upload",
        "media.update",
        "media.delete",
        "analysis.view",
        "analysis.create",
        "analysis.update",
        "analysis.delete",
        "analysis.publish",
        "news.manage",
        "comments.moderate",
      ].sort(),
    );
  });

  it("names only registered groups", () => {
    for (const group of CONTENT_LIFECYCLE_GROUPS) {
      expect(PERMISSION_GROUPS).toContain(group);
    }
  });
});

describe("the seed's own use of the registry", () => {
  it("no longer filters on the `content` group", () => {
    // The one line that would silently change `content_manager`'s grants if
    // the split were done without touching it.
    expect(seed).not.toMatch(/g === "content"/);
  });

  it("gives every permission a sort order", () => {
    // Without this the editor falls back to alphabetical within a card, where
    // "create" precedes "view" and the key that grants access at all is fourth.
    expect(seed).toMatch(/sortOrder: sortOrder|label, sortOrder/);
  });
});
