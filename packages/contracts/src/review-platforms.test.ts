import { describe, expect, it } from "vitest";
import {
  REVIEW_PLATFORM_KEYS,
  normalizeReviewIdentifier,
  resolveReviewUrl,
  reviewPlatformsSaveSchema,
  type ReviewPlatformKey,
} from "./review-platforms.ts";
import { validateFields } from "./field-issues.ts";

type Row = {
  platform: ReviewPlatformKey;
  isEnabled: boolean;
  identifier: string;
  customUrl: string;
};

const baseRows = (): Row[] =>
  REVIEW_PLATFORM_KEYS.map((platform) => ({
    platform,
    isEnabled: false,
    identifier: "",
    customUrl: "",
  }));

const withRow = (platform: ReviewPlatformKey, patch: Partial<Row>) => ({
  platforms: baseRows().map((r) => (r.platform === platform ? { ...r, ...patch } : r)),
});

describe("normalizeReviewIdentifier", () => {
  it("accepts a Trustpilot domain and strips what an admin pastes around it", () => {
    expect(normalizeReviewIdentifier("trustpilot", "mbfx.co")).toBe("mbfx.co");
    expect(normalizeReviewIdentifier("trustpilot", " https://www.MBFX.co/ ")).toBe("mbfx.co");
    expect(normalizeReviewIdentifier("trustpilot", "sub.example.co.uk")).toBe("sub.example.co.uk");
  });

  it("refuses a Trustpilot value that is not a bare domain", () => {
    for (const bad of ["mbfx", "mbfx.co/review", "-bad.com", "a b.com", "mbfx.co?x=1"]) {
      expect(normalizeReviewIdentifier("trustpilot", bad)).toBeNull();
    }
  });

  it("accepts a Google Place ID and refuses anything with URL syntax", () => {
    expect(normalizeReviewIdentifier("google", "ChIJN1t_tDeuEmsRUsoyG83frY4")).toBe(
      "ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
    for (const bad of ["short", "ChIJ/../../x", "ChIJ?placeid=evil", "ChIJ N1t_tDeuEmsRU"]) {
      expect(normalizeReviewIdentifier("google", bad)).toBeNull();
    }
  });

  it("accepts a Facebook Page name, with or without @, and a numeric id", () => {
    expect(normalizeReviewIdentifier("facebook", "@mbfx.official")).toBe("mbfx.official");
    expect(normalizeReviewIdentifier("facebook", "100064123456789")).toBe("100064123456789");
    for (const bad of ["abc", "mbfx/reviews", "mbfx?x", "mb fx official"]) {
      expect(normalizeReviewIdentifier("facebook", bad)).toBeNull();
    }
  });

  it("treats empty input as no identifier", () => {
    expect(normalizeReviewIdentifier("google", "")).toBeNull();
    expect(normalizeReviewIdentifier("google", null)).toBeNull();
  });
});

describe("resolveReviewUrl", () => {
  it("builds each platform's write-a-review address from its identifier", () => {
    expect(
      resolveReviewUrl({ platform: "trustpilot", identifier: "mbfx.co", customUrl: null }),
    ).toBe("https://www.trustpilot.com/evaluate/mbfx.co");
    expect(
      resolveReviewUrl({
        platform: "google",
        identifier: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        customUrl: null,
      }),
    ).toBe("https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
    expect(
      resolveReviewUrl({ platform: "facebook", identifier: "mbfxofficial", customUrl: "" }),
    ).toBe("https://www.facebook.com/mbfxofficial/reviews");
  });

  it("prefers the custom link over the built one", () => {
    expect(
      resolveReviewUrl({
        platform: "google",
        identifier: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        customUrl: "https://g.page/r/abc/review",
      }),
    ).toBe("https://g.page/r/abc/review");
  });

  it("never returns a non-https custom link, even one written outside the admin", () => {
    for (const customUrl of [
      "javascript:alert(1)",
      "http://example.com",
      "//evil.example",
      "data:text/html,x",
    ]) {
      expect(
        resolveReviewUrl({ platform: "trustpilot", identifier: "mbfx.co", customUrl }),
      ).toBeNull();
    }
  });

  it("returns null for an unknown platform or nothing to link to", () => {
    expect(
      resolveReviewUrl({ platform: "yelp", identifier: "x", customUrl: "https://x.com" }),
    ).toBeNull();
    expect(resolveReviewUrl({ platform: "google", identifier: null, customUrl: null })).toBeNull();
    expect(
      resolveReviewUrl({ platform: "google", identifier: "bad id", customUrl: null }),
    ).toBeNull();
  });
});

describe("reviewPlatformsSaveSchema", () => {
  it("accepts every platform off and empty", () => {
    expect(reviewPlatformsSaveSchema.safeParse({ platforms: baseRows() }).success).toBe(true);
  });

  it("accepts an enabled platform with an identifier or a custom link", () => {
    expect(
      reviewPlatformsSaveSchema.safeParse(
        withRow("google", { isEnabled: true, identifier: "ChIJN1t_tDeuEmsRUsoyG83frY4" }),
      ).success,
    ).toBe(true);
    expect(
      reviewPlatformsSaveSchema.safeParse(
        withRow("facebook", { isEnabled: true, customUrl: "https://www.facebook.com/x/reviews" }),
      ).success,
    ).toBe(true);
  });

  it("refuses an enabled platform with nothing to link to, on the identifier field", () => {
    const issues = validateFields(
      reviewPlatformsSaveSchema,
      withRow("google", { isEnabled: true }),
    );
    expect(issues["platforms.1.identifier"]).toEqual({ code: "required" });
  });

  it("names a malformed identifier as a format problem", () => {
    const issues = validateFields(
      reviewPlatformsSaveSchema,
      withRow("trustpilot", { identifier: "not a domain" }),
    );
    expect(issues["platforms.0.identifier"]).toEqual({ code: "invalidFormat" });
  });

  it("refuses a custom link that is not https", () => {
    for (const customUrl of ["http://x.com", "javascript:alert(1)", "//evil.example"]) {
      const issues = validateFields(reviewPlatformsSaveSchema, withRow("facebook", { customUrl }));
      expect(issues["platforms.2.customUrl"]).toBeDefined();
    }
  });

  it("requires every platform exactly once", () => {
    const rows = baseRows();
    expect(reviewPlatformsSaveSchema.safeParse({ platforms: rows.slice(0, 2) }).success).toBe(
      false,
    );
    const dup = [rows[0], rows[0], rows[2]];
    expect(reviewPlatformsSaveSchema.safeParse({ platforms: dup }).success).toBe(false);
    const unknown = [...rows.slice(0, 2), { ...rows[2], platform: "yelp" }];
    expect(reviewPlatformsSaveSchema.safeParse({ platforms: unknown }).success).toBe(false);
  });
});
