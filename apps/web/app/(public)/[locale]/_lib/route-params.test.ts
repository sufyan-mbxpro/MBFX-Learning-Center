import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeParams, decodeSegment } from "./route-params.ts";

const ARABIC = "كيفية-حساب-هامش-الفوركس-قبل-فتح-صفقة";

describe("decodeSegment", () => {
  it("decodes a percent-encoded translated slug", () => {
    expect(decodeSegment(encodeURIComponent(ARABIC))).toBe(ARABIC);
  });

  it("leaves an already-decoded slug alone", () => {
    expect(decodeSegment(ARABIC)).toBe(ARABIC);
    expect(decodeSegment("how-to-calculate-margin")).toBe("how-to-calculate-margin");
  });

  it("returns a malformed escape unchanged instead of throwing", () => {
    expect(decodeSegment("bad-%E0%A4%A")).toBe("bad-%E0%A4%A");
  });
});

describe("decodeParams", () => {
  it("decodes strings and catch-all arrays, keeping the shape", () => {
    expect(
      decodeParams({
        locale: "ar",
        slug: encodeURIComponent(ARABIC),
        path: [encodeURIComponent(ARABIC), "x"],
      }),
    ).toEqual({ locale: "ar", slug: ARABIC, path: [ARABIC, "x"] });
  });
});

// The regression: a route that looks a translated slug up must decode its
// params first, or a non-ASCII URL 404s on the pass that receives it encoded.
const SLUG_ROUTES = [
  "news/[slug]/page.tsx",
  "news/category/[slug]/page.tsx",
  "news/tag/[slug]/page.tsx",
  "glossary/[slug]/page.tsx",
  "glossary/topics/[topic]/page.tsx",
  "learn/[track]/[course]/page.tsx",
  "learn/[track]/[course]/[lesson]/page.tsx",
  "learn/[track]/quizzes/[quiz]/page.tsx",
  "learn/[track]/videos/[topic]/page.tsx",
  "learn/[track]/videos/categories/[category]/page.tsx",
  "[...slug]/page.tsx",
];

const LOCALE_DIR = join(__dirname, "..");

function pagesWithDynamicSegment(dir: string, rel = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) found.push(...pagesWithDynamicSegment(full, relPath));
    else if (name === "page.tsx" && /\[[^\]]+\]/.test(rel)) found.push(relPath);
  }
  return found;
}

describe("translated-slug routes", () => {
  it.each(SLUG_ROUTES)("%s reads its params through decodeParams", (route) => {
    const source = readFileSync(join(LOCALE_DIR, route), "utf8");
    const reads = source.match(/await params\b/g) ?? [];
    const decoded = source.match(/decodeParams\(await params\)/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    expect(decoded.length).toBe(reads.length);
  });

  it("every dynamic-segment page is either listed above or reads only code keys", () => {
    // [track] and [tool] are registry keys and [id] a cuid, never translated;
    // a new route with a translated slug belongs in SLUG_ROUTES.
    const CODE_KEY_ONLY = new Set([
      "news/preview/[id]/page.tsx",
      "learn/[track]/page.tsx",
      "learn/[track]/glossary/page.tsx",
      "learn/[track]/quizzes/page.tsx",
      "learn/[track]/videos/page.tsx",
      "tools/[tool]/page.tsx",
    ]);
    const unlisted = pagesWithDynamicSegment(LOCALE_DIR).filter(
      (page) => !SLUG_ROUTES.includes(page) && !CODE_KEY_ONLY.has(page),
    );
    expect(unlisted).toEqual([]);
  });
});
