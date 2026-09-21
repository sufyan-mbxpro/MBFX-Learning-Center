# ADR-142 — changes-45: no blue status tokens, staff impersonation, and the person record page

- **Status:** Accepted
- **Date:** 2026-09-19
- **Module:** 02 (`@repo/theme`), 04 (`@repo/auth`), 09 (admin shell), 10 (users, employees), 12 (public site), 17 (newsletter)
- **Plan:** owner request, `docs/changes/changes-45-fixing.md`
- **Supersedes:** ADR-072 §3 **for the `success` and `info` default values only**.
  `error` keeps its value and its reasoning.
- **Amends:** ADR-123 (the header account menu no longer carries the verify
  nudge) and ADR-140 §3 (its static-heading rule no longer covers the three
  person records).
- **Builds on:** plan.md Module 04 ("admin plugin … impersonate — gated behind
  `users.impersonate`"), which named impersonation and never built it.

## Context

The owner sent eleven notes. Four of them change a rule.

1. "Do not use blue color anywhere; use the site's default colours." The
   blue was not a stray class. `DEFAULT_BRAND.success` was `#2D72C7` and
   `DEFAULT_BRAND.info` was `#004284` (ADR-072 §3 picked AA-safe siblings of
   the changes-20 reference's blue). So every "Published" badge, every
   confirmation box and every tip on both surfaces used a colour the site's
   palette does not otherwise contain.
2. "Email verify: remove it from the dropdown; show it only on the profile
   page." ADR-123 had put the verify nudge in the header account menu,
   because it was then the only place verification was ever asked for. The
   profile page has had its own verification panel since ADR-125.
3. The owner's reference user page (image-102/103) has a "Login as User"
   button. Better Auth's admin plugin is installed and has an impersonation
   endpoint. That endpoint authorises against the plugin's own `user.role`
   string, which nothing in this project writes, because permissions live in
   `@repo/rbac` (ADR-001). So it refuses everyone. Making it work would mean
   granting that role, and the role opens every other `/admin/*` Better Auth
   endpoint along with it.
4. The same reference puts the person's NAME in the page heading, with the
   id and address underneath. ADR-140 §3 had made every `[id]` page's
   heading a static catalog string, because on an EDITOR the record's title
   is the first field, and repeating it as the h1 pushed the actions onto a
   second row.

## Decision

### 1. `success` and `info` leave blue

- `success` is `#936B44`. That is the brand bronze darkened until white
  clears 4.5:1, the same value `--primary-solid` derives. The owner's
  reference marks ACTIVE / APPROVED / Verified in exactly that fill.
- `info` is `#5A524B`, a warm graphite from the neutral ramp. It matches the
  reference's charcoal status chip.
- Both are defaults. An admin can still set any colour in the theme editor.
- `20260919120000_no_blue_status_tokens_changes45` moves an existing
  install. It is bounded per key to a row that still holds the old seeded
  value, so a colour an admin chose is kept.
- `warning` stays amber, and `error` stays red. Status is still never carried
  by colour alone: every badge prints its word.

### 2. The verify nudge lives on the profile page only

- The header account menu holds the profile page, the progress page and
  sign-out. Nothing else.
- The unverified dot on the avatar is gone with it.
- `EmailVerificationPanel` on `/account` is where a learner sees the state of
  their address and asks for the link again. It sends through the same
  rate-limited `resendVerification` helper as before.
- Verification still blocks nothing (ADR-079 #7).

### 3. Staff impersonation: the plugin's mechanism, our door

`@repo/auth`'s `staffImpersonation` plugin adds two endpoints.

- **Start (`/staff-impersonation/start`) is `SERVER_ONLY`.** better-call's
  router skips such an endpoint, so it has no HTTP route at all. Its only
  caller is `impersonateLearner()`, and the only caller of that is
  `impersonateUserAction`. That action runs
  `requirePermission("users.impersonate")` first (security.md #1). It then
  runs `recordImpersonationStart`, which re-checks the target and writes the
  start audit row before any cookie moves (security.md #5).
- **Only a live learner can be entered.** The endpoint checks this on its own
  fresh read of the row, as well as in the service. A STAFF account can never
  be entered by any caller, because that would be privilege escalation, not
  support work. A suspended or soft-deleted learner is refused too.
- **The cookies are Better Auth's own format.** The staff session token is
  parked in the signed `admin_session` cookie, exactly as the plugin parks
  it. The learner's session is a real database row carrying
  `impersonatedBy`. It is revocable, it lasts at most one hour
  (`IMPERSONATION_SESSION_SECONDS`), and its cookie is not remembered past
  the browser session.
- **The `/admin` gate refuses the impersonated session.** It is a LEARNER
  session, so there is no way to act as staff while inside it.
- **Stop (`/staff-impersonation/stop`) is an ordinary POST**, because the
  public-side banner has to call it. It does these things, in this order:
  1. deletes the learner session;
  2. writes the stop audit row;
  3. restores the parked staff session;
  4. clears the parked cookie.

  If the staff session cannot be restored, it still ends the impersonation
  and signs the browser out.
- **The plugin's own pair is disabled.** `disabledPaths` switches off
  `/admin/impersonate-user` and `/admin/stop-impersonating`, so there is no
  second, unaudited door.
- **The public site says it is happening.** While `impersonatedBy` is set,
  `ImpersonationBanner` draws a strip above the header naming the learner.
  It has a one-press "Return to admin" button.
- **No re-authentication step.** The plan asked for re-auth on impersonation
  start. This change does not add one: the staff session is already
  idle-limited (ADR-105), and the confirmation dialog plus the audit row are
  the controls. A re-auth prompt remains open for Module 14.

### 4. The person record page

- `/admin/users/[id]`, `/admin/newsletter/[id]` (new) and
  `/admin/employees/[id]` share one shape, built from
  `_components/record-page.tsx`:
  - the person or address as the heading, with the id underneath;
  - a row of four figures;
  - for users only, an "Account controls" grid;
  - tabs.
- The user record's tabs:
  - Details;
  - Courses, Lessons, Quizzes and Reading (learners only; progress per
    module, from the same `loadLearnerActivity` read `/account/progress`
    uses);
  - Roles & access;
  - Devices (active sessions, with "Sign out everywhere");
  - Activity (the account's audit trail).
- ADR-140 §3's static-heading rule is scoped to editors. These three pages
  are not editors: they have no title field for the heading to repeat. The
  guard in `admin-page-conventions.test.ts` names exactly these three pages
  as the exception.
- **"Edit details" writes only columns the User row has:** first name, last
  name, phone, status and email-verified. The reference's address, city and
  KYC fields describe a brokerage account. A field that saves nowhere is
  code-style #28's bug.
- **A status change goes through `setUserStatus`**, so the last-super_admin
  guard and the session revocation are not re-implemented.
- **The subscriber record shows the consent, not a person.** The linked
  account is a link to that account's own record, and it is shown only to a
  viewer who holds `users.view`. The "Emails sent" tab reads the delivery
  log, so it needs `email.log.view`. Without that key the tab is absent and
  the query never runs.

### 5. The staff sign-in screen is a centred card

- `/admin/sign-in` and the two staff recovery screens drop the public split
  frame for the owner's reference: one card on a quiet ground. It holds the
  logo, "Admin Portal", the form, and a "Go to User Login" link.
- The public credential screens keep the split frame.
- The link points from the staff screen to the public one. ADR-052 forbids
  only the opposite direction.
- The `(admin-auth)` root layout now sets the uploaded favicon, as the other
  two root layouts do.

## Consequences

- The theme's CSS snapshot changed, and the migration must run on every
  install. A running dev server caches the theme for an hour, so restart it
  to see the new colours.
- A support admin can now see a learner's site exactly as the learner does.
  The audit log records who did it and when, at start and at stop.
- The anonymous Sign in / Join us pair is hidden below `xl` whenever the
  mobile menu exists. That menu has carried both since changes-43. The
  signed-in avatar still shows at every width.

## Not done

- A re-authentication prompt before impersonation (see §3).
- An admin audit-log screen. The Activity tab shows the latest 20 rows about
  one account.
- E2E for impersonation and the record pages. They are owed to Module 14
  with every other admin spec, which are `fixme` for the auth-setup reason.
