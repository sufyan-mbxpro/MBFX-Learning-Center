// ADR-156: the server half of reCAPTCHA v3 — when it is on, and what passes.
// The row reads and the save are exercised against a real database in
// `captcha.integration.test.ts`; this file holds the decisions.
import { describe, expect, it, vi } from "vitest";
import {
  authPath,
  captchaForcedOff,
  checkRecaptchaToken,
  recaptchaPasses,
  resolveCaptchaRuntime,
} from "./captcha.ts";

const ROW = {
  enabled: true,
  mode: "SCORE" as const,
  siteKey: "site",
  secretKeyCipher: "sealed",
  minScore: 0.5,
};
const open = (sealed: string) => (sealed === "sealed" ? "secret" : "");

describe("resolveCaptchaRuntime — on only when switched on, complete and readable", () => {
  it("is on for a complete, switched-on row", () => {
    expect(resolveCaptchaRuntime(ROW, open)).toEqual({
      siteKey: "site",
      mode: "SCORE",
      secretKey: "secret",
      minScore: 0.5,
    });
  });

  it.each([
    ["no row", null],
    ["switched off", { ...ROW, enabled: false }],
    ["no site key", { ...ROW, siteKey: null }],
    ["no secret saved", { ...ROW, secretKeyCipher: null }],
  ])("is off with %s", (_why, row) => {
    expect(resolveCaptchaRuntime(row, open)).toBeNull();
  });

  // The failure direction that matters: refusing every sign-in would lock out
  // the admin who has to sign in to fix it.
  it("is OFF, not refuse-all, when the secret cannot be opened", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      resolveCaptchaRuntime(ROW, () => {
        throw new Error("CAPTCHA_SECRET_KEY is not set");
      }),
    ).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("falls back to 0.5 for a stored score outside (0, 1]", () => {
    expect(resolveCaptchaRuntime({ ...ROW, minScore: 0 }, open)?.minScore).toBe(0.5);
    expect(resolveCaptchaRuntime({ ...ROW, minScore: 7 }, open)?.minScore).toBe(0.5);
  });
});

describe("captchaForcedOff — the break-glass switch", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["0", false],
    ["false", false],
    ["1", true],
    ["true", true],
    ["yes", true],
  ])("CAPTCHA_DISABLED=%s → %s", (value, expected) => {
    expect(captchaForcedOff(value === undefined ? {} : { CAPTCHA_DISABLED: value })).toBe(expected);
  });
});

describe("recaptchaPasses", () => {
  const expected = { action: "support", minScore: 0.5 } as const;

  it("passes a genuine token for this action at or above the bar", () => {
    expect(recaptchaPasses({ success: true, score: 0.9, action: "support" }, expected)).toBe(true);
    expect(recaptchaPasses({ success: true, score: 0.5, action: "support" }, expected)).toBe(true);
  });

  it("fails when Google says the token is not genuine", () => {
    expect(recaptchaPasses({ success: false, score: 0.9, action: "support" }, expected)).toBe(
      false,
    );
  });

  it("fails below the bar, and with no score at all (a v2 token is not a v3 answer)", () => {
    expect(recaptchaPasses({ success: true, score: 0.3, action: "support" }, expected)).toBe(false);
    expect(recaptchaPasses({ success: true, action: "support" }, expected)).toBe(false);
  });

  it("fails a token minted for another action — no replaying a sign-in token here", () => {
    expect(recaptchaPasses({ success: true, score: 0.9, action: "auth" }, expected)).toBe(false);
  });
});

// ADR-158: a v2 checkbox answer has no score and no action, so Google's own
// verdict is the whole check. A v3-shaped bar applied to it would refuse
// every person who ticked the box.
describe("recaptchaPasses — CHECKBOX mode", () => {
  const expected = { mode: "CHECKBOX", action: "auth", minScore: 0.9 } as const;

  it("passes on Google's success with no score and no action", () => {
    expect(recaptchaPasses({ success: true }, expected)).toBe(true);
  });

  it("still fails when Google says no", () => {
    expect(recaptchaPasses({ success: false }, expected)).toBe(false);
    expect(recaptchaPasses({}, expected)).toBe(false);
  });

  it("keeps the v3 rules when the mode is SCORE", () => {
    expect(recaptchaPasses({ success: true }, { ...expected, mode: "SCORE" })).toBe(false);
  });
});

describe("checkRecaptchaToken", () => {
  const base = { secretKey: "secret", action: "support", minScore: 0.5 } as const;

  it("a missing token is false without a request", async () => {
    const fetchImpl = vi.fn();
    await expect(checkRecaptchaToken({ ...base, token: "", fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the secret, the token and the IP to siteverify, and reads the verdict", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ success: true, score: 0.8, action: "support" }),
    );
    await expect(
      checkRecaptchaToken({ ...base, token: "t", remoteIp: "1.2.3.4", fetchImpl }),
    ).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.google.com/recaptcha/api/siteverify");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("t");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("fails closed when Google errors or cannot be reached", async () => {
    await expect(
      checkRecaptchaToken({
        ...base,
        token: "t",
        fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })),
      }),
    ).resolves.toBe(false);
    await expect(
      checkRecaptchaToken({
        ...base,
        token: "t",
        fetchImpl: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    ).resolves.toBe(false);
  });
});

describe("authPath — which endpoint the guard is looking at", () => {
  it.each([
    ["http://x/api/auth/sign-in/email", "/sign-in/email"],
    ["http://x/api/auth/sign-up/email/", "/sign-up/email"],
    ["http://x/api/auth/sign-in/email?x=1", "/sign-in/email"],
    ["http://x/api/auth/get-session", "/get-session"],
  ])("%s → %s", (url, expected) => {
    expect(authPath(url, "/api/auth")).toBe(expected);
  });
});
