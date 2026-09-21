# ADR-123: The learner profile page, an account menu, and read tracking

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 12 (public site), 04 (`@repo/auth`), 11 (content: progress/quizzes), 15 (articles), 01 (`@repo/db`)
**Plan:** `docs/changes/changes-38-fixes.md`
**Supersedes:** —. Delivers ADR-079 #7's "account MENU", which `auth-slot.tsx` had stood in for with a button beside the name chip.
**Superseded by:** —

## Context

The owner, in changes-38:

> the verify email button & check the inbox message to verify should be visible
> in dropdown way.. when user click on the profile page there should also be
> visible the profile page with saved courses history, to start their last
> remaining course.. last attempted quizzes etc.. latest reading news activity
> after signin.. on that profile page the user can set the profile pic, basic
> user info, reset password, 2fa enable..

Until now a learner had no page of their own. The header showed a name and, for
an unverified address, a small button. Progress, quiz attempts and enrollments
were recorded (ADR-056, ADR-058) but only ever shown back one course or one
quiz at a time. Nothing recorded what a learner read. Better Auth's two-factor
plugin had been configured since Module 04 with no screen to turn it on, and
nothing on the public sign-in screen could complete a two-factor challenge.

Three rules were in the way: public pages are cached and read no session
(ADR-004, ADR-056 #1, ADR-094); credential calls go to Better Auth's own
handler (ADR-001 #4); bytes enter storage only through `storeImage`
(security.md #9).

## Decision

### 1. `/account` reads the session on the server, inside `<Suspense>`

The page is one server component that calls `auth()` and
`loadLearnerAccount()` (`@repo/core/account.ts`), wrapped in `<Suspense>`. Under
Cache Components that makes the wrapped subtree dynamic. The route's shell, the
shared `[locale]` layout and every other page stay as cached as they were.
There is no session read in the layout, the header or any other route.

The alternative, a static shell with client islands behind read APIs, is how
progress works on the course page. It fits there because that page is mostly
shared content with a little per-learner state on top. This page has no shared
content: the shell would be a heading and a skeleton, and filling it would take
four new GET endpoints, each needing the progress route's guard. One
session-reading page is less surface and says what the page is.

`/account` is `robots: { index: false, follow: false }`, reserved in
`RESERVED_PATHS`, and a signed-out reader is redirected to
`/sign-in?redirect=/account`. A STAFF session is treated as signed out, as the
header already does (ADR-094): staff edit themselves at `/admin/profile`.

### 2. Reading is tracked by a client beacon, one row per learner and article

New model `ArticleRead` (`article_reads`): `userId`, `articleId`, `readAt`,
unique on `(userId, articleId)`, cascading from both sides. It is a last-read
marker, not a page-view log. A re-read moves `readAt` forward. That answers
"what did I read recently" without a table that grows with every visit.

The article page stays cached. `ReadBeacon` is a client island that waits for
the one public session read (ADR-094) and, for a learner only, posts
`{ articleId }` to `POST /api/account/reads`. The route takes the reader from
`auth()`, not from the body. It rate-limits per user (60/min), parses with
`articleReadSchema` and calls `recordArticleRead`. That applies
`publicArticleWhere`, so a draft or deactivated article is refused as a missing
one (404, security.md #7) rather than recorded. A concurrent duplicate insert is
caught on P2002 and turned into an update. Reads are not audited: a reader
opening an article changes nothing anyone else sees, and one audit row per view
would bury the rows the log exists for.

The profile page applies the same public rules when it reads history. A course,
quiz or article that stops being public disappears from the page, and the rows
stay in the database.

### 3. "Resume" opens the lesson you were in, else the first one you have not done

`pickResumeLesson` (`@repo/contracts`, pure, unit-tested) picks
`lastLessonId` when that lesson is still incomplete and still reachable.
Otherwise it picks the first incomplete lesson in reading order (section, then
lesson), counting only lessons that pass `publicLessonWhere` and sit in a
published section, which is the curriculum's own rule (ADR-081 #2). It does not
pick "the lesson after the last one", which would skip a lesson the learner
jumped past. The page shows up to 6 courses (most recent activity first), 5
finished quiz attempts and 6 reads.

### 4. Profile and avatar are server actions, scoped to the session

`_actions/account.ts` has three actions. `updateAccountProfileAction` reuses
`updateOwnProfile`, the staff profile's service and audit row, through
`learnerProfileSchema`, which is the same schema object. `uploadAvatarAction`
calls the new `setOwnAvatar`. `removeAvatarAction` calls `removeOwnAvatar`. Each
action starts with `auth()` and refuses anything that is not a LEARNER session.
A learner holds no permission keys, so `requirePermission()` has nothing to
check. The boundary is scope: no input carries a user id, and the only row these
actions can write is the session user's own.

`setOwnAvatar` checks a 2 MB cap (`AVATAR_MAX_BYTES`), then sniffs the magic
bytes and accepts PNG, JPEG, GIF and WebP only, refusing SVG and ICO before
anything is stored. After that it stores through `storeImage` with purpose
`"avatar"` in `/general/avatars`, sets `user.image`, and writes
`users.avatarUpdate`. `StoreImageInput.purpose` is widened to
`UploadPurpose | "avatar"` rather than adding `avatar` to `UploadPurpose`. That
enum is what an admin upload may name, and it maps to a permission gate.
Avatar writes are limited to 10 per learner per hour.

### 5. Password and two-factor go to Better Auth's handler, and are audited by hooks

`/api/auth/change-password`, `/two-factor/enable`, `/two-factor/verify-totp`
and `/two-factor/disable` are called from the browser
(`_lib/account-security.ts`), not wrapped in server actions. ADR-001 #4 is one
reason: the rate limits live on the handler. The other is specific to these
endpoints and was measured: every one of them rotates the session, deleting the
row the browser holds and setting a cookie for a new one. A server action
calling `authInstance.api.*` writes the new row and never delivers the cookie,
so the learner would be signed out of the page mid-change. The staff profile's
`changeOwnPasswordAction` does exactly that, and so the same fault is expected
there. It is noted below, not fixed here.

Because the calls do not pass through an action, the audit moves into
`@repo/auth` (`account-audit.ts`):

- `databaseHooks.user.update.after` writes `users.twoFactorEnable` when
  `/two-factor/verify-totp` sets the flag, and `users.twoFactorDisable` when
  `/two-factor/disable` clears it. A sign-in challenge never writes the user
  row, so it cannot be mistaken for an enable.
- `hooks.after` writes `users.passwordChange` and sends the ADR-079 #6 notice
  for an HTTP `/change-password` that returned a user. It skips server-side API
  calls, which the staff action already audits and notifies for, so staff
  changes are not written twice.

Both decisions are pure functions with unit tests. The password change revokes
other sessions.

### 6. Two-factor enrolment, and the sign-in challenge it requires

Enabling is two steps. First, re-enter the password; Better Auth returns an
`otpauth://` URI and backup codes, and `twoFactorEnabled` stays false. Second,
enter the first code from the authenticator app; that sets the flag. Abandoning
after step one changes nothing about sign-in. The page shows a QR code, the
setup key (the URI's `secret`) and the backup codes once. The issuer sent is
`site.name`, so the app lists the account under the site's name rather than
Better Auth's default. Disabling requires the password.

The QR code is encoded in the browser by `uqr` (0.1.3 exact, zero dependencies,
MIT), the one new runtime dependency (`docs/memory/stack.md`). It is imported
only by the `/account` island. It renders dark on light in both colour modes,
because many scanner apps fail on an inverted code.

Turning 2FA on without a way to sign in with it would lock learners out. So
`signInWithPassword` now returns `{ status: "twoFactor" }` when Better Auth
answers `twoFactorRedirect`, and the learner sign-in form shows a code step that
calls `verifyTwoFactorSignIn`. That endpoint has a per-challenge attempt cap and
a per-account lockout. It tells a wrong code apart from an expired challenge,
which sends the reader back to the password step. The staff sign-in form treats
a challenge as a failure, since staff have no enrolment screen.

### 7. The header account control is a dropdown menu

`AuthSlot`'s signed-in state is a `DropdownMenu`. The trigger is the avatar and
name, with a warning dot while the address is unverified. The menu shows the
name and email; for an unverified learner, a "Verify your email" item; "My
account"; and "Sign out". The verify item has `closeOnClick={false}` and calls
the existing `resendVerification`, so Better Auth's per-IP limit on
`/send-verification-email` still applies (security.md #13). After sending, the
item is replaced in place by a `role="status"` "Check your inbox" message naming
the address. A throttled or failed send offers "Try again". `PublicSession`
gains `image`, read from the same get-session payload.

## Consequences

- One public route reads the session on the server. It is fenced by
  `<Suspense>` and by a source guard (`account-menu.test.ts`). A second such page
  should cite this ADR's §1 argument, not the route's existence.
- A running dev server keeps its Prisma client on `globalThis` across hot
  reloads. After this migration the dev server must be restarted, or every
  `db.articleRead` call returns 500. A deploy restarts anyway.
- Avatars are `MediaAsset` rows and appear in the admin media library under
  General. A replaced or removed avatar's file is not deleted, because
  `deleteMedia` needs an admin subject. A staff member who deletes a learner's
  avatar asset breaks that image. Cleanup is future work.
- The staff profile's password change (server action → `api.changePassword`
  with `revokeOtherSessions`) very likely signs the staff member out, for the
  reason in §5. It is out of scope here and worth its own fix.
- `nav.verifyEmail` now reads "Verify your email".

## Alternatives considered

- **Static shell plus client islands for `/account`.** Rejected in §1. It
  would add four read endpoints to fill a page with no shared content.
- **An event-log `ArticleView` table.** It answers questions nobody has asked
  and grows with traffic. A later "most-read" metric needs its own ADR, and
  would likely be a counter.
- **Recording reads during the article page's server render.** That puts a
  session read in a cached page, which ADR-056 #1 forbids.
- **Server actions for password and two-factor.** Measured to drop the rotated
  session cookie (§5).
- **A hand-written QR encoder in `@repo/utils`.** A few hundred lines of
  Reed–Solomon with no decoder in the repo to test it against, against a
  zero-dependency package pinned exactly.
