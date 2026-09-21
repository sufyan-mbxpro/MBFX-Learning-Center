// ADR-107 — one radius scale, derived from `--radius`.
//
// `globals.css` builds four steps from the admin-set `--radius`: sm = r−2,
// md = r, lg = r+2, xl = r+6. A `rounded-2xl` is Tailwind's own 16px literal
// and moves with nothing, so a site whose admin sets a 2px radius still gets
// 16px corners — the token becomes decoration, which is code-style.md #28's
// complaint about settings nothing reads, one layer down.
//
// `rounded-full` is not banned. It is reserved for a shape whose GEOMETRY is a
// circle or a track, and this file checks the one thing a source scan can
// check honestly: that the two DELETED things stay deleted.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [resolve(process.cwd(), "app"), resolve(process.cwd(), "../../packages/ui/src")];

// The Website Builder and the paused surfaces (ADR-042/038) are not brought up
// to design conventions — the same carve-out every other guard here carries.
const OUT_OF_SCOPE = ["website", "homepage", "navigation"].flatMap((dir) => [
  `admin\\${dir}\\`,
  `admin/${dir}/`,
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.(tsx|ts|css)$/.test(entry.name) ? [path] : [];
  });
}

const files = ROOTS.flatMap((root) => sourceFiles(root))
  .filter((path) => !OUT_OF_SCOPE.some((fragment) => path.includes(fragment)))
  // This file names the classes it forbids, as every guard of this shape does.
  .filter((path) => !path.endsWith("radius-scale.test.ts"))
  .map((path) => ({ name: path, src: readFileSync(path, "utf8") }));

describe("ADR-107 #1 — the radius scale is derived, so nothing is off it", () => {
  it("scans a real tree", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  const offenders = files.filter(({ src }) =>
    /\brounded(?:-[trbles]{1,2})?-(?:2xl|3xl|4xl)\b/.test(src),
  );

  it("no file uses a radius above `xl`", () => {
    // `rounded-2xl` was on 27 files before ADR-107, almost all public cards.
    // `rounded-lg` is the card step tokens.md §4.1 already specified.
    expect(offenders.map((f) => f.name)).toEqual([]);
  });
});

describe("ADR-107 #3 — Button's pill shape is gone, not merely unused", () => {
  const button = readFileSync(
    resolve(process.cwd(), "../../packages/ui/src/components/button.tsx"),
    "utf8",
  );

  it("the variant is not declared", () => {
    expect(button).not.toContain("pill:");
    expect(button).not.toContain("rounded-full");
  });

  it("nothing passes it", () => {
    // The failure this catches is a paste from an older screen, which is
    // exactly how thirty-four call sites kept it after ADR-101 removed three.
    const callers = files.filter(({ src }) => src.includes('shape="pill"'));
    expect(callers.map((f) => f.name)).toEqual([]);
  });
});
