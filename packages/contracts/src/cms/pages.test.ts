import { describe, expect, it } from "vitest";
import { EMPTY_LAYOUT } from "./layout.ts";
import {
  createPageSchema,
  createRedirectSchema,
  listPagesQuerySchema,
  saveDraftSchema,
  savePageTranslationSchema,
} from "./pages.ts";

describe("createPageSchema", () => {
  it("accepts a minimal STATIC page request", () => {
    expect(createPageSchema.safeParse({ title: "About", slug: "about" }).success).toBe(true);
  });

  it("requires a non-empty title", () => {
    expect(createPageSchema.safeParse({ title: "", slug: "about" }).success).toBe(false);
  });
});

describe("savePageTranslationSchema", () => {
  it("accepts an empty slug (the home page — the service enforces the rest)", () => {
    expect(
      savePageTranslationSchema.safeParse({ locale: "en", title: "Home", slug: "" }).success,
    ).toBe(true);
  });

  it("normalises the slug through pageSlugSchema", () => {
    const parsed = savePageTranslationSchema.parse({
      locale: "en",
      title: "Pip Calculator",
      slug: "  Pip Calculator  ",
    });
    expect(parsed.slug).toBe("pip-calculator");
  });
});

describe("saveDraftSchema", () => {
  it("accepts the empty layout with a non-negative baseRevision", () => {
    expect(saveDraftSchema.safeParse({ layout: EMPTY_LAYOUT, baseRevision: 0 }).success).toBe(true);
  });

  it("rejects a negative baseRevision", () => {
    expect(saveDraftSchema.safeParse({ layout: EMPTY_LAYOUT, baseRevision: -1 }).success).toBe(
      false,
    );
  });
});

describe("listPagesQuerySchema", () => {
  it("coerces a string page number from the URL", () => {
    const parsed = listPagesQuerySchema.parse({ page: "2" });
    expect(parsed.page).toBe(2);
  });

  it("accepts an empty query", () => {
    expect(listPagesQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe("createRedirectSchema", () => {
  it("accepts an internal-to-internal redirect and defaults statusCode", () => {
    const parsed = createRedirectSchema.parse({ fromPath: "/old", toPath: "/new" });
    expect(parsed.statusCode).toBe(301);
  });

  it("accepts an internal-to-external redirect", () => {
    expect(
      createRedirectSchema.safeParse({ fromPath: "/old", toPath: "https://example.com" }).success,
    ).toBe(true);
  });

  it("rejects a relative fromPath", () => {
    expect(createRedirectSchema.safeParse({ fromPath: "old", toPath: "/new" }).success).toBe(false);
  });
});
