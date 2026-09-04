import { NextResponse, type NextRequest } from "next/server";
import { getCookieCache } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { routing } from "@repo/i18n/routing";

const intl = createMiddleware(routing);

// ─── Security headers (Module 14, security.md #14) ───────────
//
// Per-path policy: stricter on /admin than public (ADR-006 — same origin,
// two surfaces). CSP ships REPORT-ONLY first (plan.md Module 14: "report-
// only soak then enforce"); the hard headers below are enforced now.
//
// Nonce note: the admin surface is fully dynamic, so a per-request nonce
// works there (#brand-tokens reads it via headers()). PUBLIC pages are
// static/PPR shells — a per-request nonce would force them dynamic, which
// architecture.md #6 forbids; their style-src stays nonce-less in the
// report-only policy until a hash-based allowance for the cached
// brand-tokens css lands (tracked in DEVLOG Module 14).

function baseCsp(nonce: string | null): string {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : `'self' 'unsafe-inline'`;
  const styleSrc = nonce ? `'self' 'nonce-${nonce}'` : `'self' 'unsafe-inline'`;
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    // React style={} attributes (chart swatches, sonner) are attr-level.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  surface: "admin" | "public",
  nonce: string | null,
) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Frame-Options", surface === "admin" ? "DENY" : "SAMEORIGIN");
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    `${baseCsp(nonce)}; frame-ancestors ${surface === "admin" ? "'none'" : "'self'"}`,
  );
  return response;
}

/**
 * Next.js 16 request proxy (the file formerly known as middleware.ts).
 *
 * This single proxy serves both surfaces of the app (ADR-006):
 *   - /admin/*  → STAFF gate. A fast, DB-free check via Better Auth's signed
 *                 cookie cache (packages/auth's session.cookieCache) — this
 *                 is a GATE, not the security boundary. The admin root
 *                 layout re-verifies server-side against the database
 *                 (ADR-006 consequence #4: never assume the proxy ran).
 *   - everything else → next-intl locale routing (Module 06): default
 *                 locale unprefixed ("/"), others prefixed ("/es/...").
 *                 MUST NOT touch /admin or /api — the matcher below
 *                 excludes /admin from next-intl's own matching, and this
 *                 function checks /admin first and returns before intl()
 *                 ever runs.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const cache = await getCookieCache(request, { secret: process.env.BETTER_AUTH_SECRET });
    const userType = (cache?.user as { userType?: string } | undefined)?.userType;

    // Server Action POSTs carry this header. Found live: the cookie cache's
    // maxAge (5 min, packages/auth) is shorter than a slow admin edit — e.g.
    // sitting on the theme editor's Colors/Modes tabs — so a still-valid
    // session (expiresIn: 7 days) can read as non-STAFF here on Save even
    // though the real DB-backed session is fine. Redirecting an action
    // request breaks the Next.js client's action-response parsing (surfaces
    // as the generic "An unexpected response was received from the server"
    // instead of a real error). This gate is a fast path, not the boundary
    // (ADR-006/security.md #3) — requirePermission() re-verifies against the
    // database inside every action and throws a normal, correctly-serialized
    // error the client already catches, so letting a stale-cache action
    // request fall through to that check is safe and gives the user the
    // real error instead of a broken one.
    const isServerAction = request.headers.has("next-action");

    if (userType !== "STAFF" && !isServerAction) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect", pathname);
      return applySecurityHeaders(NextResponse.redirect(signInUrl), "admin", null);
    }

    // Per-request nonce, forwarded as a REQUEST header so the (fully
    // dynamic) admin layout can attach it to #brand-tokens via headers().
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return applySecurityHeaders(response, "admin", nonce);
  }

  return applySecurityHeaders(intl(request), "public", null);
}

export const config = {
  // Excludes /api, /_next, static files — and /admin, which must never be
  // locale-prefixed. The STAFF gate matches /admin separately, above.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)", "/admin/:path*"],
};
