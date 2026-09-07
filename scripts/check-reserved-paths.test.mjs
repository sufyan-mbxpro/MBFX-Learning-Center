import { describe, expect, it } from "vitest";
import { checkReservedPaths, extractArrayConst, extractContentRoutes } from "./check-reserved-paths.mjs";

describe("extractArrayConst", () => {
  it("reads a string array literal", () => {
    const source = `export const RESERVED_PATHS = [\n  "news",\n  "admin",\n] as const;`;
    expect(extractArrayConst(source, "RESERVED_PATHS")).toEqual(["news", "admin"]);
  });

  it("returns null when the name is not found", () => {
    expect(extractArrayConst("export const X = 1;", "RESERVED_PATHS")).toBeNull();
  });
});

describe("extractContentRoutes", () => {
  it("reads a string-to-string object literal", () => {
    const source = `export const CONTENT_ROUTES = {\n  news: "/news",\n  course: "/courses",\n} as const;`;
    expect(extractContentRoutes(source)).toEqual({ news: "/news", course: "/courses" });
  });
});

describe("checkReservedPaths", () => {
  const base = {
    routeSegments: ["news", "analysis", "glossary", "sign-in"],
    rootFiles: ["api", "uploads", "robots.txt", "sitemap.xml", "favicon.ico"],
    reservedPaths: [
      "news",
      "analysis",
      "glossary",
      "sign-in",
      "admin",
      "api",
      "uploads",
      "_next",
      "sitemap.xml",
      "robots.txt",
      "favicon.ico",
    ],
    reservedPrefixes: ["courses"],
    contentRoutes: { news: "/news", analysis: "/analysis", glossary: "/glossary", course: "/courses" },
  };

  it("agrees when every route is reserved and every reservation has a route", () => {
    expect(checkReservedPaths(base)).toEqual([]);
  });

  it("flags a real route directory missing from every list", () => {
    const problems = checkReservedPaths({
      ...base,
      routeSegments: [...base.routeSegments, "tools"],
    });
    expect(problems).toEqual([
      'Route directory "tools" under (public)/[locale] is not in RESERVED_PATHS, RESERVED_PREFIXES or CONTENT_ROUTES.',
    ]);
  });

  it("does not flag a route directory covered only by CONTENT_ROUTES (a COLLECTION page's hosting route)", () => {
    const problems = checkReservedPaths({
      ...base,
      routeSegments: [...base.routeSegments, "courses-hosting-route-example"],
      reservedPaths: base.reservedPaths,
      contentRoutes: { ...base.contentRoutes, extra: "/courses-hosting-route-example" },
    });
    expect(problems).toEqual([]);
  });

  it("flags a stale RESERVED_PATHS entry with no route behind it", () => {
    const problems = checkReservedPaths({ ...base, reservedPaths: [...base.reservedPaths, "ghost"] });
    expect(problems).toEqual(['RESERVED_PATHS entry "ghost" has no route file behind it.']);
  });

  it("does not flag the system-exempt entries (admin, _next)", () => {
    expect(checkReservedPaths(base)).toEqual([]);
  });
});
