// ADR-072 — one type scale for both surfaces, so NO root layout switches it.
//
// ADR-054 put a scale class on the two admin <html> elements; ADR-072
// superseded that with a single scale. The stylesheet side is asserted in
// @repo/ui; this is the layout half: re-adding a surface class here would
// silently re-create a second scale that only one surface sees.
//
// Read as source rather than rendered: these are async server components
// whose bodies await getActiveTheme/auth, so rendering one here would mean
// standing up a database to assert a className.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const ROOTS = [
  "app/(admin)/layout.tsx",
  "app/(admin-auth)/layout.tsx",
  "app/(public)/[locale]/layout.tsx",
];

describe("ADR-072 — no surface-scoped type scale", () => {
  it.each(ROOTS)("%s carries no type-scale class", (path) => {
    const src = read(path);
    expect(src).not.toContain("type-scale");
    expect(src).not.toContain("TYPE_SCALE");
  });

  it.each(ROOTS)("%s keeps the curated font variables on <html>", (path) => {
    // The font families (ADR-005) are interpolated into the <html>
    // className; overwriting that string rather than editing it would drop
    // every curated family, Inter included.
    expect(read(path)).toContain("${curatedFontVariables}");
  });
});
