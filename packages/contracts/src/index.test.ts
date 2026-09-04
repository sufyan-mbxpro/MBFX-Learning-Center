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
