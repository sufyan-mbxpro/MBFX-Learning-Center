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

// changes-21 F-01 / D-1: the header row needs 1,239px with the desktop nav in
// it, so the nav shows from xl (1280) and the hamburger serves below. The two
// breakpoints must match, or 1024–1279 shows both or neither.
describe("desktop nav vs hamburger (changes-21 D-1)", () => {
  it("the desktop nav shows from xl", () => {
    const src = read("_nav/site-nav.tsx");
    expect(src).toMatch(/<MegaMenu[^>]*className="hidden xl:block"/);
    expect(src).not.toMatch(/\blg:(block|flex)\b/);
  });

  it("the hamburger hides from xl — the same breakpoint", () => {
    const src = read("_components/mobile-nav.tsx");
    expect(src).toContain('className="xl:hidden"');
    expect(src).not.toContain("lg:hidden");
  });
});

// changes-21 F-02 / D-2: on a 360px phone the header row overflowed by 24px.
// The theme toggle — not Sign in / Join us (ADR-052 entry points) — moves into
// the sheet below sm.
describe("theme toggle placement (changes-21 D-2)", () => {
  it("the header hides its toggle below sm when there is a sheet to hold it", () => {
    expect(read("_components/header.tsx")).toMatch(
      /navItems\.length > 0 \? "hidden sm:flex" : "flex"\}>\s*<ModeToggle \/>/,
    );
  });

  it("the sheet carries it below sm as a labelled Appearance row", () => {
    const src = read("_components/mobile-nav.tsx");
    expect(src).toContain('from "./mode-toggle.tsx"');
    expect(src).toMatch(/className="[^"]*\bsm:hidden\b[^"]*"[\s\S]*?t\("appearance"\)/);
    expect(src).toMatch(/<ModeToggle \/>/);
  });

  it("the header still renders both learner entry points", () => {
    const src = read("_components/auth-slot.tsx");
    expect(src).toContain('href="/sign-in"');
    expect(src).toContain('href="/sign-up"');
  });
});

// changes-21 F-11: one play affordance. VideoCard's disc glyph is size-6; the
// tile and the player had drifted to size-7.
describe("one play glyph size (changes-21 F-11)", () => {
  const glyphs = [
    ["_components/video-tile.tsx", read("_components/video-tile.tsx")],
    ["learn/_components/video-player.tsx", read("learn/_components/video-player.tsx")],
    [
      "@repo/ui video-card.tsx",
      readFileSync(
        resolve(process.cwd(), "../../packages/ui/src/components/video-card.tsx"),
        "utf8",
      ),
    ],
  ] as const;

  it.each(glyphs)("%s draws its Play glyph at size-6", (_, src) => {
    const plays = src.match(/<Play\b[^>]*className="[^"]*"/g) ?? [];
    expect(plays.length).toBeGreaterThan(0);
    for (const play of plays) expect(play).toMatch(/\bsize-6\b/);
  });
});
