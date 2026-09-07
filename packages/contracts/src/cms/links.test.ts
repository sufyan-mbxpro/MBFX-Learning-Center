import { describe, expect, it } from "vitest";
import { linkTargetSchema } from "./links.ts";

describe("linkTargetSchema — ADR-031 §1", () => {
  it("accepts an absolute http(s) URL", () => {
    expect(linkTargetSchema.parse({ type: "URL", url: "https://example.com" })).toMatchObject({
      type: "URL",
    });
  });

  it("accepts mailto: and tel: URLs", () => {
    expect(
      linkTargetSchema.safeParse({ type: "URL", url: "mailto:hello@example.com" }).success,
    ).toBe(true);
    expect(linkTargetSchema.safeParse({ type: "URL", url: "tel:+15551234567" }).success).toBe(true);
  });

  it.each(["/about", "about", "/about/team", "../up", ""])(
    "refuses a relative internal path %j typed as URL — link to the page instead",
    (url) => {
      const result = linkTargetSchema.safeParse({ type: "URL", url });
      expect(result.success).toBe(false);
    },
  );

  it("accepts a ROUTE target for a real route key", () => {
    expect(linkTargetSchema.safeParse({ type: "ROUTE", routeKey: "news" }).success).toBe(true);
  });

  it("rejects a ROUTE target for an unknown route key", () => {
    expect(linkTargetSchema.safeParse({ type: "ROUTE", routeKey: "does-not-exist" }).success).toBe(
      false,
    );
  });

  it("accepts a PAGE target with an optional anchor", () => {
    expect(linkTargetSchema.safeParse({ type: "PAGE", pageId: "p1", anchor: "faq" }).success).toBe(
      true,
    );
  });

  it.each(["ARTICLE", "ARTICLE_CATEGORY", "ARTICLE_TAG", "COURSE", "GLOSSARY_TERM"])(
    "accepts every entity target type (%s)",
    (type) => {
      expect(linkTargetSchema.safeParse({ type, targetId: "t1" }).success).toBe(true);
    },
  );

  it("accepts MEDIA, ANCHOR and NONE", () => {
    expect(linkTargetSchema.safeParse({ type: "MEDIA", assetId: "m1" }).success).toBe(true);
    expect(linkTargetSchema.safeParse({ type: "ANCHOR", anchor: "top" }).success).toBe(true);
    expect(linkTargetSchema.safeParse({ type: "NONE" }).success).toBe(true);
  });

  it("rejects an unknown discriminant", () => {
    expect(linkTargetSchema.safeParse({ type: "FTP", url: "ftp://x" }).success).toBe(false);
  });
});
