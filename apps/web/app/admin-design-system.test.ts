// changes-20 Phase 4 (Q13) — /admin/design-system is a PERMANENT admin
// screen, not a dev tool, so it answers to the admin conventions:
//   · every string is a catalog key that exists (code-style #2, ADR-043 #2 —
//     English-only, but still keyed);
//   · it is not production-gated the way the dev kitchen sink was;
//   · dropdowns are AdminCombobox, never the raw Select (ADR-057, lint).
// Read as source, like the other admin guards: the page is a client board
// under next-intl, and rendering it here would mean standing up the provider.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const PAGE = "app/(admin)/admin/design-system/page.tsx";
const CLIENT = "app/(admin)/admin/design-system/design-system-client.tsx";
const catalog = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../packages/i18n/messages/en.json"), "utf8"),
) as { admin: { designSystem: Record<string, unknown> } };
const ds = catalog.admin.designSystem;

function has(obj: unknown, path: string): boolean {
  return (
    path.split(".").reduce<unknown>((node, key) => {
      if (node && typeof node === "object" && key in node)
        return (node as Record<string, unknown>)[key];
      return undefined;
    }, obj) !== undefined
  );
}

describe("/admin/design-system (changes-20 Phase 4)", () => {
  const client = read(CLIENT);

  it("ships to production — no NODE_ENV gate like the retired kitchen sink", () => {
    expect(read(PAGE)).not.toMatch(/NODE_ENV/);
    expect(client).not.toMatch(/NODE_ENV/);
  });

  it("renders the screen title and description through PageHeader (ADR-044 #8)", () => {
    expect(client).toMatch(
      /<PageHeader\s+title=\{t\("title"\)\}\s+description=\{t\("description"\)\}/,
    );
    expect(has(ds, "title") && has(ds, "description")).toBe(true);
  });

  it.each([
    ["t", ""],
    ["s", "sample."],
    ["state", "states."],
  ] as const)('every %s("…") key it uses exists under admin.designSystem', (fn, prefix) => {
    const keys = [...client.matchAll(new RegExp(`\\b${fn}\\("([\\w.]+)"`, "g"))].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(0);
    const missing = keys.filter((key) => !has(ds, `${prefix}${key}`));
    expect(missing).toEqual([]);
  });

  it("every section id has a title and description in the catalog", () => {
    const union = /type SectionId =([^;]+);/.exec(client)?.[1] ?? "";
    const ids = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      expect(has(ds, `sections.${id}.title`), id).toBe(true);
      expect(has(ds, `sections.${id}.description`), id).toBe(true);
    }
    // …and every <Section id="…"> is one of them.
    const used = [...client.matchAll(/<Section id="(\w+)">/g)].map((m) => m[1]!);
    expect(used.every((id) => ids.includes(id))).toBe(true);
  });

  it("uses AdminCombobox for every dropdown, never the raw Select", () => {
    expect(client).not.toMatch(/@repo\/ui\/components\/select/);
    expect(client).toMatch(/AdminCombobox/);
  });
});
