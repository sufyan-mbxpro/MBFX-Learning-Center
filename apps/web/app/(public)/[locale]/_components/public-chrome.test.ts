// Public chrome guards (ADR-076).
//
// 1. Public pages carry no counted-figures strip. Totals of courses, lessons,
//    quizzes, videos and terms are an operator's numbers; they live on the
//    admin dashboards. The strip had been copied into four mastheads, so a
//    guard is what keeps a fifth from arriving.
// 2. About and the learning schools share ONE section bar. They had drifted
//    into two looks from two hand copies of the same component.
// 3. The header's "Sign in" link stays on one line (changes-20 public spacing
//    pass, ADR-072 §7 — carried over from the deleted stat-strip test).
//
// Read as source: the mastheads are async server components awaiting
// translations, and the properties under test are imports and classes.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "app/(public)/[locale]");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const PUBLIC_SOURCES = sourceFiles(ROOT).map((path) => ({
  path: relative(ROOT, path).replace(/\\/g, "/"),
  src: readFileSync(path, "utf8"),
}));

describe("no counted-figures strip on the public site", () => {
  it("the StatStrip component is gone", () => {
    expect(existsSync(join(ROOT, "_components/stat-strip.tsx"))).toBe(false);
  });

  it.each([
    "learn/_components/learn-masthead.tsx",
    "learn/_components/quiz-masthead.tsx",
    "learn/_components/video-masthead.tsx",
    "glossary/_components/glossary-masthead.tsx",
  ])("%s takes no stats", (path) => {
    const src = read(path);
    expect(src).not.toMatch(/\bstats\b/);
    expect(src).not.toContain("StatStrip");
  });

  // StatCard/StatBand stay in @repo/ui for the About facts band, whose figures
  // are owner-supplied company facts (ADR-047 §2, empty ⇒ not rendered), not
  // row counts. Nothing else on the public site may count-up a total.
  it("only the About facts band renders a StatCard or StatBand", () => {
    const users = PUBLIC_SOURCES.filter(({ src }) =>
      /@repo\/ui\/components\/stat-(card|band)/.test(src),
    ).map(({ path }) => path);
    expect(users).toEqual(["about/_sections/facts-sections.tsx"]);
  });
});

describe("one section bar (ADR-076 §1)", () => {
  it("About and the track layout both render the shared SectionNav", () => {
    expect(read("about/layout.tsx")).toContain('from "../_components/section-nav.tsx"');
    expect(read("learn/[track]/layout.tsx")).toContain('from "../../_components/section-nav.tsx"');
  });

  it("no second copy of the bar exists", () => {
    expect(existsSync(join(ROOT, "about/_components/section-nav.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "learn/_components/learn-section-nav.tsx"))).toBe(false);
  });

  it("is tinted apart from the header, over an opaque ground", () => {
    const src = read("_components/section-nav.tsx");
    // Opaque: the bar is pinned and content scrolls under it.
    expect(src).toContain("bg-background");
    // The tint stays inside TONAL_TINT_CONTRACT (0.15), which is what keeps
    // --primary-interactive legible on it (ADR-073).
    expect(src).toContain("bg-primary/10");
    expect(src).toContain("bg-primary text-primary-foreground");
  });
});

describe("header auth slot", () => {
  it("keeps the Sign in link on one line", () => {
    expect(read("_components/auth-slot.tsx")).toMatch(
      /href="\/sign-in"\s+className="[^"]*whitespace-nowrap/,
    );
  });
});
