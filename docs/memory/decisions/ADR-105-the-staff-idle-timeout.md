# ADR-105: The staff idle timeout is the session's own expiry, slid forward by admin activity

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 04 (auth), 05 (settings), 09 (admin shell)
**Supersedes:** the "Module 09/10 owns actually differentiating staff vs
learner lifetime" TODO in `@repo/auth`'s session block, which had been open
since Module 04.
**Superseded by:** —

## Context

`session.expiresIn` is 7 days for everybody. ADR-006 accepted a same-origin
learner/staff surface on the condition of "mandatory compensating controls",
and named a shorter staff lifetime as one of them; nothing implemented it, and
the comment in `packages/auth/src/index.ts` said so in as many words.

The owner asked for it as a product feature rather than a constant: a dropdown
in **Settings → General** offering 2, 5, 15, 30, 60 and 120 minutes, plus
never, and — their words — "also implement that functionality as well".

What they are describing is an **idle** timeout, not an absolute one. A staff
account that is being used all afternoon should stay signed in; one left on a
screen in a shared office should not. That distinction is the whole decision:
an absolute lifetime is a config value, an idle lifetime is a thing that has to
be slid forward by activity, and the question is where the sliding happens.

Three placements were considered.

**In `proxy.ts`.** Rejected outright — architecture.md #3 forbids logic there,
and the proxy reads the 5-minute cookie cache, so it cannot even see a session
that expired 2 minutes ago.

**In the admin root layout.** It is force-dynamic and every `/admin/*` page
passes through it, which sounds like complete coverage and is not: the article
editor autosaves through route handlers, every mutation is a server action, and
neither re-renders a layout. A person editing one long post for half an hour
would be signed out mid-sentence having been continuously active.

**In `auth()`.** Every authenticated server path in the repo already calls it —
the admin layout's STAFF re-check, `requirePermission`, every route handler,
every server action. It is the only place where "the staff member did something
that required proving who they are" is observable exactly once, for all of
them.

## Decision

**1. The timeout IS the session's `expiresAt`. There is no second check.**
`auth()` shortens the session row's own expiry to `now + timeout` for a STAFF
subject, and Better Auth's ordinary validation does the rest: an idle session
is not "flagged as idle", it is _expired_, so `auth()` returns null, the admin
layout redirects, `requirePermission` refuses, and the API answers 401 —
without one of those four paths having to remember a new rule. A control that
works by removing a capability rather than by adding a guard cannot be
forgotten at a call site, which is the same reasoning security.md #1 applies to
`requirePermission` itself.

It also means the timeout is enforced against the DATABASE, not a cookie.
`auth()` passes `disableCookieCache: true` for reasons its own comment
explains at length; an expiry written here is therefore visible on the very
next authenticated call, not up to `cookieCache.maxAge` later. The proxy's
optimistic gate can still wave a 2-minute-dead session through for up to five
minutes — and then the layout refuses it. That is ADR-006's shape exactly,
unchanged: the proxy is a gate, the server-side check is the boundary.

**2. Activity means an authenticated server check, which is to say: the
admin.** `auth()` is not called while rendering the public site —
`PublicSessionProvider` (ADR-094) polls Better Auth's own `get-session` route,
which validates a session without sliding it. So a staff member reading the
public site is not, for this purpose, active.

This is deliberate rather than incidental. The setting is named for the admin,
the risk it addresses is an unattended admin screen, and a definition of
activity that included anonymous page reads would mean a signed-in staff
account never times out as long as a tab somewhere is polling.

**3. It applies to STAFF only.** A learner's session is untouched and keeps the
7-day default. Two locks, again (security.md #3): `userType` is what decides,
not a role or a permission, so this cannot be turned off by a grant.

**4. The slide is throttled, not written per request.** `auth()` writes only
when the remaining lifetime has decayed by more than 60 seconds, so continuous
use costs at most one indexed single-row UPDATE per minute rather than one per
request. The cost of getting this wrong is a minute of accuracy on a control
whose shortest setting is two.

**5. `@repo/auth` gains a dependency on `@repo/settings`.** No cycle —
`settings` depends on `db` and `contracts` only — and the read is
`getSetting`, which is cached and tagged `settings:general`, so it is not a
query per request. This is a real widening of the session path that
architecture.md #8 asks to be justified rather than assumed, and the
justification is decision 1: any other owner of this behaviour needs its own
check in four places, and the package that owns sessions is the one place all
four already agree on.

**6. The value is a dropdown of named durations, and "never" is one of them.**
`security.adminSessionTimeout` lives in the **general** group (the owner's
placement) and is a `SELECT` over `"2" | "5" | "15" | "30" | "60" | "120" |
"never"` — minutes as strings, with an explicit sentinel rather than `0`.
A `0` that means "unlimited" is a convention a reader has to be told; the
platform already carries one (`ai.monthlyBudgetUsd`) and needed a sentence of
prose on the screen to explain it.

Seeded **"never"**, so no existing deployment's behaviour changes until
somebody chooses otherwise.

**7. A SELECT setting's options are named, not printed.** ADR-044 #5 says a
raw identifier never renders, and the settings form was rendering option values
verbatim — which was survivable for `light`/`dark`/`system` and is meaningless
for `2`. Options now resolve `admin.settingOptions.<key>.<value>` through
`t.has` with a `humanizeKey()` fallback, the same two-step the role editor's
permission-group cards use, so `"120"` reads "2 hours" and an unlabelled option
still renders as words rather than crashing.

## Consequences

- A staff member who leaves the admin idle past the timeout is signed out of
  the **whole site**, public surface included: there is one session, which is
  the point of ADR-006's single origin and the thing its compensating controls
  exist to pay for.
- Lowering the setting does not retro-expire existing sessions on its own; each
  one shortens on its owner's next authenticated call. Immediate global
  revocation is a different feature (a "sign everyone out" button) and is not
  this one.
- The setting's cache is tagged `settings:general`, so the settings screen's
  own write invalidates it. Between the write and the next read a session may
  slide against the previous value once. Two minutes of staleness on a
  two-minute timeout is the worst case, and the alternative — an uncached read
  on the session path — is the thing decision 5 was careful to avoid.
- `Session` (the interface `@repo/rbac` has depended on since Module 03) now
  also types `session.id` and `session.expiresAt`. Additive: Better Auth was
  already returning both, and no consumer's call shape changes.
