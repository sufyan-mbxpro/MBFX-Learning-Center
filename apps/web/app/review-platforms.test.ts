// ADR-169 / changes-53 — the reviews band draws one button per switched-on
// review platform. Read as SOURCE (see `support-page.test.ts` for why): what
// matters is that every registry platform can be drawn and named, and that
// the band keeps ADR-135's link discipline.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REVIEW_PLATFORM_KEYS } from "@repo/contracts";
import { isSocialGlyphName } from "@repo/ui/components/social-glyph";

const APP_ROOT = resolve(process.cwd(), "app");
const MESSAGES = resolve(process.cwd(), "../../packages/i18n/messages");
const catalog = (locale: string) =>
  JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), "utf8")) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- a parsed catalog is untyped JSON
const withoutComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const BAND = withoutComments(
  readFileSync(resolve(APP_ROOT, "(public)/[locale]/_components/reviews-band.tsx"), "utf8"),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("every review platform can be drawn", () => {
  it.each(REVIEW_PLATFORM_KEYS)("%s has a built-in glyph", (platform) => {
    expect(isSocialGlyphName(platform)).toBe(true);
  });

  it.each(["en", "ar"])("%s names every platform's button (ar is enforced)", (locale) => {
    const labels = catalog(locale).public.reviews.platforms as Record<string, string>;
    expect(Object.keys(labels).sort()).toEqual([...REVIEW_PLATFORM_KEYS].sort());
    for (const label of Object.values(labels)) expect(label.trim()).not.toBe("");
  });

  it("names every platform on the admin screen", () => {
    const admin = catalog("en").admin.reviewPlatforms;
    for (const platform of REVIEW_PLATFORM_KEYS) {
      expect(admin.platforms[platform]).toBeTruthy();
      expect(admin.identifier[platform]).toBeTruthy();
      expect(admin.identifierHint[platform]).toBeTruthy();
    }
    expect(catalog("en").admin.settingsTabs.reviews).toBeTruthy();
  });
});

describe("the reviews band (ADR-135, ADR-169)", () => {
  it("reads the active platforms, and is absent when none is on", () => {
    expect(BAND).toMatch(/getActiveReviewLinks\(\)/);
    expect(BAND).toMatch(/if \(links\.length === 0\) return null;/);
  });

  it("opens each review page in a new tab, without an opener, and says so", () => {
    expect(BAND).toMatch(/target="_blank"/);
    expect(BAND).toMatch(/rel="noopener noreferrer"/);
    expect(BAND).toMatch(/t\("reviews\.newTab"\)/);
  });

  it("loads no vendor script (no CSP exception, ADR-135)", () => {
    expect(BAND).not.toMatch(/<script|next\/script|trustpilot\.com\/.*\.js|widget/i);
  });
});

describe("site.reviewsUrl is gone (ADR-169 #8)", () => {
  it("is read by no app source", () => {
    const offenders = sourceFiles(APP_ROOT).filter((file) =>
      withoutComments(readFileSync(file, "utf8")).includes("site.reviewsUrl"),
    );
    expect(offenders).toEqual([]);
  });
});
