// changes-21 Phase A — every async view has a deliberate pending, empty and
// error state, and they all come from @repo/ui. Read as source, like the other
// app-level guards: what matters is which file owns which boundary, and which
// ad-hoc patterns are gone.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const APP = resolve(process.cwd(), "app");
const rel = (file: string) => relative(APP, file).split(sep).join("/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const FILES = walk(APP).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
const source = (file: string) => readFileSync(file, "utf8");

/** Retained, hidden surfaces (ADR-038/042) are not brought up to conventions. */
const RETAINED = /^\(admin\)\/keystone\/(website|homepage|navigation)\//;
const ADMIN_ROOT = join(APP, "(admin)", "keystone");

/** The nearest loading.tsx at or above a page, stopping at the admin root. */
function nearestLoading(pageDir: string): string | null {
  for (let dir = pageDir; dir.startsWith(ADMIN_ROOT); dir = dirname(dir)) {
    const candidate = join(dir, "loading.tsx");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const ADMIN_PAGES = FILES.filter((file) => rel(file).startsWith("(admin)/keystone/"))
  .filter((file) => file.endsWith(`${sep}page.tsx`))
  .filter((file) => !RETAINED.test(rel(file)));

/**
 * Screens that fall back to the generic spinner on purpose: the specimen
 * board renders nothing it waits on, and `/keystone/social` and `/keystone/ai`
 * (changes-51) only redirect.
 */
const GENERIC_FALLBACK_OK = new Set([
  "(admin)/keystone/design-system/page.tsx",
  "(admin)/keystone/social/page.tsx",
  "(admin)/keystone/ai/page.tsx",
  "(admin)/keystone/ai/[...path]/page.tsx",
]);

describe("admin pending states (changes-21 Phase A)", () => {
  it("every live screen owns a shaped skeleton, not only the generic spinner", () => {
    const generic = join(ADMIN_ROOT, "loading.tsx");
    const bare = ADMIN_PAGES.filter((page) => nearestLoading(dirname(page)) === generic)
      .map(rel)
      .filter((page) => !GENERIC_FALLBACK_OK.has(page));
    expect(bare).toEqual([]);
  });

  it("a record route ([id]/[key]) never inherits its list's table skeleton", () => {
    // `[id]`/`[key]` only: `settings/[group]` is a form that correctly shares
    // `settings/loading.tsx`, not one record out of a list.
    const records = ADMIN_PAGES.filter((page) => /\/\[(id|key)\]\/page\.tsx$/.test(rel(page)));
    expect(records.length).toBeGreaterThan(5);
    const inheriting = records
      .filter((page) => !existsSync(join(dirname(page), "loading.tsx")))
      .map(rel);
    expect(inheriting).toEqual([]);
  });

  it("route skeletons come from @repo/ui's page archetypes, not an app-local copy", () => {
    expect(FILES.some((file) => rel(file) === "(admin)/keystone/_components/skeletons.tsx")).toBe(
      false,
    );
    const local = FILES.filter((file) => source(file).includes("_components/skeletons")).map(rel);
    expect(local).toEqual([]);
  });
});

describe("public pending states (changes-21 Phase A)", () => {
  it.each([
    "(public)/[locale]/loading.tsx",
    "(public)/[locale]/glossary/loading.tsx",
    "(public)/[locale]/glossary/[slug]/loading.tsx",
    "(public)/[locale]/learn/[track]/glossary/loading.tsx",
    "(public)/[locale]/learn/[track]/quizzes/[quiz]/loading.tsx",
    "(public)/[locale]/news/preview/[id]/loading.tsx",
  ])("%s exists — without it the route showed nothing, or another route's shape", (path) => {
    expect(existsSync(join(APP, path))).toBe(true);
  });

  it("public loaders read no translations, so they cannot pull request data into the cached shell", () => {
    const loaders = FILES.filter(
      (file) => rel(file).startsWith("(public)/") && file.endsWith(`${sep}loading.tsx`),
    );
    const translating = loaders.filter((file) =>
      /getTranslations|useTranslations/.test(source(file)),
    );
    expect(translating.map(rel)).toEqual([]);
  });

  it("card skeletons are imported from beside their cards, never redrawn locally", () => {
    const copies = FILES.filter((file) =>
      /function (CourseCard|QuizCard|VideoCard)Skeleton\b/.test(source(file)),
    ).map(rel);
    expect(copies).toEqual([]);
  });
});

describe("the ad-hoc patterns are gone (changes-21 Phase A)", () => {
  const live = FILES.filter((file) => !RETAINED.test(rel(file)));

  it.each([
    ["a lucide spinner", /Loader2|LoaderCircle|animate-spin/],
    ["a hand-placed button spinner", /\{\s*(pending|isPending|busy|saving)\s*&&\s*<Spinner/],
    // `motion-safe:animate-pulse` is deliberately NOT matched. The pattern this
    // rule is about is a grey block pretending to be Skeleton; the one live
    // exception is `LiveRatesBoard`'s 8px status dot, which is a placeholder for
    // nothing and stops entirely for a reader who asked for reduced motion. An
    // unprefixed `animate-pulse` still fails.
    ["a hand-rolled pulse", /className="[^"]*(?<!motion-safe:)animate-pulse/],
  ])("no %s — Button `loading` and Skeleton own those", (_, pattern) => {
    expect(live.filter((file) => pattern.test(source(file))).map(rel)).toEqual([]);
  });

  it.each([
    ["(admin)/error.tsx", "ErrorState"],
    ["(admin)/not-found.tsx", "EmptyState"],
    ["(public)/[locale]/error.tsx", "ErrorState"],
    // changes-49: the public 404s share the designed coming-soon view.
    ["(public)/[locale]/not-found.tsx", "NotFoundView"],
    ["global-error.tsx", "ErrorState"],
    ["global-not-found.tsx", "NotFoundView"],
    ["(not-found)/not-found.tsx", "NotFoundView"],
  ])("%s renders the shared %s", (path, component) => {
    const file = join(APP, path);
    expect(existsSync(file)).toBe(true);
    expect(source(file)).toContain(component);
  });
});

// changes-21 F-06: `reset` re-renders WITHOUT re-fetching, so "Try again"
// could not recover from a server-side failure. `retry` re-fetches first
// (stable since Next 16.3; the installed error.md recommends it over `reset`).
describe("error boundaries retry, never reset (changes-21 F-06)", () => {
  const boundaries = FILES.filter((file) => /(^|\/)(global-)?error\.tsx$/.test(rel(file)));

  it("finds the admin, public and global boundaries", () => {
    expect(boundaries.map(rel).sort()).toEqual(
      ["(admin)/error.tsx", "(public)/[locale]/error.tsx", "global-error.tsx"].sort(),
    );
  });

  it.each(boundaries.map((file) => [rel(file), file]))(
    "%s takes `retry` and wires it to the button",
    (_, file) => {
      const src = source(file);
      expect(src).toMatch(/\{\s*retry\s*\}:\s*\{[^}]*retry:\s*\(\)\s*=>\s*void/);
      expect(src).toContain("onClick={retry}");
      // Code only: each boundary's comment explains why `reset` is not used.
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code).not.toMatch(/\breset\b/);
    },
  );
});
