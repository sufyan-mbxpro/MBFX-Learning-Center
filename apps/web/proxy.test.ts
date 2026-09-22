// Proxy routing unit tests (SKILL.md Module 06: default locale unprefixed,
// /ar/... prefixed, unknown locale untouched by the proxy itself, /admin
// never locale-prefixed). `next/experimental/testing/server`'s
// `unstable_doesMiddlewareMatch` (testing.md's suggested tool) isn't
// present in this installed Next 16.3.3 — this instead invokes the
// exported `proxy()` function directly with constructed `NextRequest`s
// (the same technique, one layer more direct: real behavior, not just
// matcher-pattern prediction) and separately asserts the matcher regexes
// themselves for the one claim that can't be observed through `proxy()`
// alone — that /admin and /api are excluded from next-intl's own pattern.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy, config } from "./proxy.ts";

// The proxy asks `/api/public-path` whether an unowned address answers
// (ADR-146). Stubbed at the network edge: the answer is what each test says,
// and "page" by default so the older routing tests see the old pass-through.
const lookup = vi.fn(async (): Promise<{ kind: string; to?: string }> => ({ kind: "page" }));
const fetchMock = vi.fn(async (_url: URL | string) => Response.json(await lookup()));
vi.stubGlobal("fetch", fetchMock);
beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue({ kind: "page" });
});

function requestFor(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy — locale routing (public surface)", () => {
  it("the default locale ('en') is not redirected — '/' resolves without a redirect", async () => {
    const response = await proxy(requestFor("/"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
  });

  it("a non-default locale prefix ('/es') is not redirected away from itself", async () => {
    const response = await proxy(requestFor("/es"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    const location = response.headers.get("location");
    if (location) expect(new URL(location).pathname).toBe("/es");
  });

  it("an RTL locale prefix ('/ar') is not redirected away from itself", async () => {
    const response = await proxy(requestFor("/ar"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    const location = response.headers.get("location");
    if (location) expect(new URL(location).pathname).toBe("/ar");
  });

  it("an unrecognized locale prefix passes through unredirected — the 404 for it is a page-level concern (hasLocale + notFound in the [locale] layout), not the proxy's", async () => {
    const response = await proxy(requestFor("/xx/anything"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
  });

  it("a CMS page path under a non-default locale ('/es/about') is locale-routed, not redirected away from itself (Module 16)", async () => {
    const response = await proxy(requestFor("/es/about"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    const location = response.headers.get("location");
    if (location) expect(new URL(location).pathname).toBe("/es/about");
  });
});

/** A rewrite to the global not-found (ADR-146): Next serves it with a real 404. */
function rewrittenTo(response: Response): string | null {
  const target = response.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
}

describe("proxy — the staff credential screens live at /keystone (ADR-146, ADR-151)", () => {
  it.each(["/keystone", "/keystone/forgot-password", "/keystone/reset-password"])(
    "%s is served anonymously from its own file — no gate, no redirect, no rewrite",
    async (path) => {
      const response = await proxy(requestFor(path));
      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
      expect(rewrittenTo(response)).toBeNull();
    },
  );

  it.each(["/keystone", "/keystone/forgot-password", "/keystone/reset-password"])(
    "%s gets the admin surface's headers and a per-request nonce",
    async (path) => {
      const response = await proxy(requestFor(path));
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      const csp = response.headers.get("Content-Security-Policy")!;
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    },
  );

  it.each(["/keystone/dashboard", "/keystone/sign-in", "/keystone/reset-password/extra"])(
    "an anonymous %s is gated — membership of the open set is exact, never a prefix",
    async (path) => {
      const response = await proxy(requestFor(path));
      expect(response.headers.get("location")).toBeNull();
      expect(rewrittenTo(response)).toBe("/not-found-page");
    },
  );

  it("/keystone-debug is not the portal at all", async () => {
    const response = await proxy(requestFor("/keystone-debug"));
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });
});

describe("proxy — the old /admin prefix is gone (ADR-151)", () => {
  it.each(["/admin", "/admin/users", "/admin/sign-in", "/admin/api/email/preview"])(
    "%s is a 404 — anonymous or signed in — and never a redirect that names the new address",
    async (path) => {
      for (const cookie of [undefined, "better-auth.session_token=a-real-session-token"]) {
        const response = await proxy(requestFor(path, cookie));
        expect(response.status).not.toBe(307);
        expect(response.headers.get("location")).toBeNull();
        expect(rewrittenTo(response)).toBe("/not-found-page");
      }
    },
  );
});

describe("proxy — /keystone STAFF gate (security.md #3: the two-lock proxy gate)", () => {
  it.each([
    "/keystone/dashboard",
    "/keystone/users",
    "/keystone/website",
    "/keystone/forgot-password-debug",
  ])("an anonymous %s is a 404, never a redirect that names the sign-in address", async (path) => {
    const response = await proxy(requestFor(path));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
    expect(rewrittenTo(response)).toBe("/not-found-page");
  });

  it("/keystone is never routed through next-intl", async () => {
    const response = await proxy(requestFor("/keystone/dashboard"));
    expect(rewrittenTo(response)).not.toMatch(/^\/(en|es|ar|ur)\//);
  });

  // changes-21 F5 / ADR-078 #8 — the email preview is framed by the template
  // editor, and a frame the surrounding policy says DENY to renders nothing.
  it("the email preview is the one /keystone path that may be framed", async () => {
    const response = await proxy(
      requestFor("/keystone/api/email/preview", "better-auth.session_token=a-real-session-token"),
    );
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
  });

  it("every other /keystone path — its own siblings included — stays DENY", async () => {
    for (const path of [
      "/keystone/dashboard",
      "/keystone/settings/email",
      "/keystone/settings/email/templates/auth.password_reset",
      "/keystone/api/email/preview-all",
      "/keystone/api/email",
    ]) {
      const response = await proxy(
        requestFor(path, "better-auth.session_token=a-real-session-token"),
      );
      expect(response.headers.get("X-Frame-Options"), path).toBe("DENY");
      expect(response.headers.get("Content-Security-Policy"), path).toContain(
        "frame-ancestors 'none'",
      );
    }
  });

  it("the admin CSP is ENFORCED, and Next is handed the nonce on the request", async () => {
    const response = await proxy(
      requestFor("/keystone/dashboard", "better-auth.session_token=a-real-session-token"),
    );
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("report-uri /api/csp-report");
    // Next forwards request-header overrides as `x-middleware-request-*`.
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("a NAVIGATION carrying a session token but no fresh cookie cache is let through — the cache expires after 5 minutes and nothing rewrites it on a page view (changes-18 PR 1)", async () => {
    const response = await proxy(
      requestFor("/keystone/glossary", "better-auth.session_token=a-real-session-token"),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(rewrittenTo(response)).toBeNull();
  });

  it("that fall-through is not a hole: the request reaches (admin)/layout.tsx, which loads the subject from the database and 404s a non-STAFF user (ADR-006 — the proxy is a gate, the layout is the boundary)", async () => {
    const response = await proxy(
      requestFor("/keystone/dashboard", "better-auth.session_token=learner-token"),
    );
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("location")).toBeNull();
  });

  it("a Server Action request with a stale/missing cookie cache is let through — rejecting it breaks the client's action-response parsing (regression: 'An unexpected response was received from the server' saving the theme)", async () => {
    const request = requestFor("/keystone/theme");
    request.headers.set("next-action", "0123456789abcdef0123456789abcdef01234567");
    const response = await proxy(request);
    expect(response.headers.get("location")).toBeNull();
    expect(rewrittenTo(response)).toBeNull();
  });
});

describe("proxy — real 404s on the public surface (changes-49, ADR-146)", () => {
  it.each(["/login", "/dashboard", "/LICENSE", "/xx/anything", "/es/nothing-here"])(
    "an address nothing answers (%s) is rewritten to the global not-found",
    async (path) => {
      lookup.mockResolvedValueOnce({ kind: "not-found" });
      const response = await proxy(requestFor(path));
      expect(rewrittenTo(response)).toBe("/not-found-page");
    },
  );

  it("asks the resolver with the locale split off the path", async () => {
    lookup.mockResolvedValueOnce({ kind: "not-found" });
    await proxy(requestFor("/es/nothing-here"));
    const asked = new URL(String(fetchMock.mock.calls.at(-1)![0]));
    expect(asked.pathname).toBe("/api/public-path");
    expect(asked.searchParams.get("locale")).toBe("es");
    expect(asked.searchParams.get("path")).toBe("/nothing-here");
  });

  it("a stored redirect is a real 308 to a same-site path", async () => {
    lookup.mockResolvedValueOnce({ kind: "redirect", to: "/support" });
    const response = await proxy(requestFor("/about/support"));
    expect(response.status).toBe(308);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/support");
  });

  it("a redirect to another host is ignored, never followed", async () => {
    lookup.mockResolvedValueOnce({ kind: "redirect", to: "//evil.example" });
    const response = await proxy(requestFor("/about/support"));
    expect(response.status).not.toBe(308);
  });

  it("a page that exists is let through to locale routing", async () => {
    lookup.mockResolvedValueOnce({ kind: "page" });
    const response = await proxy(requestFor("/es/about"));
    expect(rewrittenTo(response)).not.toBe("/not-found-page");
  });

  it("a failed lookup falls back to letting the page answer (the old soft 404), never an outage", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down"));
    const response = await proxy(requestFor("/somewhere"));
    expect(rewrittenTo(response)).not.toBe("/not-found-page");
  });

  it("a coded route's first segment is never looked up", async () => {
    fetchMock.mockClear();
    await proxy(requestFor("/news/some-article"));
    await proxy(requestFor("/learn/forex"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["/foo.txt/news", "/admin.json", "/es/foo.txt"])(
    "a dotted first segment (%s) is a 404 — it used to become a bogus [locale] and a 500",
    async (path) => {
      const response = await proxy(requestFor(path));
      expect(rewrittenTo(response)).toBe("/not-found-page");
    },
  );

  it("an anonymous /account is sent to sign-in by the proxy, with its way back", async () => {
    const response = await proxy(requestFor("/account/progress"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect")).toBe("/account/progress");
  });

  it("a public response carries an enforced CSP and no hreflang Link header", async () => {
    const response = await proxy(requestFor("/"));
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    expect(response.headers.get("link")).toBeNull();
  });
});

describe("proxy matcher — /admin, /keystone and /api excluded from next-intl's own pattern", () => {
  // Next's matcher strings compile via path-to-regexp, not `new RegExp()`,
  // so these assert the source text rather than re-implementing the compiler.
  const [localeRoutingSource] = config.matcher;

  it("the negative lookahead names each exclusion up to a `/` or the end — never a bare prefix", () => {
    expect(localeRoutingSource).toContain("(?!api(?:/|$)|admin(?:/|$)|keystone(?:/|$)|");
  });

  it("the gate's own entries cover /admin and /keystone, bare and nested", () => {
    for (const entry of ["/admin", "/admin/:path*", "/keystone", "/keystone/:path*"]) {
      expect(config.matcher).toContain(entry);
    }
  });
});
