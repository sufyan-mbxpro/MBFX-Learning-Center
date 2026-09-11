import { NextResponse, type NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { routing } from "@repo/i18n/routing";

const intl = createMiddleware(routing);

/**
 * The staff credential screen (ADR-052). It lives UNDER /admin — never on
 * the public site — so the public surface carries no administrator entry
 * point at all, and it is the single /admin path the STAFF gate below lets
 * through unauthenticated.
 */
const ADMIN_SIGN_IN_PATH = "/admin/sign-in";

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
    // The third parties we frame, and the only ones.
    //
    // - The economic calendar widget (ADR-050).
    // - The three video providers `parseVideoUrl` (@repo/utils) can produce
    //   an embed URL for. This closes the gap this comment used to record as
    //   open ("video embeds on /news fall back to default-src"): the
    //   homepage's learning rail makes video a first-class surface, and a
    //   report-only policy that does not name these origins would report
    //   noise during the soak and then break every video the day it is
    //   enforced.
    //
    // These are exactly the origins the parser EMITS — youtube-nocookie
    // (never youtube.com), player.vimeo.com, dailymotion's embed host — not
    // the origins a URL may be pasted from. A pasted URL is parsed into one
    // of these or rejected (security.md #9: never trust the raw URL), so the
    // allowlist and the parser cannot drift apart in the unsafe direction.
    `frame-src 'self' https://www.tradays.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.dailymotion.com`,
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
 *                 /admin/sign-in is exempt — it is where the gate SENDS
 *                 people (ADR-052).
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
    // The staff credential screen is the one /admin path that must be
    // reachable without a session — gating it would redirect it to itself
    // (ADR-052). It renders from the (admin-auth) route group, outside the
    // (admin) layout that carries the server-side STAFF re-check, and still
    // gets the admin surface's headers and per-request nonce below.
    if (pathname !== ADMIN_SIGN_IN_PATH) {
      const gated = await staffGate(request, pathname);
      if (gated) return gated;
    }

    // Per-request nonce, forwarded as a REQUEST header so the (fully
    // dynamic) admin layouts can attach it to #brand-tokens via headers().
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return applySecurityHeaders(response, "admin", nonce);
  }

  return applySecurityHeaders(intl(request), "public", null);
}

/**
 * The STAFF gate itself: returns a redirect when the request must be turned
 * away, or `null` to let it continue. Split out of `proxy()` so the sign-in
 * path can skip exactly this and nothing else — headers and nonce still
 * apply to it.
 */
async function staffGate(request: NextRequest, pathname: string): Promise<NextResponse | null> {
  const cache = await getCookieCache(request, { secret: process.env.BETTER_AUTH_SECRET });
  const userType = (cache?.user as { userType?: string } | undefined)?.userType;

  // The cookie cache EXPIRES (5 min, packages/auth) and nothing refreshes it
  // on an admin page view: Better Auth rewrites it when its own handler runs,
  // and the admin surface reads the session inside a server component
  // ((admin)/layout.tsx), where Next.js does not permit setting a cookie. So
  // five minutes after sign-in `cache` is null for a session the database
  // still considers valid for seven days, and this gate was bouncing the
  // staff member to sign-in on every navigation from then on.
  //
  // A session token is therefore what this gate tests for, and the cache is
  // only a fast path on top of it. Raising maxAge would not fix this (the
  // cache still expires and is still never rewritten) and calling auth() here
  // would put Prisma and a round-trip in the proxy, which architecture.md #3
  // forbids. Letting an authenticated request through is exactly ADR-006's
  // division of labour — the proxy is a gate, the layout is the boundary —
  // and the layout already loads the subject from the database and redirects
  // a non-STAFF user. An anonymous request has no token and is still turned
  // away here, which is the case this gate exists for.
  const hasSession = getSessionCookie(request) !== null;

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

  if (userType !== "STAFF" && !hasSession && !isServerAction) {
    const signInUrl = new URL(ADMIN_SIGN_IN_PATH, request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return applySecurityHeaders(NextResponse.redirect(signInUrl), "admin", null);
  }

  return null;
}

export const config = {
  // Excludes /api, /_next, static files — and /admin, which must never be
  // locale-prefixed. The STAFF gate matches /admin separately, above.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)", "/admin/:path*"],
};
