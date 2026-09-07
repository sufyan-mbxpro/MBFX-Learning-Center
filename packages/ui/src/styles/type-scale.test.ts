// ADR-054 — the admin type scale, asserted against globals.css itself.
//
// The mechanism is entirely declarative, and each half of it fails
// SILENTLY: drop the var() indirection and the admin renders the reader
// scale; define --ui-* in :root and the PUBLIC site silently grows. Neither
// shows up in typecheck or lint, so the contract is pinned here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_TYPE_SCALE_CLASS } from "../lib/type-scale.ts";

// vitest runs with cwd at the package root; import.meta.url is not a file
// URL under the jsdom environment, so resolve from cwd instead.
const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");

/** Every step in the scale, smallest first — the order is the assertion. */
const STEPS = ["xs", "sm", "md", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;

/** The admin overrides every step — a partial override left --ui-2xl equal
 *  to the reader's --type-3xl, i.e. a dead step for the first screen to use it. */
const ADMIN_STEPS = STEPS;

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

/** The body of the `.type-scale-admin { … }` rule. */
function adminBlock(): string {
  const start = css.indexOf(`.${ADMIN_TYPE_SCALE_CLASS} {`);
  expect(start, `.${ADMIN_TYPE_SCALE_CLASS} rule is missing`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("ADR-054 — the type scale is one indirection deep", () => {
  it.each(STEPS)("--text-%s falls back from --ui-* to --type-*", (step) => {
    // `@theme inline` substitutes these into every utility at build time.
    // A literal here compiles to a literal font-size and the admin class
    // becomes inert — the exact bug ADR-054 documents as the obvious-but-
    // broken alternative.
    expect(declaration(`text-${step}`)).toBe(`var(--ui-${step}, var(--type-${step}))`);
    expect(declaration(`text-${step}--line-height`)).toBe(
      `var(--ui-${step}-lh, var(--type-${step}-lh))`,
    );
  });

  it.each(STEPS)("--type-%s defines the reader value as a px literal", (step) => {
    expect(px(`type-${step}`), `--type-${step}`).toBeTypeOf("number");
    expect(px(`type-${step}-lh`), `--type-${step}-lh`).toBeTypeOf("number");
  });

  it("the reader scale is strictly ascending", () => {
    const sizes = STEPS.map((s) => px(`type-${s}`)!);
    expect(sizes).toStrictEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});

describe("ADR-054 — the admin scale is opt-in and larger", () => {
  it("never defines --ui-* outside the admin class, so public is untouched", () => {
    // The whole guarantee that this change cannot reach the public site.
    const block = adminBlock();
    const outside = css.replace(block, "");
    expect(outside).not.toMatch(/--ui-[\w-]+\s*:/);
  });

  it("overrides every step, leaving no dead rung in the scale", () => {
    const block = adminBlock();
    const declared = [...block.matchAll(/--ui-([\w-]+?)(-lh)?:/g)].map((m) => m[1]);
    expect(new Set(declared)).toStrictEqual(new Set(ADMIN_STEPS));
  });

  it.each(ADMIN_STEPS)("--ui-%s is strictly larger than the reader step", (step) => {
    const admin = /(\d+(?:\.\d+)?)px/.exec(
      new RegExp(`--ui-${step}:\\s*([^;]+);`).exec(adminBlock())?.[1] ?? "",
    );
    expect(admin, `--ui-${step}`).not.toBeNull();
    expect(Number(admin![1])).toBeGreaterThan(px(`type-${step}`)!);
  });

  it("keeps the admin hierarchy strictly ascending", () => {
    const block = adminBlock();
    const sizes = ADMIN_STEPS.map((s) =>
      Number(/(\d+(?:\.\d+)?)px/.exec(new RegExp(`--ui-${s}:\\s*([^;]+);`).exec(block)![1]!)![1]),
    );
    expect(sizes).toStrictEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});

describe("ADR-054 — the editor previews the reader's size", () => {
  // .ed-fs-* is the author's chosen body size and renders on BOTH surfaces.
  // On --text-* it would inherit the admin override and the editor would
  // stop matching the published article.
  it.each(["sm", "base", "lg", "xl", "2xl"])(".ed-fs-%s reads --type-*, not --text-*", (step) => {
    const rule = new RegExp(`\\.ed-fs-${step}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    expect(rule, `.ed-fs-${step} rule is missing`).toBeDefined();
    expect(rule).toContain(`var(--type-${step})`);
    expect(rule).toContain(`var(--type-${step}-lh)`);
    expect(rule).not.toContain("--text-");
  });
});
