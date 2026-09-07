# ADR-052: Two sign-in surfaces — staff at `/admin/sign-in`, learners on the public site

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 04 (`@repo/auth`), 12 (public site), 09 (admin shell)
**Supersedes:** —
**Superseded by:** —

## Context

Module 04 shipped exactly one credential screen: `/[locale]/sign-in`, on the
PUBLIC surface. It was written as the admin's login — `proxy.ts`'s STAFF gate
redirected `/admin/*` to it, its default post-sign-in destination was
`/admin`, and the public header's `AuthSlot` linked to it for everyone. One
form, two audiences, and the audience it actually served was staff.

That has three problems.

1. **The public site advertises an administrator login.** ADR-006 already
   accepts a single origin for both surfaces and pays for it with the
   compensating controls in `security.md` #3. Putting the staff entry point on
   the marketing site adds nothing to those controls and hands an
   unauthenticated visitor the portal's front door plus a "Sign in" link
   pointing at it.
2. **Learners have no way in.** `emailAndPassword` and `sendOnSignUp`
   verification have been configured in `@repo/auth` since Module 04, and
   `seed.ts` has carried a disabled `/sign-up` CTA the whole time, but no
   sign-up screen was ever built. The public site could not create the
   LEARNER accounts the whole platform is for.
3. **One form cannot carry two policies.** Staff sign-in wants a `/admin`
   destination and a noindex, staff-only screen; learner sign-in wants a
   public destination and must never be a route into the portal.

The owner asked (2026-09-07) to remove the system-administrator login from the
public site and give the public site its own login and sign-up.

## Decision

### 1. The staff sign-in screen moves under `/admin`

`/admin/sign-in`, rendered by a second admin-side root layout in the
`(admin-auth)` route group. It cannot live in `(admin)` — that group's root
layout IS the server-side STAFF re-check, so a sign-in page inside it would
redirect to itself forever. Next.js multiple root layouts (already the
mechanism behind ADR-006's two surfaces) give it its own `<html>`, the admin
theme, and no `AdminShell`.

`proxy.ts` exempts that one path from the STAFF gate and points every gate
redirect at it. Nothing else about the gate changes: it is still a fast,
DB-free cookie-cache check, still not the boundary, and the admin layout's
`loadSubject()` re-check is still the boundary (`security.md` #3).

### 2. The public site keeps `/[locale]/sign-in` and gains `/[locale]/sign-up`

Both are learner surfaces. `sign-in` defaults to the localized home page
instead of `/admin` and REFUSES a `?redirect=` target under `/admin`;
`sign-up` posts to Better Auth's `/api/auth/sign-up/email`. `userType` stays
`input: false` with a `LEARNER` default in `@repo/auth`, so public sign-up
cannot mint a staff account even if the request body says so — the
mass-assignment defense is the existing config, not new code.

### 3. Each form refuses the other's accounts, as UX

The public sign-in signs a STAFF account straight back out and shows an
error; the admin sign-in does the same to a LEARNER. Both checks read
`userType` from the sign-in response the credential POST already returns —
no extra round trip.

This is display logic in a client component and is **not** claimed as a
security control. The credential POST still goes to Better Auth's own HTTP
handler, which is where rate limiting and lockout live (ADR-001 finding #4),
and every real boundary is untouched: the proxy gate, the admin layout's
`loadSubject()` re-check, and `requirePermission()` in every mutation. A
staff member who signs in on the public form and then types `/admin` reaches
the portal exactly as before — which is correct, because their authorization
never depended on which form they used.

## Consequences

- The public surface no longer references `/admin` anywhere. The gate's
  redirect target, the admin layout's unauthenticated redirect, the profile
  page's, and the idle-timeout's all become `/admin/sign-in`.
- `/admin/sign-in` is the only `/admin` path reachable without a session.
  It is `robots: noindex` and renders no navigation, so it exposes no route
  names.
- Rejecting the other surface's `userType` is legible to an attacker as an
  account-type oracle for an email whose password they already hold. Judged
  acceptable: knowing the password is the hard part, and the alternative —
  silently signing staff in on the learner form — is the behavior this ADR
  exists to remove.
- `sign-up` joins `RESERVED_PATHS`, so no CMS page can shadow it.
- E2E: `auth.setup.ts` drives `/admin/sign-in`. Its `fixme` (a hydration
  failure under Playwright, not a server defect) is unchanged and still
  blocks the admin project.
- Email verification remains non-blocking for sign-in (plan.md: required to
  comment/access premium, not to read), so a new learner lands signed in with
  `status: PENDING_VERIFICATION`. The verification mail is still the dev
  `logEmail()` stand-in — no provider is assigned to a module yet.
