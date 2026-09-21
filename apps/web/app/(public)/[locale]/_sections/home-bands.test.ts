// The three owner-supplied home bands (changes-31, ADR-103).
//
// ADR-103 §3 is the rule worth a test: an empty collection renders NOTHING —
// not a heading over an empty grid, not a zero. It is easy to hold today and
// easy to lose the first time someone adds a "no testimonials yet" empty state,
// so it is asserted rather than trusted.
//
// Read as source, like `public-chrome.test.ts` beside it and for the same
// reason: these are async server components, and apps/web's vitest config
// carries no JSX transform because nothing here has ever needed to render one.
// What is under test is a property of the code a reviewer checks by reading —
// that the empty check comes FIRST and returns null.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOME_SECTION_BUILT_KEYS,
  HOME_SECTION_STUB_KEYS,
  isKnownHomeSectionKey,
} from "@repo/contracts";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const NEW_KEYS = ["trust_strip", "facts", "testimonials"] as const;

const BANDS = [
  ["facts", "_sections/facts.tsx", "facts"],
  ["trust_strip", "_sections/trust-strip.tsx", "partners"],
  ["testimonials", "_sections/testimonials.tsx", "testimonials"],
] as const;

describe("ADR-103 §3 — an empty dataset renders no band", () => {
  it.each(BANDS)("%s returns null on an empty collection", (_key, path, field) => {
    const src = read(path);
    expect(src).toMatch(new RegExp(`if \\(${field}\\.length === 0\\) return null;`));
  });

  it.each(BANDS)("%s makes that check before it awaits anything", (_key, path, field) => {
    const src = read(path);
    const guard = src.indexOf(`if (${field}.length === 0) return null;`);
    const firstAwait = src.indexOf("await ");
    expect(guard).toBeGreaterThan(-1);
    // An await ahead of the guard would mean a translation fetch — or worse, a
    // query — on a band that is about to render nothing.
    if (firstAwait !== -1) expect(guard).toBeLessThan(firstAwait);
  });

  // Deliberately NOT a "contains no empty-state markup" assertion: every
  // honest spelling of that guard ("empty", "none", "yet") also matches the
  // prose explaining why there is no empty state, so it fails on its own
  // documentation. The null-return check above is the property; this is the
  // narrower thing that can actually be told apart — an `Empty` COMPONENT.
  it.each(BANDS)("%s imports no Empty component", (_key, path) => {
    expect(read(path)).not.toMatch(/components\/empty/);
  });
});

describe("ADR-103 §5 — the three keys are registered everywhere", () => {
  it.each(NEW_KEYS)("%s is a built key, not a stub", (key) => {
    expect(HOME_SECTION_BUILT_KEYS as readonly string[]).toContain(key);
    expect(HOME_SECTION_STUB_KEYS as readonly string[]).not.toContain(key);
  });

  // Deliberately NOT in HOME_SECTION_VARIANTS: each has one shape, and what
  // varies about `testimonials` is the COUNT, which is `limit`. An empty
  // variant list would reject every variant while looking like it configured
  // something — the trap `connect` and `risk_disclaimer` already avoid.
  it.each(NEW_KEYS)("%s declares no variant vocabulary", (key) => {
    expect(isKnownHomeSectionKey(key)).toBe(false);
  });

  it("each has a pending shape, because a boundary paints before the data is known", () => {
    const src = read("_sections/registry.ts");
    for (const key of NEW_KEYS) {
      expect(src).toMatch(new RegExp(`\\b${key}:\\s*\\{`));
    }
  });
});

describe("ADR-103 §4 — two states, never a mixture", () => {
  it("one switch decides, with no per-field override", () => {
    const src = read("_content/home-facts.ts");
    expect(src).toContain("HOME_CONTENT_MODE");
    expect(src).toContain("REAL_HOME_FACTS");
    expect(src).toContain("DEMO_HOME_FACTS");
  });

  it("the real dataset ships EMPTY — the owner has supplied nothing yet", () => {
    const src = read("_content/home-facts.ts");
    // Read as source: importing it would be mocked out above, and what is
    // under test is what the file SAYS, which is what a reviewer checks.
    expect(src).toMatch(/facts: \[\],/);
    expect(src).toMatch(/partners: \[\],/);
    expect(src).toMatch(/testimonials: \[\],/);
  });

  it("the demo dataset names no real organisation or person", () => {
    // ADR-103 §4: an invented figure is a placeholder; an invented PARTNER is
    // a false statement about someone who exists. The demo names are generic
    // by construction and the attributions are obviously placeholders.
    const src = read("_content/home-facts.demo.ts");
    expect(src).toMatch(/name: "[A-Z]\. Demo"/);
    // No partner carries a logo file or an outbound link — a mark and a URL
    // are what make a row read as a real relationship.
    expect(src).not.toMatch(/logo: "/);
    expect(src).not.toMatch(/href: "/);
  });
});
