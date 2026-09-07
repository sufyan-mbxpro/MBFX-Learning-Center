import { describe, expect, it } from "vitest";
import { humanizeIfKey, humanizeKey } from "./humanize.ts";

describe("humanizeKey", () => {
  it("expands the two shapes the owner named (changes-08 #2)", () => {
    expect(humanizeKey("super_admin")).toBe("Super Admin");
    expect(humanizeKey("legal.copyrightNotice")).toBe("Legal Copyright Notice");
  });

  it("splits every structural separator", () => {
    expect(humanizeKey("latest-articles")).toBe("Latest Articles");
    expect(humanizeKey("admin/settings/social")).toBe("Admin Settings Social");
    expect(humanizeKey("content_editor")).toBe("Content Editor");
  });

  it("splits camelCase and PascalCase boundaries", () => {
    expect(humanizeKey("siteName")).toBe("Site Name");
    expect(humanizeKey("ArticleCategory")).toBe("Article Category");
    expect(humanizeKey("h2Heading")).toBe("H2 Heading");
  });

  it("normalises SCREAMING_SNAKE enum members", () => {
    expect(humanizeKey("PENDING_VERIFICATION")).toBe("Pending Verification");
    expect(humanizeKey("TRADE_IDEA")).toBe("Trade Idea");
  });

  it("keeps known acronyms upper-case", () => {
    expect(humanizeKey("seo.robotsIndex")).toBe("SEO Robots Index");
    expect(humanizeKey("seo.defaultOgImage")).toBe("SEO Default OG Image");
    expect(humanizeKey("cms.dataBudget")).toBe("CMS Data Budget");
  });

  it("never leaks an underscore, dot or hyphen into the result", () => {
    for (const key of ["a_b", "a.b", "a-b", "a__b", "a..b", "a b"]) {
      expect(humanizeKey(key)).not.toMatch(new RegExp("[._-]"));
    }
  });

  it("returns an empty string for empty input", () => {
    expect(humanizeKey("")).toBe("");
  });
});

describe("humanizeIfKey", () => {
  it("leaves prose alone", () => {
    expect(humanizeIfKey("Head of Content")).toBe("Head of Content");
    expect(humanizeIfKey("News & Analysis")).toBe("News & Analysis");
  });

  it("still humanizes anything key-shaped", () => {
    expect(humanizeIfKey("super_admin")).toBe("Super Admin");
    expect(humanizeIfKey("PUBLISHED")).toBe("Published");
    expect(humanizeIfKey("siteName")).toBe("Site Name");
  });

  it("returns an empty string for empty input", () => {
    expect(humanizeIfKey("")).toBe("");
  });
});
