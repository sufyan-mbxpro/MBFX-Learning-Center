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
import { describe, expect, it } from "vitest";
import { proxy, config } from "./proxy.ts";

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

describe("proxy — /admin STAFF gate (security.md #3: the two-lock proxy gate)", () => {
  it("redirects to /admin/sign-in with the original path preserved when there is no STAFF session cookie", async () => {
    const response = await proxy(requestFor("/admin"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/sign-in");
    expect(location.searchParams.get("redirect")).toBe("/admin");
  });

  it("a nested /admin/* path is also gated and preserves its own path in the redirect", async () => {
    const response = await proxy(requestFor("/admin/users"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/admin/users");
  });

  it("/admin is never routed through next-intl — no locale prefix ever appears in the redirect target", async () => {
    const response = await proxy(requestFor("/admin"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).not.toMatch(/^\/(en|es|ar|ur)\//);
  });

  it("the Module 16 admin surface ('/admin/website') is gated exactly like every other /admin/* path, never locale-prefixed", async () => {
    const response = await proxy(requestFor("/admin/website"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/sign-in");
    expect(location.searchParams.get("redirect")).toBe("/admin/website");
    expect(location.pathname).not.toMatch(/^\/(en|es|ar|ur)\//);
  });

  it("/admin/sign-in is the one /admin path the gate lets through unauthenticated — gating it would redirect it to itself (ADR-052)", async () => {
    const response = await proxy(requestFor("/admin/sign-in"));
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    expect(response.headers.get("location")).toBeNull();
  });

  it("/admin/sign-in still gets the admin surface's headers and a per-request nonce", async () => {
    const response = await proxy(requestFor("/admin/sign-in"));
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    const csp = response.headers.get("Content-Security-Policy-Report-Only")!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  });

  it("a path that merely STARTS with the sign-in path is still gated — the exemption is exact, not a prefix", async () => {
    const response = await proxy(requestFor("/admin/sign-in-secrets"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/sign-in");
  });

  it("a Server Action request with a stale/missing cookie cache is NOT redirected — redirecting it breaks the client's action-response parsing (regression: 'An unexpected response was received from the server' saving the theme)", async () => {
    const request = requestFor("/admin/theme");
    request.headers.set("next-action", "0123456789abcdef0123456789abcdef01234567");
    const response = await proxy(request);
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy matcher — /admin and /api excluded from next-intl's own pattern", () => {
  // Next's matcher strings compile via path-to-regexp, not `new RegExp()` —
  // reconstructing that compiler here would just be a second, less-trusted
  // implementation of the thing under test. These assert the pattern's own
  // source text names the right exclusions (architecture.md #4/#7: the
  // matcher must never locale-prefix /admin or /api) rather than pretending
  // to execute it; `proxy()`'s own /admin-first branch above is what
  // actually proves the gate runs correctly, end to end.
  const [localeRoutingSource] = config.matcher;

  it("the locale-routing pattern's negative lookahead excludes admin and api by name", () => {
    expect(localeRoutingSource).toContain("(?!api|admin|");
  });

  it("the second matcher entry explicitly covers /admin/*, so the STAFF gate still runs for it", () => {
    expect(config.matcher[1]).toBe("/admin/:path*");
  });
});
