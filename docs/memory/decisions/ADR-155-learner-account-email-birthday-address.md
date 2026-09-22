# ADR-155 — The learner account page changes its email and holds a birthday and an address

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 04 (auth), 10 (users), 12 (public site), 17 (email)
- **Plan:** owner request, 2026-09-22: "improve the design of this section…
  colorful headers, status badges, icons… can change the email… add
  birthday, address"
- **Amends:** ADR-123 #4 (what the profile form saves) and ADR-125 §1 (the
  page's bands)
- **Does not change:** how password or two-factor are changed, the session
  gate on `/account`, or the staff profile at `/keystone/profile`

## Context

`/account` let a learner edit a display name, first and last name, phone and
picture. The address it showed could not be changed at all. It was the address
a learner signed up with, and the only way to move it was to ask staff. The
owner also wants a date of birth and a postal address on the account.

Better Auth 1.7.2 ships a `/change-email` endpoint, off by default
(`user.changeEmail.enabled`). With neither `sendChangeEmailConfirmation` nor
`updateEmailWithoutVerification` configured, it sends a verification link to
the NEW address. The row changes only when that link is opened
(`requestType: "change-email-verification"` in `/verify-email`). An address
that already belongs to another account gets the same `200` and no mail, so
the form is not an enumeration oracle. The endpoint also requires a fresh
session.

## Decision

1. **Email change is Better Auth's own endpoint, called from the browser**,
   the way `account-security.ts` already calls change-password and
   two-factor. A server action would not deliver the rotated cookie that
   `/verify-email` sets. Proof of the new mailbox is the whole check, and
   there is no password prompt. Someone holding a session could already
   change the password.
2. **The old address is told, after the fact.** A new template,
   `auth.email_changed` (`audience: "any"`, not critical), goes to the
   PREVIOUS address once the change lands. It names the new address, so an
   owner whose account was taken over sees where it went. The hook reads the
   old address from the `/verify-email` token's payload, which Better Auth
   has already verified by the time the row is written. The same hook writes
   the `users.emailChange` audit row (security.md #5).
3. **Learners only, and rate-limited twice.** A `hooks.before` on
   `/change-email` refuses a STAFF session, because staff edit themselves at
   `/keystone/profile` (ADR-123's reasoning for the actions). It also
   applies a per-account limit of 5 an hour on top of the per-IP custom rule.
   Every request sends mail to an address the requester chose, which is the
   mail-bomb shape security.md #13 names.
4. **Birthday and address are columns on `User`**: `birthDate` (`DATE`),
   `addressLine1`, `addressLine2`, `city`, `region`, `postalCode` and
   `country` (ISO 3166-1 alpha-2). This follows the precedent of
   `firstName`/`phone`. They are deliberately NOT Better Auth
   `additionalFields`. The library never reads them, so they never enter the
   session cookie cache or `/get-session`, and `/update-user` cannot write
   them. A country is a code, and its NAME comes from `Intl.DisplayNames`
   in the reader's locale, so no catalog carries 249 country names.
5. **Two forms, two actions.** Details (name, phone, birthday) and address
   save separately, with `learnerProfileSchema` and `learnerAddressSchema`.
   A reader who fixes a typo in their postcode should not also submit a
   half-edited name. Both actions follow ADR-123: the session is read first,
   STAFF is refused, and no input can name a user.
   `learnerProfileSchema` now EXTENDS the staff schema instead of being it,
   so the two still share every rule about a name.
6. **The birthday is a date, not a timestamp.** It is stored as `@db.Date`,
   exchanged as `YYYY-MM-DD`, and never before 1900 or after today. No
   minimum age is enforced. That is a policy question, and the form is not
   the place to answer it.

## Consequences

- `/account` gains an Email card with a change form. The masthead shows
  status badges and a profile-completeness meter
  (`profileCompleteness()`, pure, in `@repo/contracts`), and every card gets
  a tinted, icon-led header.
- The admin user page's "Edit details" dialog still does not edit these
  columns. Its comment about "a field that saves nowhere" is now out of
  date for address, and bringing the dialog up to date is a separate change.
- Migration `20260922160000_learner_birthday_address_adr155` adds seven
  nullable columns.
- `check:email-templates` gains one template, and the seed writes its
  default.
