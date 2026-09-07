// Unit tests for the shared credential helpers (ADR-052). These are the
// bits of the two sign-in screens that are pure enough to test without a
// browser: which Better Auth response shape means what, and the two
// redirect guards.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAdminPath,
  resolveRedirect,
  signInWithPassword,
  signUpWithPassword,
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
