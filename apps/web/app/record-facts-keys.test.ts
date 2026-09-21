// `RecordFacts` keys its rows by `fact.id ?? fact.label`. A label is unique on
// a fixed form (Email, Phone, Joined) and NOT on a list built from records: the
// user page's Activity tab printed "Users Update" once per audit row and React
// reported duplicate keys, which is how rows get dropped or duplicated on the
// next update. So every call site that MAPS records into facts must pass an id.
//
// Read as source, following `admin-dialog-conventions.test.ts`: the pages are
// async server components awaiting a session.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "app/(admin)");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

// `facts={something.map((row) => ({` followed by the object's first key.
const MAPPED_FACTS = /facts=\{[\w.]+\.map\(\(\w+\) => \(\{\s*(\w+):/g;

const sites = tsxFiles(ADMIN_ROOT).flatMap((path) =>
  [...readFileSync(path, "utf8").matchAll(MAPPED_FACTS)].map((match) => ({
    file: path.slice(ADMIN_ROOT.length + 1),
    firstKey: match[1],
  })),
);

describe("RecordFacts built from records carry a row id", () => {
  it("finds mapped RecordFacts call sites at all", () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it.each(sites)("$file passes `id` first", ({ firstKey }) => {
    expect(firstKey).toBe("id");
  });
});
