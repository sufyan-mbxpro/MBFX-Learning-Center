// The profile page's security helpers (ADR-123): which Better Auth response
// means what, and that every call goes to Better Auth's own handler.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeEmail,
  changePassword,
  confirmTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  secretFromTotpUri,
} from "./account-security.ts";

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockFetch(result: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => result);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("changePassword", () => {
  it("posts to Better Auth and revokes the other sessions", async () => {
    const fetchMock = mockFetch(response(200, { token: "t", user: { id: "u" } }));
    await expect(changePassword("old-pass", "new-password")).resolves.toEqual({ status: "ok" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/change-password");
    expect(JSON.parse(String(init?.body))).toEqual({
      currentPassword: "old-pass",
      newPassword: "new-password",
      revokeOtherSessions: true,
    });
  });

  it("names a wrong current password", async () => {
    mockFetch(response(400, { code: "INVALID_PASSWORD" }));
    await expect(changePassword("x", "new-password")).resolves.toEqual({
      status: "wrongPassword",
    });
  });

  it("names the rate limit, and falls back to a generic failure", async () => {
    mockFetch(response(429, {}));
    await expect(changePassword("x", "y")).resolves.toEqual({ status: "tooMany" });
    mockFetch(response(500, null));
    await expect(changePassword("x", "y")).resolves.toEqual({ status: "failed" });
  });

  it("a network failure is a failure, not a throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    await expect(changePassword("x", "y")).resolves.toEqual({ status: "failed" });
  });
});

describe("enableTwoFactor", () => {
  const uri = "otpauth://totp/MBX:sam%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=MBX&digits=6";

  it("returns the URI, the secret parsed out of it and the backup codes", async () => {
    const fetchMock = mockFetch(response(200, { totpURI: uri, backupCodes: ["a", "b"] }));
    await expect(enableTwoFactor("pw", "MBX")).resolves.toEqual({
      status: "ok",
      value: { totpURI: uri, secret: "JBSWY3DPEHPK3PXP", backupCodes: ["a", "b"] },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/two-factor/enable");
    expect(JSON.parse(String(init?.body))).toEqual({ password: "pw", issuer: "MBX" });
  });

  it("names a wrong password", async () => {
    mockFetch(response(400, { code: "INVALID_PASSWORD" }));
    await expect(enableTwoFactor("bad", "MBX")).resolves.toEqual({ status: "wrongPassword" });
  });

  it("treats a success with no URI as a failure rather than a blank QR code", async () => {
    mockFetch(response(200, {}));
    await expect(enableTwoFactor("pw", "MBX")).resolves.toEqual({ status: "failed" });
  });
});

describe("confirmTwoFactor / disableTwoFactor", () => {
  it("confirms with the code on the verify endpoint", async () => {
    const fetchMock = mockFetch(response(200, { token: "t" }));
    await expect(confirmTwoFactor("123456")).resolves.toEqual({ status: "ok" });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/auth/two-factor/verify-totp");
  });

  it("names an invalid code", async () => {
    mockFetch(response(401, { code: "INVALID_CODE" }));
    await expect(confirmTwoFactor("000000")).resolves.toEqual({ status: "invalidCode" });
  });

  it("disables with the password on the disable endpoint", async () => {
    const fetchMock = mockFetch(response(200, { status: true }));
    await expect(disableTwoFactor("pw")).resolves.toEqual({ status: "ok" });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/auth/two-factor/disable");
  });
});

describe("secretFromTotpUri", () => {
  it("reads the secret parameter, and is empty for anything unparseable", () => {
    expect(secretFromTotpUri("otpauth://totp/x?secret=ABC")).toBe("ABC");
    expect(secretFromTotpUri("otpauth://totp/x")).toBe("");
    expect(secretFromTotpUri("not a uri")).toBe("");
  });
});

describe("changeEmail (ADR-155)", () => {
  it("posts the new address and the callback to Better Auth", async () => {
    const fetchMock = mockFetch(response(200, { status: true }));
    await expect(changeEmail("new@example.com", "/en/account?emailChanged=1")).resolves.toEqual({
      status: "ok",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/change-email");
    expect(JSON.parse(String(init?.body))).toEqual({
      newEmail: "new@example.com",
      callbackURL: "/en/account?emailChanged=1",
    });
  });

  it("asks for a fresh sign-in when the session is too old", async () => {
    mockFetch(response(403, { code: "SESSION_NOT_FRESH" }));
    await expect(changeEmail("a@b.co", "/")).resolves.toEqual({ status: "signInAgain" });
  });

  it("names the per-account limit", async () => {
    mockFetch(response(429, {}));
    await expect(changeEmail("a@b.co", "/")).resolves.toEqual({ status: "tooMany" });
  });
});
