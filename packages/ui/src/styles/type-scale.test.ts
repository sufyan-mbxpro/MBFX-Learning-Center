// ADR-072 — ONE type scale for both surfaces, asserted against globals.css
// itself (superseding ADR-054's reader/admin split).
//
// Every way this breaks is silent: a literal in a --text-* step detaches it
// from --type-*; a surface-scoped --ui-* override quietly re-creates two
// scales; a step below 10px ships illegible badge text. None of it shows up
// in typecheck or lint, so the contract is pinned here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs with cwd at the package root; import.meta.url is not a file
// URL under the jsdom environment, so resolve from cwd instead.
const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");

/** Every step in the scale, smallest first — the order is the assertion. */
const STEPS = [
  "3xs",
  "2xs",
  "xs",
  "nav",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
] as const;

/** The reference's values (docs/design-system/tokens.md §2.2), size/line-height. */
const EXPECTED: Record<(typeof STEPS)[number], [number, number]> = {
  "3xs": [10, 14],
  "2xs": [11, 16],
  xs: [12, 16],
  nav: [13, 20],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  "2xl": [24, 32],
  "3xl": [30, 36],
  "4xl": [36, 40],
  "5xl": [48, 48],
};

/** Pulls `--name: <value>;` out of the stylesheet. */
function declaration(name: string): string | undefined {
  return new RegExp(`--${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`)
    .exec(css)?.[1]
    ?.trim();
}

function px(name: string): number | undefined {
  const raw = declaration(name);
  const m = raw && /^(\d+(?:\.\d+)?)px$/.exec(raw);
  return m ? Number(m[1]) : undefined;
}

describe("ADR-072 — one scale, defined once", () => {
  it.each(STEPS)("--text-%s reads --type-* and nothing else", (step) => {
    expect(declaration(`text-${step}`)).toBe(`var(--type-${step})`);
    expect(declaration(`text-${step}--line-height`)).toBe(`var(--type-${step}-lh)`);
  });

  it.each(STEPS)("--type-%s carries the reference's size and line-height", (step) => {
    expect([px(`type-${step}`), px(`type-${step}-lh`)]).toStrictEqual(EXPECTED[step]);
  });

  it("is strictly ascending, with no duplicate rung", () => {
    const sizes = STEPS.map((s) => px(`type-${s}`)!);
    expect(sizes).toStrictEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("renders nothing below 10px — the reference's 9px is not carried over", () => {
    for (const step of STEPS) expect(px(`type-${step}`)!).toBeGreaterThanOrEqual(10);
  });

  it("has no surface-scoped override: no --ui-*, no .type-scale-admin, no retired md step", () => {
    // The two-scale mechanism ADR-072 retired. Re-adding any half of it
    // re-creates a second scale that only one surface sees.
    expect(css).not.toMatch(/--ui-[\w-]+\s*:/);
    expect(css).not.toContain(".type-scale-admin");
    expect(declaration("text-md")).toBeUndefined();
    expect(declaration("type-md")).toBeUndefined();
  });
});

describe("the editor previews the reader's size", () => {
  // .ed-fs-* is the author's chosen body size and renders on BOTH surfaces.
  // Reading --type-* directly keeps it independent of any future override.
  it.each(["sm", "base", "lg", "xl", "2xl"])(".ed-fs-%s reads --type-*, not --text-*", (step) => {
    const rule = new RegExp(`\\.ed-fs-${step}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    expect(rule, `.ed-fs-${step} rule is missing`).toBeDefined();
    expect(rule).toContain(`var(--type-${step})`);
    expect(rule).toContain(`var(--type-${step}-lh)`);
    expect(rule).not.toContain("--text-");
  });
});

describe("ADR-072 — shape and elevation tokens", () => {
  it("derives xl as radius + 6px, so the 6px default lands on the reference's 12px", () => {
    expect(declaration("radius-xl")).toBe("calc(var(--radius) + 6px)");
    expect(declaration("radius-md")).toBe("var(--radius)");
  });

  it("uses the reference's control and sidebar dimensions", () => {
    expect(declaration("height-input")).toBe("40px");
    expect(declaration("width-sidebar")).toBe("256px");
  });

  it.each(["sm", "md", "lg", "xl", "2xl", "dock"])("defines --shadow-%s", (step) => {
    expect(declaration(`shadow-${step}`)).toBeDefined();
  });
});
