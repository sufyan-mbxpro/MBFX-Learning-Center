// The seed writes the default Theme row from a JSON mirror of this
// package's defaults, because @repo/db cannot import @repo/theme
// (architecture.md #8). The mirror is kept by hand, and it had drifted:
// before ADR-072 it still carried the pre-changes-03 primary, a raw CSS
// font stack where a curated key belongs (ADR-005), and no baseFontSize —
// so a reseeded install rendered a theme nobody had decided on. Read as a
// file, not imported, so no package dependency is created in either
// direction.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  DEFAULT_DARK_BRAND_OVERRIDES,
  DEFAULT_DARK_SURFACE,
  DEFAULT_LAYOUT,
  DEFAULT_LIGHT_SURFACE,
} from "./index.ts";

const mirror = JSON.parse(
  readFileSync(new URL("../../db/prisma/default-theme-tokens.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("seed mirror (packages/db/prisma/default-theme-tokens.json)", () => {
  it.each([
    ["DEFAULT_BRAND", DEFAULT_BRAND],
    ["DEFAULT_LIGHT_SURFACE", DEFAULT_LIGHT_SURFACE],
    ["DEFAULT_DARK_SURFACE", DEFAULT_DARK_SURFACE],
    ["DEFAULT_DARK_BRAND_OVERRIDES", DEFAULT_DARK_BRAND_OVERRIDES],
    ["DEFAULT_LAYOUT", DEFAULT_LAYOUT],
  ] as const)("%s equals @repo/theme's export exactly", (key, expected) => {
    expect(mirror[key]).toEqual(expected);
  });

  it("carries nothing @repo/theme does not export", () => {
    expect(Object.keys(mirror).sort()).toEqual(
      [
        "DEFAULT_BRAND",
        "DEFAULT_DARK_BRAND_OVERRIDES",
        "DEFAULT_DARK_SURFACE",
        "DEFAULT_LAYOUT",
        "DEFAULT_LIGHT_SURFACE",
      ].sort(),
    );
  });
});
