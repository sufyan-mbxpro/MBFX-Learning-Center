import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { siteUrl } from "./site-url.ts";

const original = process.env.BETTER_AUTH_URL;
const originalPublic = process.env.NEXT_PUBLIC_SITE_URL;

// changes-49: NEXT_PUBLIC_SITE_URL wins over BETTER_AUTH_URL, so each case
// starts without it and only the precedence case sets it.
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  if (original === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = original;
  if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalPublic;
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, the same precedence the emails use (changes-49)", () => {
    process.env.BETTER_AUTH_URL = "https://auth.mbxpro.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://mbxpro.com";
    expect(siteUrl()).toBe("https://mbxpro.com");
  });

  it("falls back to localhost when the variable is unset", () => {
    delete process.env.BETTER_AUTH_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("reads BETTER_AUTH_URL", () => {
    process.env.BETTER_AUTH_URL = "https://mbxpro.com";
    expect(siteUrl()).toBe("https://mbxpro.com");
  });

  // Every caller composes `${siteUrl()}${path}`, and `path` opens with a slash.
  it("strips trailing slashes so composition never doubles one", () => {
    process.env.BETTER_AUTH_URL = "https://mbxpro.com//";
    expect(`${siteUrl()}/news`).toBe("https://mbxpro.com/news");
  });

  it("is a valid URL, which is what metadataBase requires", () => {
    process.env.BETTER_AUTH_URL = "https://mbxpro.com/";
    expect(new URL(siteUrl()).origin).toBe("https://mbxpro.com");
  });
});
