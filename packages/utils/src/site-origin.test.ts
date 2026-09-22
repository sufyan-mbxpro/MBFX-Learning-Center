import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin.ts";

describe("siteOrigin", () => {
  it("prefers the public site URL", () => {
    expect(
      siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://mbx.example", BETTER_AUTH_URL: "http://x" }),
    ).toBe("https://mbx.example");
  });

  it("falls back to the auth URL, then localhost", () => {
    expect(siteOrigin({ BETTER_AUTH_URL: "https://auth.example" })).toBe("https://auth.example");
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });

  it("treats an EMPTY value as unset, and strips trailing slashes", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "", BETTER_AUTH_URL: "https://a.example//" })).toBe(
      "https://a.example",
    );
  });
});
