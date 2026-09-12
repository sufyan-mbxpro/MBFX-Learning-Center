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
  permissionGroupOrder,
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

  it("orders the cards the way the admin sidebar orders its sections", () => {
    // People → Learning → Content → data/reach → System. The role editor reads
    // this array's INDEX, so reordering it reorders the screen — which is the
    // point, and is why the expectation is spelled out rather than derived.
    expect([...PERMISSION_GROUPS]).toEqual([
      "users",
      "employees",
      // ADR-080 #7, added by changes-21 F7. It sits with People because the
      // sidebar entry does — a subscriber list is an audience, curated by
      // whoever manages users, not by whoever can repoint the SMTP host.
      "newsletter",
      "learning",
      "glossary",
      "media",
      "articles",
      "website",
      "market",
      "translations",
      "seo",
      "email",
      "settings",
      "system",
    ]);
  });

  it("sorts an unregistered group last instead of throwing", () => {
    // A database seeded before a rename still holds the old value. It has to
    // render somewhere an admin can see it; vanishing from the editor would
    // hide granted permissions, which is the failure that matters.
    expect(permissionGroupOrder("video_topics")).toBe(PERMISSION_GROUPS.length);
    expect(permissionGroupOrder("users")).toBe(0);
  });
});

describe("the split of the old `content` group", () => {
  it("covers exactly the keys `content` used to hold", () => {
    // `content_manager` was seeded with every key in the one `content` group.
    // The split is display-shaped, so its grant set must not have moved.
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
