# ADR-146 — Staff sign-in at /keystone, real 404s, and an enforced CSP

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 04 (auth), 12 (public site), 14 (hardening)
- **Plan:** `docs/changes/changes-49.md` (owner request, plus the security
  findings pasted into it)
- **Amends:** ADR-052 (the staff sign-in's ADDRESS; the two-surface split
  stands), ADR-079 #3 (the recovery screens' address), the changes-21 audit's
  Q-1 (a) "keep soft 404, no existence checks in proxy.ts", and ADR-105 (the
  idle timeout now has a learner twin).
- **Does not change:** the STAFF gate's two locks (security.md #3), the
  `(admin)` layout as the boundary, or `requirePermission()` on every mutation.

## Context

The owner asked for the staff sign-in to move to `/keystone`, and pasted a
security review of the deployed site. Its findings, and what each turned out
to be:

| Finding                                           | Cause                                                                                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown paths answer 200 with the homepage chrome | `[locale]/loading.tsx` wraps every page in Suspense, so the 200 is streamed before `[...slug]` calls `notFound()`. The Next docs say the same of every Cache Components route and name the proxy as the place a real status is decided. |
| A dotted path (`/foo.txt`) answers 500            | The matcher skips dotted paths, so `foo.txt` became the `[locale]` param of the home page, which threw in `localeCompare`.                                                                                                              |
| No HSTS; `X-Powered-By`                           | Never set / Next's default.                                                                                                                                                                                                             |
| CSP report-only with no report endpoint           | The Module 14 soak never flipped to enforce.                                                                                                                                                                                            |
| Duplicate `Referrer-Policy` etc.                  | The reverse proxy (CloudPanel vhost) adds its own copies on top of the app's.                                                                                                                                                           |
| `localhost:3003` in a `Link` header, five times   | next-intl's `alternateLinks` builds hreflang from the Host the app sees behind nginx — one header, five locale entries.                                                                                                                 |
| `NEXT_LOCALE` without `Secure`                    | next-intl's default cookie options.                                                                                                                                                                                                     |
| No rate limit on staff sign-in                    | Only Better Auth's 3-per-10-seconds burst rule, and the per-IP key was unusable: nginx appends to `X-Forwarded-For`, Better Auth refuses a multi-entry list, and every such request shared one bucket.                                  |
| `/account` gated client-side only                 | The session check runs inside Suspense, so the redirect is in-stream.                                                                                                                                                                   |
| `/admin*` matched instead of `/admin/*`           | `pathname.startsWith("/admin")`.                                                                                                                                                                                                        |

## Decision

1. **The staff credential screens are served at `/keystone`,
   `/keystone/forgot-password` and `/keystone/reset-password`.** The proxy
   REWRITES those three addresses onto the existing files under
   `(admin-auth)/admin/*` and answers the old `/admin/*` addresses with a 404.
   Staff reset emails link to `/keystone/reset-password` (`staffAuthBase`,
   `@repo/auth`). `keystone` is a reserved path.
2. **An anonymous `/admin/*` request is a 404, never a redirect.** The
   redirect's `Location` named the sign-in address to anyone who asked. The
   `(admin)` layout 404s a non-STAFF subject for the same reason. Staff whose
   session lapses mid-work are sent to `/keystone` by `idle-timeout.tsx`,
   which runs only for staff.
3. **The proxy decides a public 404 before anything streams.** For a first
   segment no coded route owns (not in `RESERVED_PATHS`), it asks
   `GET /api/public-path`, a route handler over `@repo/core`'s
   `resolvePublicPage` — the catch-all's own resolver, so the status and the
   page cannot disagree. Not found → a rewrite to `/not-found-page`; a stored
   redirect → a real 308. The draft cookie skips the lookup, and a failed
   lookup falls back to the old behaviour rather than taking pages down. This
   reverses Q-1 (a); the proxy still makes no decision of its own, it asks.
4. **`app/(not-found)` is a fourth root layout** holding the designed 404.
   Inside `(public)` a 404 status is impossible (point 3's Suspense), and
   `global-not-found.tsx` is not what Next renders when the `[locale]` layout
   throws. A layout with no loading boundary whose page calls `notFound()`
   answers 404 with our markup. `not-found-page` is reserved.
5. **A dotted first segment followed by more path is a 404 in the proxy**
   (a new matcher entry), and the home page guards `hasLocale` itself, so
   `/foo.txt` is a 404 rather than a 500.
6. **The CSP is enforced**, with `report-uri /api/csp-report` (a route that
   logs, stores nothing). `/admin` keeps its nonce + `strict-dynamic` and now
   passes the policy on the REQUEST so Next stamps its own scripts. The public
   surface keeps `'unsafe-inline'` scripts because its pages are cached shells
   (architecture #6); everything else in the policy binds it. `style-src` is
   `'unsafe-inline'` on both surfaces — libraries inject `<style>` at runtime,
   and a nonce there would switch `'unsafe-inline'` off. `'unsafe-eval'` in
   development only.
7. **HSTS in production** (`max-age=63072000; includeSubDomains`),
   `poweredByHeader: false`, next-intl `alternateLinks: false` (the metadata
   hreflang, from `siteUrl()`, already lists only servable locales) and a
   `Secure` locale cookie in production.
8. **Sign-in and sign-up have their own rate limits** (`/sign-in/email` 10 per
   5 minutes, `/sign-up/email` 5 per hour, per IP), and Better Auth reads
   `x-real-ip` first — nginx sets it to `$remote_addr` and a client cannot
   choose it.
9. **`/account` is redirected to sign-in by the proxy** on the cookie alone;
   `requireLearnerSession` stays the boundary.
10. **The idle timeout has a learner twin**, `security.learnerSessionTimeout`,
    applied by the same pure rule in `auth()` and the refresh clamp, chosen by
    `userType`.
11. **`resolveRedirect` refuses a backslash** (`/\evil` is `//evil` to a
    browser).

## Not done here

- **CAPTCHA and enforced staff 2FA.** Both need a product decision (a vendor
  and its keys; an enrolment flow on the admin surface). The rate limits and
  the hidden entry point are the mitigation until then.
- **The duplicate headers** come from the reverse proxy, not the app. The fix
  is to drop the vhost's own `add_header` security lines
  (`docs/ops/deploy.md`); the app now sets each header once.
- **Nested soft 404s** (`/news/<missing-slug>`) are still 200 + `noindex`:
  each route would need its own existence check in the proxy.

## Consequences

- An unknown top-level address costs one extra internal request (the
  lookup). Known sections cost nothing.
- Anyone with a bookmark to `/admin/sign-in` gets a 404 and must use
  `/keystone`.
