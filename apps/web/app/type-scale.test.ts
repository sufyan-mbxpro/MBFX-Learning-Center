// ADR-054 — the admin type scale reaches the admin surface, and only it.
//
// The stylesheet side is asserted in @repo/ui; this is the other half of
// the contract: the class has to actually be ON the admin roots. Both
// failure directions are silent — a missing class renders the reader scale
// in the admin (looks like the ADR regressing), and the class on the public
// root would quietly enlarge the whole public site.
//
// Read as source rather than rendered: these are async server components
// whose bodies await getActiveTheme/auth, so rendering one here would mean
// standing up a database to assert a className.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_TYPE_SCALE_CLASS } from "@repo/ui/lib/type-scale";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const ADMIN_ROOTS = ["app/(admin)/layout.tsx", "app/(admin-auth)/layout.tsx"];
const PUBLIC_ROOT = "app/(public)/[locale]/layout.tsx";

describe("ADR-054 — admin type scale wiring", () => {
  it.each(ADMIN_ROOTS)("%s puts the scale class on <html>", (path) => {
    const src = read(path);
    expect(src).toContain('from "@repo/ui/lib/type-scale"');
    // Interpolated into the <html> className, not merely imported.
    expect(src).toMatch(/className=\{`[^`]*\$\{ADMIN_TYPE_SCALE_CLASS\}[^`]*`\}/);
  });

  it("does not put the scale class on the public root", () => {
    const src = read(PUBLIC_ROOT);
    expect(src).not.toContain("ADMIN_TYPE_SCALE_CLASS");
    expect(src).not.toContain(ADMIN_TYPE_SCALE_CLASS);
  });

  it("keeps the curated font variables alongside it on every root", () => {
    // Regression guard: the scale class is interpolated into the same
    // template literal as curatedFontVariables (ADR-039). Overwriting that
    // string instead of extending it would silently drop the font families,
    // which is exactly the bug that started this whole thread.
    for (const path of [...ADMIN_ROOTS, PUBLIC_ROOT]) {
      expect(read(path), path).toContain("${curatedFontVariables}");
    }
  });
});
