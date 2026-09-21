// ADR-106 / ADR-140 §3 — one row for a screen's actions, and a tab strip that
// stays put.
//
// Three habits this file exists to stop growing back:
//
//   1. A `flex justify-end` row above a DataTable holding the screen's "New X"
//      button — a row of page carrying one button and a lot of nothing.
//   2. That same button inside the table's toolbar (`DataTable actions=`).
//      ADR-106 §1 put it there; the owner asked for it on the TITLE row,
//      beside Settings, as the standard (ADR-140 §3 supersedes §1). It now
//      goes in `AdminPage actions`, or through `<HeaderActions>` when the
//      heading is drawn by a layout or the dialog belongs to a client manager.
//   3. A section's tab strip rendered by each of its screens, so a tab click
//      unmounts the chrome and builds it again. The strip belongs to the
//      section LAYOUT, which survives a soft navigation.
//
// Read as source, like `admin-dialog-conventions.test.ts` and
// `admin-form-conventions.test.ts`: these are async server components behind a
// session, so the assertion is about what the file says.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "app/(admin)");

// The Website Builder (ADR-042) and the paused surfaces (ADR-038) — the same
// exclusions ADR-044's own guard carries, for the same reason: they are not
// brought up to conventions.
const OUT_OF_SCOPE = ["website", "homepage", "navigation"].flatMap((dir) => [
  `admin\\${dir}\\`,
  `admin/${dir}/`,
]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/** The attribute text of every `<DataTable …>` opening element. A `>` inside
 * `{…}` (an arrow, a JSX prop) does not end the tag. */
function dataTableTags(src: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const start = src.indexOf("<DataTable", from);
    if (start === -1) return tags;
    from = start + "<DataTable".length;
    if (/[A-Za-z0-9]/.test(src[from] ?? "")) continue; // <DataTableSomething
    let depth = 0;
    let end = from;
    for (; end < src.length; end++) {
      const ch = src[end];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    tags.push(src.slice(start, end));
  }
}

const inScope = tsxFiles(ADMIN_ROOT)
  .filter((path) => !OUT_OF_SCOPE.some((fragment) => path.includes(fragment)))
  .map((path) => ({ name: path.slice(ADMIN_ROOT.length + 1), src: readFileSync(path, "utf8") }));

describe("ADR-140 §3 — a screen's primary action is on its title row", () => {
  const withTable = inScope.filter(({ src }) => src.includes("<DataTable"));

  it("finds tables to check at all", () => {
    expect(withTable.length).toBeGreaterThan(10);
  });

  it.each(withTable.map((f) => [f.name, f.src] as const))(
    "%s has no end-aligned action row above its table",
    (_name, src) => {
      // The exact shape that was there: an end-aligned strip that CLOSES
      // immediately before the table opens. Anchoring on `</div>` + the table
      // is what keeps row-action cells — which are also `flex justify-end`,
      // inside a column definition — out of it.
      expect(src).not.toMatch(
        /<div className="flex justify-end">[\s\S]{0,600}?<\/div>\s*<DataTable/,
      );
    },
  );

  // Inverted by ADR-140 §3: the toolbar keeps search, filters, export, the
  // column picker and bulk actions; the create action is not one of them.
  it.each(withTable.map((f) => [f.name, f.src] as const))(
    "%s passes nothing to DataTable's actions slot",
    (_name, src) => {
      for (const tag of dataTableTags(src)) expect(tag).not.toMatch(/\bactions=/);
    },
  );

  it("the News & Analysis layout leaves a slot for the tab's action", () => {
    const src = readFileSync(resolve(ADMIN_ROOT, "admin/articles/(browse)/layout.tsx"), "utf8");
    expect(src).toContain("<HeaderActionsProvider>");
    expect(src).toMatch(/\bactionsSlot\b/);
    // ADR-144 §5: the articles settings screen is gone, so nothing links to it.
    expect(src).not.toContain("/admin/settings/articles");
    for (const page of [
      "admin/articles/(browse)/page.tsx",
      "admin/articles/(browse)/categories/category-controls.tsx",
      "admin/articles/(browse)/tags/tag-controls.tsx",
    ]) {
      expect(readFileSync(resolve(ADMIN_ROOT, page), "utf8")).toContain("<HeaderActions>");
    }
  });

  it("an empty slot does not leave an empty action row behind", () => {
    const src = readFileSync(resolve(ADMIN_ROOT, "admin/_components/admin-page.tsx"), "utf8");
    expect(src).toMatch(/header-actions\]:only-child:empty\)\]:hidden/);
  });
});

describe("ADR-106 #2 — a section's tab strip is rendered by its layout", () => {
  // `SubNav` is the strip. A screen that renders one is a screen that rebuilds
  // it on every tab click; the two settings sub-navs are the exception below.
  const strips = inScope.filter(
    ({ name, src }) =>
      /<SubNav\b|Subnav\s+items=|<[A-Za-z]*Subnav\b/.test(src) &&
      // The components that ARE the strip, and the settings screens, whose
      // vertical sub-sidebar is a column of the screen rather than a tab row
      // above it.
      !name.includes("_components") &&
      !name.includes("settings"),
  );

  it.each(strips.map((f) => [f.name] as const))("%s is a layout", (name) => {
    expect(name.endsWith("layout.tsx")).toBe(true);
  });

  it("the News & Analysis strip is one, and it is the browse layout's", () => {
    const layout = resolve(ADMIN_ROOT, "admin/articles/(browse)/layout.tsx");
    expect(existsSync(layout)).toBe(true);
    const src = readFileSync(layout, "utf8");
    expect(src).toContain("<ArticlesSubnav");
    // The editor is not a fourth tab.
    const editor = readFileSync(resolve(ADMIN_ROOT, "admin/articles/[id]/page.tsx"), "utf8");
    expect(editor).not.toContain("Subnav");
  });
});

describe("ADR-106 #3 — an off-section destination is a header button, not a tab", () => {
  const src = readFileSync(
    resolve(ADMIN_ROOT, "admin/articles/_components/subnav-items.ts"),
    "utf8",
  );
  // The RETURNED list, not the file — the doc comment above it names both
  // removed destinations, which is the whole point of that comment.
  const hrefs = [...src.slice(src.indexOf("return [")).matchAll(/href: "([^"]+)"/g)].map(
    (match) => match[1],
  );

  it("the News & Analysis strip names only its own screens", () => {
    // `/admin/media` leaves the section, so an active state for it is a lie
    // about where you are; Media is in the sidebar. The articles settings
    // screen it once also listed is deleted (ADR-144 §5).
    expect(hrefs).toEqual([
      "/admin/articles",
      "/admin/articles/categories",
      "/admin/articles/tags",
    ]);
  });
});
