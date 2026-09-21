import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// next-intl refuses a message key containing "." — the character expresses
// NESTING in its message tree, so a flat `"site.defaultThemeMode"` is an
// `INVALID_KEY` error thrown while the provider builds, on every render of
// every page that mounts it.
//
// It cost nothing visible and was therefore easy to miss: `t.has()` returned
// false, `optionLabel` fell through to `humanizeKey()`, and the SELECT still
// showed words. The only symptom was an error in the dev overlay and in the
// server log on every request.
//
// It is a shape rule, not a naming preference, and nothing else catches it:
// TypeScript sees a `Record<string, ...>` either way, and the catalog
// completeness check compares key SETS, so a flat key and its nested
// equivalent look identical to it.

const MESSAGES = join(import.meta.dirname, "../../../packages/i18n/messages");
const files = readdirSync(MESSAGES).filter((name) => name.endsWith(".json"));

/** Every key path in the tree whose own segment contains a dot. */
function dottedKeys(value: unknown, trail: string[] = []): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(key.includes(".") ? [[...trail, key].join(" > ")] : []),
    ...dottedKeys(child, [...trail, key]),
  ]);
}

describe("message catalogs — no key may contain a dot", () => {
  it.each(files)("%s", (name) => {
    const tree: unknown = JSON.parse(readFileSync(join(MESSAGES, name), "utf8"));
    // A nested object is how you say `a.b.c` to next-intl. `t("a.b.c")` reads
    // it; a literal `"a.b.c"` key is an error at provider-build time.
    expect(dottedKeys(tree)).toEqual([]);
  });
});
