// Unit tests for the shared credential helpers (ADR-052). These are the
// bits of the two sign-in screens that are pure enough to test without a
// browser: which Better Auth response shape means what, and the two
// redirect guards.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAdminPath,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  resolveRedirect,
  signInWithPassword,
  signOut,
  signOutSilently,
  signUpWithPassword,
  verifyTwoFactorSignIn,
} from "./credentials.ts";

/** Stands in for a `fetch` Response — only the two fields these helpers read. */
function jsonResponse(ok: boolean, body: unknown) {
  return { ok, json: async () => body } as Response;
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInWithPassword — the userType the surface check reads", () => {
  it("surfaces STAFF from the sign-in response body", async () => {
    mockFetch(jsonResponse(true, { user: { userType: "STAFF" } }));
    await expect(signInWithPassword("a@b.c", "pw")).resolves.toEqual({
      status: "ok",
      userType: "STAFF",
    });
  });

  it("surfaces LEARNER — the shape a real dev-server sign-up + sign-in actually returns", async () => {
    mockFetch(jsonResponse(true, { user: { userType: "LEARNER" } }));
    await expect(signInWithPassword("a@b.c", "pw")).resolves.toEqual({
      status: "ok",
      userType: "LEARNER",
    });
  });

  it("reports a MISSING userType as null rather than guessing — the callers fall through to the server-side boundary", async () => {
    mockFetch(jsonResponse(true, { user: {} }));
    await expect(signInWithPassword("a@b.c", "pw")).resolves.toEqual({
      status: "ok",
      userType: null,
    });
  });

  it("an unparseable body is still a successful sign-in with an unknown type, not a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    await expect(signInWithPassword("a@b.c", "pw")).resolves.toEqual({
      status: "ok",
      userType: null,
    });
  });

  it("a non-2xx credential POST is a failure", async () => {
    mockFetch(jsonResponse(false, { code: "INVALID_EMAIL_OR_PASSWORD" }));
    await expect(signInWithPassword("a@b.c", "wrong")).resolves.toEqual({ status: "failed" });
  });

  it("posts to Better Auth's own endpoint — where rate limiting and the lockout hooks live (ADR-001 #4)", async () => {
    const fetchMock = mockFetch(jsonResponse(true, { user: { userType: "LEARNER" } }));
    await signInWithPassword("a@b.c", "pw");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/email", expect.anything());
  });
});

describe("signUpWithPassword", () => {
  it("a 200 is a created account", async () => {
    mockFetch(jsonResponse(true, { user: { id: "u1" } }));
    await expect(
      signUpWithPassword({ name: "A", email: "a@b.c", password: "pw" }),
    ).resolves.toEqual({ status: "ok" });
  });

  // REGRESSION (testing.md #2). Measured against the running handler, not
  // read off a constant: Better Auth answers a duplicate email with
  // `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, while its own exported error
  // code is `USER_ALREADY_EXISTS`. An equality check on either one alone
  // degraded "that email is taken" into the generic failure message.
  it.each([
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "what the live endpoint returns"],
    ["USER_ALREADY_EXISTS", "the library's own exported code"],
  ])("recognizes %s (%s) as a taken email", async (code) => {
    mockFetch(jsonResponse(false, { code }));
    await expect(
      signUpWithPassword({ name: "A", email: "a@b.c", password: "pw" }),
    ).resolves.toEqual({ status: "taken" });
  });

  it("any other error code is the generic failure — the prefix match must not swallow unrelated errors", async () => {
    mockFetch(jsonResponse(false, { code: "PASSWORD_TOO_SHORT" }));
    await expect(
      signUpWithPassword({ name: "A", email: "a@b.c", password: "pw" }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("an error body with no code at all is the generic failure", async () => {
    mockFetch(jsonResponse(false, {}));
    await expect(
      signUpWithPassword({ name: "A", email: "a@b.c", password: "pw" }),
    ).resolves.toEqual({ status: "failed" });
  });
});

describe("resolveRedirect — the open-redirect guard", () => {
  function withSearch(search: string) {
    vi.stubGlobal("window", { location: { search } });
  }

  it("returns the fallback when there is no ?redirect= at all", () => {
    withSearch("");
    expect(resolveRedirect("/", () => true)).toBe("/");
  });

  it("refuses an absolute URL to another origin", () => {
    withSearch("?redirect=https://evil.example/steal");
    expect(resolveRedirect("/", () => true)).toBe("/");
  });

  it("refuses a protocol-relative //host, which a naive startsWith('/') check would accept", () => {
    withSearch("?redirect=//evil.example/steal");
    expect(resolveRedirect("/", () => true)).toBe("/");
  });

  it("accepts a same-origin path the surface allows", () => {
    withSearch("?redirect=%2Fadmin%2Fusers");
    expect(resolveRedirect("/admin", isAdminPath)).toBe("/admin/users");
  });

  it("the PUBLIC form never sends anyone into /admin, whatever ?redirect= says (ADR-052 §2)", () => {
    withSearch("?redirect=%2Fadmin%2Fusers");
    expect(resolveRedirect("/", (path) => !isAdminPath(path))).toBe("/");
  });

  it("the ADMIN form only ever goes into the portal", () => {
    withSearch("?redirect=%2Fnews");
    expect(resolveRedirect("/admin", isAdminPath)).toBe("/admin");
  });
});

describe("isAdminPath", () => {
  it.each(["/admin", "/admin/", "/admin/users", "/admin/sign-in"])(
    "%s is an admin path",
    (path) => {
      expect(isAdminPath(path)).toBe(true);
    },
  );

  // The prefix trap: a public path that merely STARTS with the five
  // characters "/admin" is not the portal, and blocking it would be a bug
  // in the public form's redirect guard rather than a safety win.
  it.each(["/administrator", "/admins", "/adminy/x", "/news"])(
    "%s is NOT an admin path",
    (path) => {
      expect(isAdminPath(path)).toBe(false);
    },
  );
});

describe("signOut — the one sign-out request", () => {
  // Regression (changes-20 admin visual pass): every call site POSTed with no
  // body, Better Auth answered 415 and the session stayed valid, so Sign out,
  // the profile menu and the ADR-041 idle timeout all left a live session.
  it("sends a JSON body, which is what Better Auth actually honours", async () => {
    const fetchMock = mockFetch(jsonResponse(true, { success: true }));
    await expect(signOut()).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/sign-out");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(init.body).toBe("{}");
  });

  it("reports a refused sign-out instead of pretending it landed", async () => {
    mockFetch(jsonResponse(false, {}));
    await expect(signOut()).resolves.toBe(false);
  });

  it("signOutSilently goes through the same request and swallows a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    await expect(signOutSilently()).resolves.toBeUndefined();
  });

  it("no other file hand-writes the sign-out request", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = resolve(dir, e.name);
        if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
        return /\.(tsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
      });
    const offenders = walk(resolve(process.cwd(), "app"))
      .filter((p) => !p.endsWith("credentials.ts"))
      .filter((p) => readFileSync(p, "utf8").includes('"/api/auth/sign-out"'));
    expect(offenders).toEqual([]);
  });
});

// ─── Password recovery and verification (changes-21 F6, ADR-079) ───

describe("requestPasswordReset — the anti-enumeration half (ADR-079 #4)", () => {
  it("posts to Better Auth's own endpoint, where the per-IP limiter lives", async () => {
    const fetchMock = mockFetch(jsonResponse(true, { status: true }));
    await requestPasswordReset("a@b.c");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/request-password-reset");
    expect(JSON.parse(String(init.body))).toEqual({ email: "a@b.c" });
  });

  it("sends NO redirectTo — the link is routed by who the user is, not by the screen (ADR-079 #2)", () => {
    const fetchMock = mockFetch(jsonResponse(true, { status: true }));
    return requestPasswordReset("a@b.c").then(() => {
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body))).not.toHaveProperty("redirectTo");
    });
  });

  it("resolves the same way for a refused request — the caller must not be able to tell", async () => {
    mockFetch(jsonResponse(false, { code: "ANYTHING" }));
    await expect(requestPasswordReset("a@b.c")).resolves.toBeUndefined();
  });

  it("resolves the same way when the network fails outright", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    // A visible error on a real address and silence on an unknown one is the
    // same leak in a different coat.
    await expect(requestPasswordReset("a@b.c")).resolves.toBeUndefined();
  });
});

describe("resetPassword — three outcomes, because they need three screens", () => {
  it("a 200 is done", async () => {
    mockFetch(jsonResponse(true, { status: true }));
    await expect(resetPassword("tok", "ValidPassw0rd!")).resolves.toEqual({ status: "ok" });
  });

  // The codes are measured against the running handler, not read off a
  // constant — the same discipline signUpWithPassword's prefix match records.
  // Verified live: POST /api/auth/reset-password with a bad token answers
  // 400 {"message":"Invalid token","code":"INVALID_TOKEN"}.
  it("INVALID_TOKEN is its own outcome, so the screen can offer a fresh link", async () => {
    mockFetch(jsonResponse(false, { code: "INVALID_TOKEN" }));
    await expect(resetPassword("stale", "ValidPassw0rd!")).resolves.toEqual({
      status: "invalidToken",
    });
  });

  it("PASSWORD_TOO_SHORT points at the field rather than the link", async () => {
    mockFetch(jsonResponse(false, { code: "PASSWORD_TOO_SHORT" }));
    await expect(resetPassword("tok", "short")).resolves.toEqual({ status: "tooShort" });
  });

  it("anything else is the generic failure", async () => {
    mockFetch(jsonResponse(false, { code: "SOMETHING_NEW" }));
    await expect(resetPassword("tok", "ValidPassw0rd!")).resolves.toEqual({ status: "failed" });
  });

  it("an unparseable error body is still the generic failure, not a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    await expect(resetPassword("tok", "ValidPassw0rd!")).resolves.toEqual({ status: "failed" });
  });

  it("posts the token in the BODY, never the query — a URL is logged, a body is not", async () => {
    const fetchMock = mockFetch(jsonResponse(true, {}));
    await resetPassword("secret-token", "ValidPassw0rd!");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/reset-password");
    expect(url).not.toContain("secret-token");
    expect(JSON.parse(String(init.body))).toEqual({
      token: "secret-token",
      newPassword: "ValidPassw0rd!",
    });
  });
});

describe("resendVerification", () => {
  it("carries the callbackURL the verification link returns to (ADR-079 #7)", async () => {
    const fetchMock = mockFetch(jsonResponse(true, { status: true }));
    await expect(resendVerification("a@b.c", "/sign-in?verified=1")).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/send-verification-email");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "a@b.c",
      callbackURL: "/sign-in?verified=1",
    });
  });

  it("reports a refusal rather than claiming it sent", async () => {
    mockFetch(jsonResponse(false, {}));
    await expect(resendVerification("a@b.c", "/x")).resolves.toBe(false);
  });

  it("a network failure is false, not a throw — the nudge must not break the header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    await expect(resendVerification("a@b.c", "/x")).resolves.toBe(false);
  });
});

describe("two-factor sign-in (ADR-123)", () => {
  it("reports a two-factor challenge instead of a signed-in session", async () => {
    mockFetch(jsonResponse(true, { twoFactorRedirect: true, twoFactorMethods: ["totp"] }));
    await expect(signInWithPassword("a@b.c", "pw")).resolves.toEqual({ status: "twoFactor" });
  });

  it("verifies the code on Better Auth's endpoint and surfaces the userType", async () => {
    const fetchMock = mockFetch(jsonResponse(true, { token: "t", user: { userType: "LEARNER" } }));
    await expect(verifyTwoFactorSignIn("123456")).resolves.toEqual({
      status: "ok",
      userType: "LEARNER",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/two-factor/verify-totp",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ code: "123456" }) }),
    );
  });

  it("tells a wrong code from a challenge that has expired", async () => {
    mockFetch(jsonResponse(false, { code: "INVALID_CODE" }));
    await expect(verifyTwoFactorSignIn("000000")).resolves.toEqual({ status: "invalidCode" });
    mockFetch(jsonResponse(false, { code: "INVALID_TWO_FACTOR_COOKIE" }));
    await expect(verifyTwoFactorSignIn("000000")).resolves.toEqual({ status: "expired" });
    mockFetch(jsonResponse(false, { code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" }));
    await expect(verifyTwoFactorSignIn("000000")).resolves.toEqual({ status: "expired" });
    mockFetch(jsonResponse(false, null));
    await expect(verifyTwoFactorSignIn("000000")).resolves.toEqual({ status: "failed" });
  });
});
