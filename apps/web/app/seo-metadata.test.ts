// ADR-090 — the three SEO wirings that nothing could catch by type.
//
// Read as SOURCE, like `grid-base.test.ts` and `public-chrome.test.ts`: all
// three are server-side metadata, and there is no render to assert against.
// Each case below failed before the fix, and where a regex could silently
// match nothing there is a second assertion proving it still matches.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = resolve(process.cwd(), "app");
const PUBLIC_ROOT_LAYOUT = resolve(APP, "(public)/[locale]/layout.tsx");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Code without comments. The `robots` rule below is one this repo's own prose
 * has to be able to NAME — the first run of this file failed on the sentences
 * explaining the fix, inside the two files that carry the fix.
 *
 * The `[^:]` guard keeps a `https://` inside a string from eating its line.
 */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    const isSource = /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.");
    return entry.isFile() && isSource ? [path] : [];
  });
}

const relative = (path: string) => path.slice(APP.length + 1).replaceAll("\\", "/");

describe("metadataBase", () => {
  // The bug: relative OG images and JSON-LD urls resolved against Next's
  // localhost fallback in production. It neither throws nor warns — the share
  // card just fails wherever it is unfurled.
  it("is set on the public root layout", () => {
    expect(read(PUBLIC_ROOT_LAYOUT)).toContain("metadataBase: new URL(siteUrl())");
  });
});

describe("the origin has one owner", () => {
  const FALLBACK = 'process.env.BETTER_AUTH_URL ?? "http://localhost:3000"';

  it("is spelled out only in site-url.ts", () => {
    const offenders = sourceFiles(APP)
      .filter((path) => read(path).includes(FALLBACK))
      .map(relative)
      .filter((rel) => rel !== "_lib/site-url.ts");
    expect(offenders).toEqual([]);
  });

  it("and is still spelled out there, so the check above is not vacuous", () => {
    expect(read(resolve(APP, "_lib/site-url.ts"))).toContain(FALLBACK);
  });
});

/**
 * The value text of every `robots:` property in a source file.
 *
 * A regex was the first attempt and it was WRONG in the quiet direction: it
 * forbade a comma, so it could never reach past `{ index: false, follow: … }`
 * to the `: undefined` after it. It matched only this repo's prose about the
 * bug, which is how it passed while the bug was reintroduced on purpose.
 *
 * So: scan forward from the key, tracking bracket depth, and stop at the
 * comma that ends the property. That reads the value a parser would.
 */
function robotsPropertyValues(src: string): string[] {
  const values: string[] = [];
  for (const match of src.matchAll(/\brobots\s*:/g)) {
    let i = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let value = "";
    while (i < src.length) {
      const ch = src[i];
      if (ch === undefined) break;
      if (ch === "{" || ch === "[" || ch === "(") depth += 1;
      else if (ch === "}" || ch === "]" || ch === ")") {
        if (depth === 0) break;
        depth -= 1;
      } else if (ch === "," && depth === 0) break;
      value += ch;
      i += 1;
    }
    values.push(value.trim());
  }
  return values;
}

describe("robots never arrives as an undefined key", () => {
  // Next 16's `mergeMetadata` iterates the child's PRESENT keys, and
  // `resolveRobots(undefined)` is null — so `robots: cond ? {…} : undefined`
  // ERASES the root layout's site-wide directive instead of inheriting it.
  // A conditional spread omits the key entirely, which is what inherits.
  const erases = (value: string) => value.endsWith("undefined");

  it("in any public route", () => {
    const offenders = sourceFiles(resolve(APP, "(public)"))
      .filter((path) => robotsPropertyValues(code(path)).some(erases))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("and the scanner still reads the shape it forbids", () => {
    const bad = "robots: cond ? { index: false, follow: false } : undefined,\n  next: 1,";
    expect(robotsPropertyValues(bad).some(erases)).toBe(true);
    const good = "...(cond ? { robots: { index: false, follow: false } } : {}),";
    expect(robotsPropertyValues(good).some(erases)).toBe(false);
  });

  it("and it found the routes that set robots at all, so it is not scanning nothing", () => {
    const seen = sourceFiles(resolve(APP, "(public)")).flatMap((path) =>
      robotsPropertyValues(code(path)),
    );
    expect(seen.length).toBeGreaterThan(5);
  });
});

describe("the seo settings are read, not just stored", () => {
  // Both were seeded, typed and editable at /admin/settings/seo while nothing
  // read them: turning "Allow search indexing" off changed nothing a crawler
  // saw, and the verification token never reached a meta tag.
  it("seo.robotsIndex gates robots.txt", () => {
    expect(read(resolve(APP, "robots.ts"))).toContain('getSetting("seo.robotsIndex")');
  });

  it("seo.robotsIndex also reaches the page-level directive", () => {
    expect(read(PUBLIC_ROOT_LAYOUT)).toContain("allowIndexing === false");
  });

  it("seo.googleSiteVerification reaches the verification tag", () => {
    const layout = read(PUBLIC_ROOT_LAYOUT);
    expect(layout).toContain('getSetting("seo.googleSiteVerification")');
    expect(layout).toContain("verification: { google: googleVerification }");
  });
});

describe("the sitemap reads through the cache", () => {
  it("calls the one cached aggregate, not the seven raw loaders", () => {
    const src = code(resolve(APP, "sitemap.ts"));
    expect(src).toContain("getSitemapEntries()");
    expect(src).not.toMatch(/loadGlossarySitemapEntries|loadArticleSitemapEntries/);
  });
});
