import { describe, expect, it } from "vitest";
import {
  CONTENT_ROUTES,
  derivePagePath,
  firstPathSegment,
  isReservedFirstSegment,
  pageSlugSchema,
  publicPagePath,
  RESERVED_PATHS,
  RESERVED_PREFIXES,
} from "./paths.ts";

describe("pageSlugSchema", () => {
  it("lower-cases and hyphenates", () => {
    expect(pageSlugSchema.parse("  Pip Calculator  ")).toBe("pip-calculator");
  });

  it("strips diacritics and non-latin punctuation, keeping the Arabic block", () => {
    expect(pageSlugSchema.parse("café!!!")).toBe("cafe");
    expect(pageSlugSchema.parse("حول")).toBe("حول");
  });

  it("allows an empty result (the home page's slug)", () => {
    expect(pageSlugSchema.parse("")).toBe("");
  });

  it("trims leading/trailing hyphens produced by normalisation", () => {
    expect(pageSlugSchema.parse("---about---")).toBe("about");
  });
});

describe("derivePagePath — plan §5.1 worked examples", () => {
  it("home is always '/'", () => {
    expect(derivePagePath({ isHome: true, slug: "", hasParent: false, parentPath: null })).toEqual({
      ok: true,
      path: "/",
    });
  });

  it("a root page is '/' + slug", () => {
    expect(
      derivePagePath({ isHome: false, slug: "about", hasParent: false, parentPath: null }),
    ).toEqual({ ok: true, path: "/about" });
  });

  it("a child page is the parent's same-locale path + '/' + slug", () => {
    expect(
      derivePagePath({
        isHome: false,
        slug: "pip-calculator",
        hasParent: true,
        parentPath: "/tools",
      }),
    ).toEqual({ ok: true, path: "/tools/pip-calculator" });
  });

  it("refuses when the parent has no translation in this locale", () => {
    expect(
      derivePagePath({
        isHome: false,
        slug: "calculadora-de-pips",
        hasParent: true,
        parentPath: null,
      }),
    ).toEqual({ ok: false, reason: "PARENT_NOT_TRANSLATED" });
  });
});

describe("publicPagePath", () => {
  it("home in the default locale is '/'", () => {
    expect(publicPagePath("en", "en", "/")).toBe("/");
  });

  it("home in a non-default locale has no trailing slash", () => {
    expect(publicPagePath("es", "en", "/")).toBe("/es");
  });

  it("a non-home page in the default locale carries no prefix", () => {
    expect(publicPagePath("en", "en", "/about")).toBe("/about");
  });

  it("a non-home page in a non-default locale is prefixed", () => {
    expect(publicPagePath("es", "en", "/acerca")).toBe("/es/acerca");
  });

  it("a nested page carries the full derived path", () => {
    expect(publicPagePath("es", "en", "/herramientas/calculadora-de-pips")).toBe(
      "/es/herramientas/calculadora-de-pips",
    );
  });
});

describe("reserved paths", () => {
  it("firstPathSegment reads the first '/'-delimited segment", () => {
    expect(firstPathSegment("/tools/pip-calculator")).toBe("tools");
    expect(firstPathSegment("/about")).toBe("about");
    expect(firstPathSegment("/")).toBe("");
  });

  it("flags a RESERVED_PATHS segment", () => {
    expect(isReservedFirstSegment("news")).toBe(true);
    expect(isReservedFirstSegment("admin")).toBe(true);
  });

  it("flags a RESERVED_PREFIXES segment", () => {
    expect(isReservedFirstSegment("courses")).toBe(true);
  });

  it("does not flag an ordinary CMS page segment", () => {
    // `tools` is still a CMS page by design (see the RESERVED_PREFIXES note
    // in paths.ts). `about` was one when this test was written and is not
    // any more: ADR-047 made it five coded route files, so reserving it is
    // what stops a CMS page from shadowing them.
    expect(isReservedFirstSegment("tools")).toBe(false);
  });

  it("flags coded route sections that used to be CMS pages", () => {
    expect(isReservedFirstSegment("about")).toBe(true); // ADR-047
    expect(isReservedFirstSegment("economic-calendar")).toBe(true); // ADR-050
  });

  it("does not flag the empty segment", () => {
    expect(isReservedFirstSegment("")).toBe(false);
  });

  it("CONTENT_ROUTES entries all start with '/'", () => {
    for (const route of Object.values(CONTENT_ROUTES)) expect(route.startsWith("/")).toBe(true);
  });

  it("RESERVED_PATHS and RESERVED_PREFIXES share no entries", () => {
    const overlap = RESERVED_PATHS.filter((p) =>
      (RESERVED_PREFIXES as readonly string[]).includes(p),
    );
    expect(overlap).toEqual([]);
  });
});
