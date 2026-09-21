# ADR-125: Account and progress are two pages, and a profile change reaches the header

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site), 04 (`@repo/auth`)
**Plan:** owner request, 2026-09-16 (follow-up to `docs/changes/changes-38-fixes.md`)
**Supersedes:** ADR-123 §1's "one page". The rest of ADR-123 stands: the session read inside `<Suspense>`, the beacon, the resume rule, the actions, the audit hooks and the menu.
**Superseded by:** —

## Context

The owner, after ADR-123 shipped:

> make the separate page for the my account & progress/history page.. in
> profile there should be option to email verification within the page..
> resend email etc.. also when user update the image then it should show in
> the profile pic in menu

`/account` put activity (courses, quizzes, reading) and settings (picture,
details, password, two-factor) on one long page. The only place to resend a
verification email was the header menu. A new picture updated on the page and
did not update in the header menu, **even after a full reload**, for two
reasons:

1. `PublicSessionProvider` reads `/api/auth/get-session` once, on mount.
   `router.refresh()` re-renders server components and leaves client state
   alone, so the header kept the old session.
2. Better Auth keeps two copies of `session.user` that a direct Prisma write
   does not reach. The Redis copy (`secondaryStorage`, one per session token)
   is served by `findSession` for the session's whole lifetime, up to 7 days.
   The signed cookie cache is served for `cookieCache.maxAge`, 5 minutes.
   `setOwnAvatar` and `updateOwnProfile` write the row through `@repo/db`, so
   both copies kept the old `image` and `name`. Better Auth's own `updateUser`
   refreshes the Redis copies (`refreshUserSessions`). Our services do not go
   through it, and cannot: core does not depend on auth.

## Decision

### 1. Two routes under one layout

- `/account` covers profile and security: email verification, picture and
  details, password, two-factor.
- `/account/progress` covers progress and history: courses with resume,
  quiz attempts, recent reading.

`account/layout.tsx` renders the shared `SectionNav` (ADR-076 §1) with the two
entries. It reads no session, so the layout stays cached. ADR-112's narrowing
is satisfied: these are two different kinds of page that a reader moves
between. Each page keeps ADR-123 §1's shape: a static shell and one
session-reading body inside `<Suspense>`, `robots: { index: false, follow: false }`.
`account/_lib/learner-session.ts` is the one place that turns "no learner
session" into a sign-in redirect that returns to the page the reader asked
for.

`loadLearnerAccount` is split into `loadLearnerProfile(userId)` and
`loadLearnerActivity(userId, locale)`, so neither page runs the other's
queries. Because the history page is now a page in its own right rather than
one band of three, its limits rise: 12 courses, 20 quiz attempts, 20 reads.

The header menu gains "My progress" beside "My account".

### 2. Email verification is a panel on `/account`

The panel shows the address and its state. When the address is unverified it
offers "Resend verification email" through the existing `resendVerification`
helper, so Better Auth's per-IP limit on `/send-verification-email` still
applies (security.md #13). A successful send is replaced by a `role="status"`
"check your inbox" message, and a failed or throttled send offers a retry.
The link's callback is `/account?verified=1`. A signed-in reader lands back on
the panel, which says so. A reader who opens the link on another device is
sent to `/sign-in?verified=1&redirect=/account`.

### 3. A profile change refreshes the session copies, then the header

- **Server.** `@repo/auth` exports `refreshSessionUser(userId)`. It calls
  Better Auth's `internalAdapter.updateUser(userId, { updatedAt })`, which
  re-reads the row and rewrites every live Redis copy through Better Auth's
  own `refreshUserSessions`. There is no hand-written Redis key format to
  drift from the library's. The three learner actions call it after the core
  write succeeds. The user-update hook stays silent: `twoFactorAuditAction`
  keys on an endpoint path, and this call has none.
- **Client.** `PublicSessionProvider` exposes `refresh()` through
  `useRefreshPublicSession()`. It reads
  `/api/auth/get-session?disableCookieCache=true`, which bypasses the signed
  cookie and sets a new one from the fresh copy, and then replaces the
  provider state. `SessionSync`, mounted on both account pages, compares the
  server's view of name, image and verification with the provider's. When
  they differ it refreshes, at most once per distinct server value, so a
  failing refresh cannot loop. An avatar upload calls `router.refresh()`, the
  page re-renders with the new URL, `SessionSync` sees the difference, and the
  header avatar changes without a reload. The same path clears the unverified
  dot after `?verified=1`.

## Consequences

- `/account` is still the address the menu, the sign-in redirect and
  `ACCOUNT_PATH` name; nothing that links to it moves.
- The staff profile (`/admin/profile`) writes through the same
  `updateOwnProfile` and has the same stale-copy fault in whatever reads
  `session.user` there. Out of scope here; the helper exists for it.
- `refreshSessionUser` bumps `updatedAt` a second time on a write that has
  just set it. Harmless, and the price of not reimplementing the library's
  cache format.

## Alternatives considered

- **Writing name and image through Better Auth's `/update-user`.** That would
  refresh the copies itself. It would also move a write, its schema and its
  audit row out of `updateOwnProfile`, which the staff profile shares.
- **Deleting the Redis copies instead of rewriting them.** `findSession`
  would fall back to the database row, but only because `storeSessionInDatabase`
  is on today. Rewriting through the library does not depend on that.
- **Polling the session in the provider.** Every public page would pay for a
  change that happens on one page.
