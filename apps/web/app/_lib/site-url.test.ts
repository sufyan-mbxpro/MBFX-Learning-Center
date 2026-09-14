import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "./site-url.ts";

const original = process.env.BETTER_AUTH_URL;

afterEach(() => {
  if (original === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = original;
});

describe("siteUrl", () => {
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
