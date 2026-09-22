import { NextResponse, type NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { isReservedFirstSegment } from "@repo/contracts";
import { routing } from "@repo/i18n/routing";

const intl = createMiddleware(routing);

/**
 * The staff credential screens, and the address they are SERVED at
 * (changes-49, ADR-146).
 *
 * The files still live at `(admin-auth)/admin/{sign-in,forgot-password,
 * reset-password}`; the proxy rewrites `/keystone…` onto them and answers the
 * old `/admin/…` addresses with a 404. The point is that nothing on the
 * public internet names the staff entry point: an anonymous `/admin/*`
 * request is a 404 too (see `staffGate`), where it used to be a redirect that
 * printed the sign-in address in its `Location` header for anyone who asked.
 *
 * Membership is EXACT, never a prefix, in both maps. And this is still only a
 * gate — the `(admin)` layout's server-side STAFF re-check is the boundary
 * (security.md #3), and none of these three screens renders from that group.
 */
export const STAFF_SIGN_IN_PATH = "/keystone";

const STAFF_AUTH_REWRITES = new Map([
  [STAFF_SIGN_IN_PATH, "/admin/sign-in"],
  ["/keystone/forgot-password", "/admin/forgot-password"],
  ["/keystone/reset-password", "/admin/reset-password"],
]);

/** The internal addresses above. Reachable only through the rewrite. */
const STAFF_AUTH_INTERNAL = new Set(STAFF_AUTH_REWRITES.values());

/**
 * Where a path that must not exist is rewritten to: `app/(not-found)`, a root
 * layout with no loading boundary whose page calls `notFound()` at once — the
 * one render that answers a REAL 404 with the site's own design (see its
 * layout for why neither `[locale]` nor `global-not-found.tsx` can). A
 * rewrite rather than a response built here, because Next carries the
 * destination's own status through a rewrite and the page lives there.
 */
const NOT_FOUND_PATH = "/not-found-page";

/**
 * The ONE /admin path that may be framed (ADR-078 #8).
 *
 * The email template editor renders its preview in a `sandbox=""` iframe, and a
 * frame the surrounding policy says `DENY` to renders nothing. The route sets
 * its own `Content-Security-Policy: sandbox; default-src 'none'` on the
 * response, so what is framed has an opaque origin, no script and no
 * same-origin access to the admin surface — the exception widens what may be
 * embedded, not what it can reach.
 *
 * Every other /admin path keeps `X-Frame-Options: DENY` and
 * `frame-ancestors 'none'`. Adding a second entry here needs its own reason.
 */
const ADMIN_FRAMABLE_PATHS = new Set(["/admin/api/email/preview"]);

// ─── Security headers (Module 14, security.md #14) ───────────
//
// Per-path policy: stricter on /admin than public (ADR-006 — same origin,
// two surfaces). The CSP shipped report-only for the Module 14 soak and is
// ENFORCED since changes-49 (ADR-146); `baseCsp` says what each surface
// allows and why.
//
// Nonce note: the admin surface is fully dynamic, so a per-request nonce
// works there (#brand-tokens reads it via headers()). PUBLIC pages are
// static/PPR shells — a per-request nonce would force them dynamic, which
// architecture.md #6 forbids.

function baseCsp(nonce: string | null): string {
  // Next's development runtime evaluates code (React Refresh); production
  // never does, so the allowance exists only where it is needed.
  const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  // ENFORCED since changes-49 (it shipped report-only and never flipped).
  //
  // - /admin: a per-request nonce plus 'strict-dynamic' — the only script
  //   that runs is one Next stamped with the nonce, or one such a script
  //   loaded. Next reads the nonce from the REQUEST's CSP header, which
  //   `adminResponse` sets.
  // - public: 'unsafe-inline'. Those pages are static/PPR shells, and a
  //   per-request nonce would make every one of them dynamic (architecture
  //   #6). Everything else in the policy still binds them: no third-party
  //   script origin, no plugin, no foreign base URI or form target, frames
  //   from a closed list.
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`
    : `'self' 'unsafe-inline'${devEval}`;
  // Styles stay 'unsafe-inline' on BOTH surfaces: component libraries
  // (sonner, Base UI's positioning) inject <style> at runtime without a
  // nonce, and a nonce in this directive would switch 'unsafe-inline' off.
  const styleSrc = `'self' 'unsafe-inline'`;
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    // React style={} attributes (chart swatches, sonner) are attr-level.
    `style-src-attr 'unsafe-inline'`,
    // `blob:` for an upload's local preview before it is stored.
    `img-src 'self' data: blob: https:`,
    `media-src 'self' blob: https:`,
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
    //
    // - TradingView's widget host, for the live-rates board and the market
    //   news band (ADR-136 §2). Framed directly, like the calendar, so no
    //   vendor script is ever allowed.
    `frame-src 'self' https://www.tradingview-widget.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.dailymotion.com`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    // Violations are logged by /api/csp-report (changes-49): an enforced
    // policy that breaks something should say what, not fail silently.
    `report-uri /api/csp-report`,
  ].join("; ");
}

function contentSecurityPolicy(nonce: string | null, sameOrigin: boolean): string {
  return `${baseCsp(nonce)}; frame-ancestors ${sameOrigin ? "'self'" : "'none'"}`;
}

function applySecurityHeaders(
  response: NextResponse,
  surface: "admin" | "public",
  nonce: string | null,
  /** ADR-078 #8 — the email preview, and nothing else on /admin. */
  framable = false,
) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const sameOrigin = surface === "public" || framable;
  response.headers.set("X-Frame-Options", sameOrigin ? "SAMEORIGIN" : "DENY");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, sameOrigin));
  // HSTS in production only (changes-49): a browser that has seen it will
  // refuse plain HTTP for two years, which on a developer's localhost would
  // break every other project served on that host.
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

/** The address a public request points at, with its locale prefix taken off. */
function splitLocale(pathname: string): { locale: string; prefix: string; rest: string[] } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return { locale: first, prefix: `/${first}`, rest: segments.slice(1) };
  }
  return { locale: routing.defaultLocale, prefix: "", rest: segments };
}

function notFound(request: NextRequest, surface: "admin" | "public") {
  return applySecurityHeaders(
    NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url)),
    surface,
    null,
  );
}

/**
 * The catch-all's answer, asked BEFORE anything streams (changes-49).
 *
 * Only for a first segment no coded route owns — every other address is a
 * route file, and its own `notFound()` handles a missing record. `null` means
 * "let it through": a page exists, the draft cookie is set (a preview must
 * render whatever the resolver thinks), or the lookup failed — a slow or
 * broken lookup falls back to the old soft-404 rather than taking pages down.
 */
async function resolveUnownedPath(
  request: NextRequest,
  locale: string,
  rest: string[],
): Promise<NextResponse | null> {
  if (request.cookies.has("__prerender_bypass")) return null;
  const path = `/${rest.join("/")}`;
  try {
    const lookup = new URL("/api/public-path", request.nextUrl.origin);
    lookup.searchParams.set("locale", locale);
    lookup.searchParams.set("path", path);
    const response = await fetch(lookup, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const answer = (await response.json()) as { kind?: string; to?: string };
    if (answer.kind === "not-found") return notFound(request, "public");
    if (answer.kind === "redirect" && answer.to?.startsWith("/") && !answer.to.startsWith("//")) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL(answer.to, request.url), 308),
        "public",
        null,
      );
    }
  } catch {
    // Fall through: see the doc comment.
  }
  return null;
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
 *                 An anonymous request is a 404 (ADR-146).
 *   - /keystone → the staff credential screens, rewritten onto their files
 *                 under /admin, which are themselves unreachable directly.
 *   - everything else → next-intl locale routing (Module 06): default
 *                 locale unprefixed ("/"), others prefixed ("/es/..."),
 *                 after an unowned address has been checked for a real 404.
 *                 MUST NOT touch /admin or /api — the matcher below
 *                 excludes /admin from next-intl's own matching, and this
 *                 function checks /admin first and returns before intl()
 *                 ever runs.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The staff credential screens, at their public address (ADR-146).
  const staffScreen = STAFF_AUTH_REWRITES.get(pathname);
  if (staffScreen) return adminResponse(request, pathname, staffScreen);

  // `=== "/admin" || startsWith("/admin/")`, never a bare prefix: `/admin.json`
  // and `/administrator` are PUBLIC addresses that happen to share letters.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // The old addresses of the three screens above, requested directly.
    if (STAFF_AUTH_INTERNAL.has(pathname)) return notFound(request, "admin");
    const gated = await staffGate(request);
    if (gated) return gated;
    return adminResponse(request, pathname, null);
  }

  const { locale, prefix, rest } = splitLocale(pathname);
  const first = rest[0];

  // A dotted first segment (`/admin.json`, `/foo.txt/news`). A real static
  // file never reaches the proxy (the matcher skips a dotted single segment),
  // and letting the rest through made `foo.txt` the `[locale]` param of a real
  // page, which threw on `localeCompare` and answered 500.
  if (first?.includes(".")) return notFound(request, "public");

  if (first && !isReservedFirstSegment(first)) {
    const resolved = await resolveUnownedPath(request, locale, rest);
    if (resolved) return resolved;
  }

  // The learner's account pages read the session INSIDE a Suspense boundary,
  // so an anonymous visitor got a 200 and a client-side hop (changes-49).
  // This is the optimistic half — a cookie, no database — and the page's own
  // `requireLearnerSession` stays the boundary.
  if (first === "account" && getSessionCookie(request) === null) {
    const signIn = new URL(`${prefix}/sign-in`, request.url);
    signIn.searchParams.set("redirect", pathname);
    return applySecurityHeaders(NextResponse.redirect(signIn), "public", null);
  }

  return applySecurityHeaders(intl(request), "public", null);
}

/**
 * An /admin-surface response: a per-request nonce, forwarded as REQUEST
 * headers so the (fully dynamic) admin layouts can attach it to
 * #brand-tokens via headers(), and so Next stamps it on its own scripts — it
 * reads the nonce from the request's `Content-Security-Policy`.
 */
function adminResponse(request: NextRequest, pathname: string, rewriteTo: string | null) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const framable = ADMIN_FRAMABLE_PATHS.has(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce, framable));
  const init = { request: { headers: requestHeaders } };
  // The query rides along: a reset link's `?token=` and sign-in's
  // `?redirect=` are read off the REWRITTEN url, and `new URL(path, base)`
  // drops the base's search.
  const target = rewriteTo ? new URL(rewriteTo, request.url) : null;
  if (target) target.search = request.nextUrl.search;
  const response = target ? NextResponse.rewrite(target, init) : NextResponse.next(init);
  return applySecurityHeaders(response, "admin", nonce, framable);
}

/**
 * The STAFF gate itself: returns a redirect when the request must be turned
 * away, or `null` to let it continue. Split out of `proxy()` so the sign-in
 * path can skip exactly this and nothing else — headers and nonce still
 * apply to it.
 */
async function staffGate(request: NextRequest): Promise<NextResponse | null> {
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

  // A 404, not a redirect to sign-in (changes-49, ADR-146): the redirect's
  // `Location` header was the staff entry point, handed to anyone who asked
  // for `/admin`. Staff reach the screen by its address; a signed-in staff
  // member whose session later lapses is sent there by the admin surface
  // itself (idle-timeout.tsx), which only ever runs for STAFF.
  if (userType !== "STAFF" && !hasSession && !isServerAction) {
    return notFound(request, "admin");
  }

  return null;
}

export const config = {
  // Excludes /api, /_next, static files — and /admin and /keystone, which must
  // never be locale-prefixed; both are matched separately below.
  //
  // The exclusions END at a `/` or the end of the path (changes-49): a bare
  // `(?!api|admin…)` also skipped `/apiary` and `/administrator`, which then
  // reached `[locale]` with no locale routing at all.
  //
  // The last entry catches a DOTTED first segment followed by more path
  // (`/foo.txt/news`), which the first entry skips as a "static file" — see
  // the dotted-segment branch in `proxy()`.
  matcher: [
    "/((?!api(?:/|$)|admin(?:/|$)|keystone(?:/|$)|_next|_vercel|.*\\..*).*)",
    "/admin",
    "/admin/:path*",
    "/keystone",
    "/keystone/:path*",
    "/([^/]+\\.[^/]+/.+)",
  ],
};
