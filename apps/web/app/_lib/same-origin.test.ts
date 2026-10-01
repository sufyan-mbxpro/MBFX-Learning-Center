import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin.ts";

const SITE = ["https://mbfx.example"];
const h = (init: Record<string, string>) => new Headers(init);

describe("isSameOriginRequest (ADR-170 #3.3)", () => {
  it("trusts Sec-Fetch-Site when the browser sends it", () => {
    expect(isSameOriginRequest(h({ "sec-fetch-site": "same-origin" }), SITE)).toBe(true);
    expect(isSameOriginRequest(h({ "sec-fetch-site": "cross-site" }), SITE)).toBe(false);
    expect(isSameOriginRequest(h({ "sec-fetch-site": "same-site" }), SITE)).toBe(false);
    // A matching Origin does not rescue a cross-site fetch: the browser's
    // own verdict is the stronger one.
    expect(
      isSameOriginRequest(
        h({ "sec-fetch-site": "cross-site", origin: "https://mbfx.example" }),
        SITE,
      ),
    ).toBe(false);
  });

  it("falls back to Origin for an older browser", () => {
    expect(isSameOriginRequest(h({ origin: "https://mbfx.example" }), SITE)).toBe(true);
    expect(isSameOriginRequest(h({ origin: "https://mbfx.example/" }), SITE)).toBe(true);
    expect(isSameOriginRequest(h({ origin: "https://evil.example" }), SITE)).toBe(false);
    expect(isSameOriginRequest(h({ origin: "null" }), SITE)).toBe(false);
  });

  it("refuses a request that carries neither", () => {
    expect(isSameOriginRequest(h({}), SITE)).toBe(false);
  });
});
