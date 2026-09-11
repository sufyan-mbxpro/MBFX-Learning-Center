// Regression (changes-20 public spacing pass, ADR-072 §7): at the 14px scale
// two public layouts gave way on a 390px phone.
//
// 1. The masthead figure strip stacked its three figures (~370px of screen for
//    three numbers). It was copied into four mastheads, so the fix is ONE
//    `StatStrip` that stays a single row, and no masthead keeps a private copy.
// 2. The header's "Sign in" link wrapped onto two lines beside "Join us".
//
// Read as source: the mastheads are async server components awaiting
// translations, and the properties under test are classes and imports.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), "app/(public)/[locale]", path), "utf8");

const MASTHEADS = [
  "learn/_components/learn-masthead.tsx",
  "learn/_components/quiz-masthead.tsx",
  "learn/_components/video-masthead.tsx",
  "glossary/_components/glossary-masthead.tsx",
];

describe("StatStrip", () => {
  const strip = read("_components/stat-strip.tsx");

  it("stays one row at every width, sized to the items it renders", () => {
    expect(strip).toContain('"grid auto-cols-fr grid-flow-col divide-x divide-border"');
    // A breakpoint column count is exactly how the stacked phone layout came back.
    expect(strip).not.toMatch(/\S+:grid-cols-/);
  });

  it.each(MASTHEADS)("%s uses it instead of a private copy", (path) => {
    const src = read(path);
    expect(src).toContain("<StatStrip");
    expect(src).not.toMatch(/function StatItem\b/);
    expect(src).not.toContain("sm:grid-cols-3");
  });
});

describe("header auth slot", () => {
  it("keeps the Sign in link on one line", () => {
    expect(read("_components/auth-slot.tsx")).toMatch(
      /href="\/sign-in"\s+className="[^"]*whitespace-nowrap/,
    );
  });
});
