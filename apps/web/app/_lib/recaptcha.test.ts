import { describe, expect, it } from "vitest";
import { reachedBySoftNavigation } from "./recaptcha.ts";

// Regression: reCAPTCHA never loaded on the public sign-in, sign-up and
// support pages when a visitor clicked through to them. The proxy names
// Google only on those pages (ADR-156 #9) and a soft navigation keeps the
// CSP of the page the document was loaded as, so the guarded form must know
// when that happened and reload once.
describe("reachedBySoftNavigation", () => {
  it("is true when the document was loaded as another page", () => {
    expect(reachedBySoftNavigation("https://example.com/", "https://example.com/sign-in")).toBe(
      true,
    );
    expect(
      reachedBySoftNavigation("https://example.com/news", "https://example.com/es/support"),
    ).toBe(true);
  });

  it("is false when the document was loaded as this page, whatever the query", () => {
    expect(
      reachedBySoftNavigation(
        "https://example.com/sign-in",
        "https://example.com/sign-in?redirect=%2Faccount",
      ),
    ).toBe(false);
  });

  it("is false when there is no navigation entry to compare", () => {
    expect(reachedBySoftNavigation(undefined, "https://example.com/sign-in")).toBe(false);
    expect(reachedBySoftNavigation("", "https://example.com/sign-in")).toBe(false);
  });
});
