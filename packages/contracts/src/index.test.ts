import { describe, expect, it } from "vitest";
import { isRouteKey, menuItemLinkSchema, ROUTE_PATHS, SETTINGS_SCHEMAS } from "./index.ts";

describe("@repo/contracts — barrel", () => {
  it("exports the settings schema registry", () => {
    expect(Object.keys(SETTINGS_SCHEMAS).length).toBeGreaterThan(0);
  });
});

describe("menuItemLinkSchema — exactly-one of url/routeKey (Module 08 contract test)", () => {
  it("accepts a routeKey-only link when the key is registered", () => {
    expect(menuItemLinkSchema.safeParse({ routeKey: "glossary", url: null }).success).toBe(true);
  });

  it("accepts a url-only link", () => {
    expect(
      menuItemLinkSchema.safeParse({ url: "https://example.com", routeKey: null }).success,
    ).toBe(true);
  });

  it("rejects both set", () => {
    expect(
      menuItemLinkSchema.safeParse({ url: "https://example.com", routeKey: "glossary" }).success,
    ).toBe(false);
  });

  it("rejects neither set", () => {
    expect(menuItemLinkSchema.safeParse({ url: null, routeKey: null }).success).toBe(false);
  });

  it("rejects a routeKey not present in the ROUTE_PATHS registry", () => {
    expect(menuItemLinkSchema.safeParse({ routeKey: "nope", url: null }).success).toBe(false);
  });
});

describe("ROUTE_PATHS registry", () => {
  it("every registered key maps to an absolute path", () => {
    for (const path of Object.values(ROUTE_PATHS)) expect(path.startsWith("/")).toBe(true);
  });

  it("isRouteKey narrows correctly", () => {
    expect(isRouteKey("glossary")).toBe(true);
    expect(isRouteKey("bogus")).toBe(false);
  });
});

describe("withdrawn routes (changes-33, ADR-109)", () => {
  // The registry is what a seeded menu row links THROUGH, so a key that
  // outlives its route is a header entry pointing at a 404. These five left
  // with the pages; the test is here so re-adding one is a deliberate act
  // rather than an autocomplete.
  it.each([
    "about",
    "about-why-us",
    "about-transparency",
    "about-security",
    "about-support",
    "markets",
  ])("%s is no longer a route key", (key) => {
    expect(isRouteKey(key)).toBe(false);
    expect(menuItemLinkSchema.safeParse({ routeKey: key, url: null }).success).toBe(false);
  });

  it("support and sitemap took their place and are linkable", () => {
    for (const key of ["support", "sitemap"]) {
      expect(menuItemLinkSchema.safeParse({ routeKey: key, url: null }).success).toBe(true);
    }
    expect(ROUTE_PATHS.support).toBe("/support");
    expect(ROUTE_PATHS.sitemap).toBe("/sitemap");
  });
});
