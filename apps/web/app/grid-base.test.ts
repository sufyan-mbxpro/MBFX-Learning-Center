// changes-20 Phase 6 — a responsive grid states its one-column base.
//
// `grid lg:grid-cols-2` is ONE implicit `auto` track below `lg`, and an auto
// track sizes to its items' min-content. Chrome reports a line-clamped
// excerpt's min-content as its UNWRAPPED width, so that one track grew past
// the screen and phones scrolled sideways — found three times in one browser
// pass (the homepage's news rail at 1307px, the /news spotlight and the
// /news page grid), each a different file with the same shape. An explicit
// `grid-cols-1` is `repeat(1, minmax(0, 1fr))` in Tailwind v4: the same one
// column, but it can never outgrow its container.
//
// Read as source over every class string, like `admin-page-conventions`.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [resolve(process.cwd(), "app"), resolve(process.cwd(), "../../packages/ui/src")];

// The cancelled Website Builder (ADR-042) and paused homepage composer
// (ADR-038) are retained, not maintained — the same exclusion as the lint.
const OUT_OF_SCOPE = ["website", "homepage"].flatMap((d) => [`keystone\\${d}\\`, `keystone/${d}/`]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

const STRING = /(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

/** Class strings that make a grid whose only column template is behind a variant. */
function unbasedGrids(src: string): string[] {
  const found: string[] = [];
  for (const [, , body = ""] of src.matchAll(STRING)) {
    // An interpolated template picks its columns at runtime.
    if (body.includes("${")) continue;
    const tokens = body.split(/\s+/);
    if (!tokens.includes("grid")) continue;
    const base = tokens.some((t) => t.startsWith("grid-cols-"));
    const prefixed = tokens.some((t) => /^\S+:grid-cols-/.test(t));
    if (prefixed && !base) found.push(body);
  }
  return found;
}

const files = ROOTS.flatMap(tsxFiles).filter(
  (path) => !OUT_OF_SCOPE.some((fragment) => path.includes(fragment)),
);

describe("changes-20 Phase 6 — responsive grids state grid-cols-1", () => {
  it("scans the app and @repo/ui at all", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("finds the unbased shape when it is there (guards the guard)", () => {
    expect(unbasedGrids('className="grid gap-6 lg:grid-cols-2"')).toHaveLength(1);
    expect(unbasedGrids('className="grid grid-cols-1 gap-6 lg:grid-cols-2"')).toHaveLength(0);
    expect(unbasedGrids('className="grid gap-6"')).toHaveLength(0);
  });

  it("no responsive grid falls back to an implicit auto track", () => {
    const offenders = files.flatMap((path) =>
      unbasedGrids(readFileSync(path, "utf8")).map(
        (body) => `${path.slice(process.cwd().length)}: "${body.slice(0, 90)}"`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
