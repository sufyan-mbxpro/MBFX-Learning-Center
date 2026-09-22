# ADR-151 — The whole staff portal is served under /keystone

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 04 (auth), 09 (admin shell), 14 (hardening)
- **Plan:** owner request, 2026-09-22: "every page from the admin side should
  be prefixed with keystone… remove admin everywhere"
- **Amends:** ADR-006 and architecture.md #7 (the portal's URL prefix), and
  ADR-146 #1 (the credential screens are no longer rewrites)
- **Does not change:** the two locks of the STAFF gate (security.md #3), the
  `(admin)` layout as the boundary, `requirePermission()` on every mutation,
  or any internal name (`(admin)` route group, the `admin.*` catalog
  namespace, `userType`, permission keys, file names)

## Context

ADR-146 moved the staff sign-in to `/keystone`, but every page behind it
still said `/admin/…` in the address bar. Now the owner wants the whole
portal under the new prefix, and no `/admin` address anywhere.

## Decision

1. **The route folders are renamed.** `(admin)/admin` becomes `(admin)/keystone`
   and `(admin-auth)/admin` becomes `(admin-auth)/keystone`. Every portal page,
   and every portal route handler (`/keystone/api/*`), is now served from its
   own file under the new prefix.
2. **`/keystone` stays the sign-in screen, and the dashboard moves to
   `/keystone/dashboard`.** Two pages cannot share one address. The other
   option was to pick one by session cookie, but that leaves a staff member
   with a stale cookie facing a 404 and no way back to the form. Sign-in
   sends staff to `/keystone/dashboard` by default.
3. **The credential screens are ordinary files now, not rewrites.** They are
   `(admin-auth)/keystone/page.tsx`, `…/forgot-password` and
   `…/reset-password`. `STAFF_PUBLIC_PATHS` in `proxy.ts` is the closed,
   exact-match set that skips the gate.
4. **`/admin` and `/admin/*` answer 404, with no redirect.** A redirect would
   print the portal's address for anyone who asked, which is ADR-146 #2's
   reason again. `admin` stays in `RESERVED_PATHS` and in the proxy matcher,
   so that nothing public can claim the segment.
5. **Better Auth's own endpoints are untouched.** `/api/auth/admin/*` belongs
   to the library's `admin` plugin, sits under `/api`, and is not a portal
   page.
6. **Stored links move too.** `Notification.href` holds portal-relative
   paths. A migration rewrites `/admin` to `/keystone/dashboard` and
   `/admin/…` to `/keystone/…`.
7. **`NEXT_PUBLIC_ADMIN_URL` is documented as ending in `/keystone`.**
   `adminPortalBase` (`@repo/auth`) normalises an old value that still ends
   in `/admin`, so an unedited `.env` still produces correct reset links.

## Consequences

- An `/admin/...` bookmark stops working. This is intended.
- The guards that walk the admin tree (`admin-surface.test.ts`,
  `loading-states.test.ts` and the convention tests) now walk
  `(admin)/keystone`.
