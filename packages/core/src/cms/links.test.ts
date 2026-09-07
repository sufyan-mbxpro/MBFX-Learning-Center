// Pure cases only (URL/ROUTE/ANCHOR/NONE/entity — none of these touch the
// database, per links.ts's own guard). PAGE/MEDIA resolution is
// Testcontainers-covered in links.integration.test.ts (testing.md: don't
// mock Prisma).
import { describe, expect, it } from "vitest";
import { resolveLinks, resolveStatelessLinkTarget } from "./links.ts";

describe("resolveStatelessLinkTarget", () => {
  it("resolves URL as-is", () => {
    expect(resolveStatelessLinkTarget({ type: "URL", url: "https://example.com" })).toEqual({
      href: "https://example.com",
      state: "ok",
    });
  });

  it("resolves a valid ROUTE key", () => {
    expect(resolveStatelessLinkTarget({ type: "ROUTE", routeKey: "news" })).toEqual({
      href: "/news",
      state: "ok",
    });
  });

  it("resolves ANCHOR to a same-page hash", () => {
    expect(resolveStatelessLinkTarget({ type: "ANCHOR", anchor: "faq" })).toEqual({
      href: "#faq",
      state: "ok",
    });
  });

  it("resolves NONE to no href, state ok — a deliberate absence, not an error", () => {
    expect(resolveStatelessLinkTarget({ type: "NONE" })).toEqual({ href: null, state: "ok" });
  });

  it("returns null for PAGE/MEDIA/entity targets — they need a batched lookup", () => {
    expect(resolveStatelessLinkTarget({ type: "PAGE", pageId: "p1" })).toBeNull();
    expect(resolveStatelessLinkTarget({ type: "MEDIA", assetId: "m1" })).toBeNull();
    expect(resolveStatelessLinkTarget({ type: "ARTICLE", targetId: "a1" })).toBeNull();
  });
});

describe("resolveLinks — stateless targets issue no query", () => {
  it("resolves a mix of URL/ROUTE/ANCHOR/NONE with no database available", async () => {
    const results = await resolveLinks(
      [
        { type: "URL", url: "https://example.com" },
        { type: "ROUTE", routeKey: "glossary" },
        { type: "ANCHOR", anchor: "top" },
        { type: "NONE" },
      ],
      { locale: "en" },
    );
    expect(results).toEqual([
      { href: "https://example.com", state: "ok" },
      { href: "/glossary", state: "ok" },
      { href: "#top", state: "ok" },
      { href: null, state: "ok" },
    ]);
  });

  it("resolves entity targets to missing — no provider exists before Phase 4", async () => {
    const results = await resolveLinks([{ type: "COURSE", targetId: "c1" }], { locale: "en" });
    expect(results).toEqual([{ href: null, state: "missing" }]);
  });

  it("preserves input order across a mixed batch", async () => {
    const results = await resolveLinks(
      [
        { type: "ANCHOR", anchor: "b" },
        { type: "URL", url: "https://a.example" },
        { type: "ANCHOR", anchor: "a" },
      ],
      { locale: "en" },
    );
    expect(results.map((r) => r.href)).toEqual(["#b", "https://a.example", "#a"]);
  });
});
