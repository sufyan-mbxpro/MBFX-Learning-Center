# ADR-157 — Two-factor authentication for staff: enrolment, sign-in, enforcement

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 04 (auth), 09 (admin shell), 10 (users), 14 (hardening)
- **Plan:** owner request, 2026-09-22 ("proceed" on the changes-49 review):
  the last open item on the admin sign-in: "2FA not confirmed enforced".
- **Closes:** the "enforced staff 2FA" item ADR-146 left under "Not done
  here", and ADR-123 §6's "the staff sign-in form treats a challenge as a
  failure, since staff have no enrolment screen".
- **Does not change:** the learner flow (ADR-123), the reCAPTCHA plugin
  (ADR-156), the rate limits and lockout, the proxy gate, or the idle timeout
  (ADR-105). No new dependency and no migration.

## Context

Better Auth's `twoFactor` plugin has been installed since Module 04, and
ADR-123 gave learners a way to enrol and a sign-in code step. Staff got
neither. The staff form refused a two-factor challenge, and nothing on
`/keystone` could turn two-factor on. A staff account, which is the one that can
publish, change roles and repoint the mail host, was protected by a password
alone. The audit was right that nothing enforced 2FA.

## Decision

1. **Staff enrol on their own profile.** `/keystone/profile` gets a
   "Two-factor authentication" section. It works like the learner card: re-enter
   the password, scan the QR code or type the key, save the backup codes, then
   enter the first code. It calls the same Better Auth endpoints through
   `_lib/account-security.ts`, so the rate limits and the ADR-123 §5 audit
   hooks (`users.twoFactorEnable` / `users.twoFactorDisable`) apply unchanged.
   `QrCode` moves to `apps/web/app/_lib/qr-code.tsx` so both surfaces use one
   encoder. The admin section is its own component, built to ADR-044/077
   conventions (`Field`, `useFieldErrors`, `admin.*` catalog). It does not reuse
   the learner card, which is built on public-site chrome.
2. **The staff sign-in form completes a challenge.** A `twoFactor` result
   shows a code step that calls `verifyTwoFactorSignIn`, the same function the
   learner form uses. It accepts a backup code as well, with the same attempt
   cap and lockout. The learner-refusal check (ADR-052 §3) runs after the
   code step, when a session exists.
3. **Enforcement is a setting: `security.requireStaffTwoFactor`** (BOOLEAN,
   General → Security, not public). The development seed leaves it `false`, so
   a fresh clone and the test suites can still sign in with the seeded admin.
   `seed-live/defaults.json` sets it to `true`, so a server brought up through
   the documented deploy (`db:seed` → `seed:live`) enforces it. The same
   dev/live split was used for `security.adminSessionTimeout`. An admin can
   turn it off, and that is audited like any other setting write.
4. **Enforcement forces enrolment, never a lockout.** When the setting is on and
   a STAFF user has not enrolled, the decision is `isStaffTwoFactorPending(userId)`
   in `@repo/auth` (a pure rule, `staffTwoFactorPending`, plus one primary-key
   read, and no read at all while the setting is off). Two places use it:
   - **The `(admin)` root layout** renders a standalone enrolment screen in
     place of the portal. It shows only the enrolment section and a sign-out
     button, with no sidebar that leads back to the same screen. Every admin
     page is covered, because every admin page renders under that layout.
   - **`requirePermission` / `requireAnyPermission`** throw
     `TwoFactorRequiredError`, a subclass of `ForbiddenError`, so every existing
     403 mapping handles it without change. The layout covers pages, but not
     route handlers or server actions. `auth()` was the idle timeout's placement
     (ADR-105) and would be wrong here: returning no session would also hide
     the enrolment screen.

   Enrolment itself is not blocked: it goes to Better Auth's own handler, which
   neither check guards. The read is fresh, not the rbac `Subject` cache or the
   session's user snapshot. Both can lag a completed enrolment by minutes, and
   the enrolled staff member would stay on the screen they had just completed.
5. **An admin can reset another staff member's two-factor.** Without this,
   enforcement plus a lost phone and lost backup codes would lock a staff
   member out for good. The user record's two-factor tile becomes a switch
   that can only be turned **off**, with a confirmation (code-style #7), behind
   `users.update`. `resetUserTwoFactor` (`@repo/core`) deletes the `twoFactor`
   row, clears the flag, revokes the target's sessions, and writes
   `users.twoFactorReset`. It refuses self-service (the profile is where you
   turn your own off), and it refuses a target the actor does not outrank.
   The rule is `canAssignRole`'s strict `<`, compared against the target's
   highest role, with super_admin excepted. Removing a factor weakens an
   account, which makes this the same kind of escalation as granting a role.
   Only the enrolled user can turn it on. An admin never holds a
   user's secret.

## Consequences

- With the setting on, a staff member without two-factor sees the enrolment
  screen on their next page view, and every mutation they attempt answers 403
  until they enrol. Staff who have already enrolled see no change.
- Staff need an authenticator app. A staff account signed in only through
  OAuth has no password to confirm with and cannot enrol. The screen says so,
  and an admin sets a password for them (`users.password.reset`). The seed
  creates no such staff account.
- One extra primary-key read per admin page and per mutation while the setting
  is on.
- `loadSubject` and the rbac `Subject` are unchanged, so the frozen evaluation
  order (security.md #2) is untouched. Enforcement comes after the permission
  check and adds a refusal. It never grants anything.

## Alternatives considered

- **Enforce in `auth()`**, as ADR-105 does. Rejected in §4: a missing session
  hides the enrolment screen and the sign-out button along with everything else.
- **Put `twoFactorEnabled` on the cached `Subject`.** `@repo/auth` cannot
  invalidate the `rbac:{id}` tag when Better Auth writes the flag without
  importing `@repo/rbac`, which would make a cycle. The cache would hold a
  stale `false` for up to five minutes after enrolling.
- **Always enforce, with no setting.** That would also enforce in dev, CI and the
  integration suites, where the seeded admin has no authenticator. It would also
  leave an install with no way back if the one super_admin lost their device
  before a second admin existed.
- **An admin "enable 2FA for this user".** The factor's secret would pass through
  someone other than its holder, which defeats the second factor.
