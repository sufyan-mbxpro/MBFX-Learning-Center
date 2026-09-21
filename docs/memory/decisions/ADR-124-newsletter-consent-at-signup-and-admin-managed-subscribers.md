# ADR-124: Newsletter consent at sign-up, hidden subscribe bands for a signed-in reader, and admin-managed subscribers

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 17 (email + newsletter), 12 (public site), 04 (`@repo/auth`), 09 (admin shell), 01 (`@repo/db`)
**Plan:** `docs/changes/changes-38-fixes.md`
**Supersedes:** —
**Extends:** ADR-080 (double opt-in, consent outlives the account), ADR-094 (one public session read), ADR-106 (a table's primary action lives in its toolbar)
**Superseded by:** —

## Context

The owner's changes-38 list, in their words:

> when user signup there should be check box of send notifications, updates,
> etc.. when user check that updates & news signup then this user should also be
> visible in the subscriber list.. after signup or signin then hide the
> subscribe page as well...

> when admin make unsubscribe then it should also redo option or make
> subscriber option.. also admin can add new subscriber from the admin..

Each of the three touches a rule an earlier ADR states, which is why they are
decisions and not edits:

- ADR-080 #1 puts every address through double opt-in. A sign-up checkbox and an
  admin-typed address are two new ways onto the list, and neither is a click on
  a confirmation link.
- ADR-094 forbids a server session read on the cached public pages, so "hide the
  subscribe band when signed in" cannot be decided where the band is rendered.
- ADR-080 #7 made Unsubscribe "the reversible action" and shipped no way to
  reverse it. Reversing it is not neutral: an admin undoing their own mistake and
  an admin overriding a reader who withdrew consent look identical in the table
  as it was.

## Decision

### 1. The ticked sign-up box is the consent; verifying the account's email is the confirmation

`/[locale]/sign-up` renders an **unchecked** checkbox ("Send me news, market
analysis and platform updates by email"). It never defaults to checked, and it is
absent, not disabled, while the `newsletter` flag is off.

When it is ticked, the form calls `optInToNewsletterAction` after Better Auth has
created the account and set its session. The action reads the session first, then
the flag, a per-account rate limit and `newsletterAccountOptInSchema` (which has
no address field), then calls `subscribeAccount({ userId, locale })`. The address
comes from the account row, so the action can only ever subscribe the caller's own
mailbox. That is also why it is not an anonymous mutation and does not need
ADR-080 #3's five-part stack: there is a subject. `requirePermission()` does not
fit a learner, who holds no keys, and the session is the boundary, as it is for
`/api/learn/progress`.

What the row looks like depends on the proof on file:

- **Account not yet verified (every fresh sign-up):** a PENDING row, `source:
"signup"`, **no confirmation email and no confirm token**. Better Auth is already
  sending the verification email, and it proves exactly what ADR-080's
  confirmation proves: the reader holds the mailbox. A second "confirm your
  subscription" email a minute later would ask for the same proof twice.
- **Account already verified:** ACTIVE at once, linked to the account, welcome
  sent.

The row becomes ACTIVE when the account's email is verified. `@repo/auth` may not
import `@repo/core` (ADR-078), so auth publishes the event through a small keyed
listener seam (`onEmailVerified` / `notifyEmailVerified`, run from
`afterEmailVerification`), and the app subscribes
`activateAccountSubscription` in `app/api/auth/[...all]/route.ts`, the module
that mounts the handler the verification link reaches. A listener that throws is
logged and swallowed, because verification has already happened. Only
`source: "signup"` rows move. A PENDING row from a public form still needs its
own confirmation click.

**The account link is made at activation, not at sign-up.** That keeps ADR-080
#6's rule, "link when the address is known to belong to the account", and an
unverified account has not shown that yet.

The ADR-080 #1 rule against a membership oracle still holds: the action returns
`"ok"` or `"failed"`, and the form shows nothing about the subscription either
way.

### 2. Resubscribe undoes an admin's unsubscribe; it only invites a reader who unsubscribed themselves

The column `NewsletterSubscriber.unsubscribedVia` (`"subscriber"` | `"admin"`,
nullable, migration `20260916220000_newsletter_unsubscribed_via_adr124`) records
who stopped the mail. `unsubscribe()` writes `subscriber` and `adminUnsubscribe()`
writes `admin`. Rows unsubscribed before the column existed are null and are
treated as the reader's own, which is the safe direction.

`adminResubscribe` (the row action on an UNSUBSCRIBED row, replacing the disabled
Unsubscribe item there):

- `unsubscribedVia === "admin"` **and** the row had been confirmed → **restored**
  straight to ACTIVE. The consent and the mailbox proof are both on record, and
  the admin is reversing their own action. It is not confirmed: code-style #7 says
  restore is the undo.
- Anything else → **invited**: PENDING with a fresh confirmation email. An
  administrator cannot put a reader who withdrew back on the list. Only the
  reader's own click can.

A restore **keeps the unsubscribe token**, so the unsubscribe link in every email
the reader already has keeps working. An invitation rotates the token at confirm
time, like every confirmation does. `userId` is never touched, so a link that a
hard erase nulled stays null.

### 3. Subscribe bands are hidden for a signed-in reader, before first paint

The five subscribe placements are the footer band, the home `newsletter` band,
the subscribe half of the home `connect` band, `/news` and `/analysis`. Each
carries `SIGNED_OUT_ONLY_CLASS` (`in-data-[session=learner]:hidden`). The server
HTML is unchanged, so the pages stay cached.

`PublicSessionProvider` stays the one session read. When it resolves, it sets or
removes `data-session="learner"` on `<html>` and stores the same answer in
localStorage (`mbx:session`). A pre-paint script (`SessionHintScript`, injected
through `useServerInsertedHTML` like ThemeScript, code-style #20) copies the
stored hint to the attribute before first paint. The sign-in and sign-up forms set
the hint on success, and `signOut()` clears it, so the page a reader lands on is
right at first paint. The result is that a returning signed-in reader never sees a
band appear and then collapse.

The rule is **any signed-in learner**, not "signed in and subscribed". That is
what the owner asked for, and "subscribed" is not in the session. Knowing it would
mean a second per-reader read on every public page, which is what ADR-094 exists
to prevent. A STAFF session still reads as anonymous (ADR-094 #2) and still sees
the bands.

This is display only. Nothing the server trusts depends on the hint.

### 4. Add subscriber invites, it does not add

"Add subscriber" is a primary Button in the DataTable toolbar's `actions` slot
(ADR-106). It is shown only with `newsletter.manage`. It opens a dialog with a
`DialogTitle` and `DialogDescription`, an email `Field` and a locale
`AdminCombobox` `Field`, validated inline against `adminAddSubscriberSchema`
(ADR-077).

The address is created **PENDING, `source: "admin"`**, and receives the same
confirmation email the public form sends. An administrator typing an address is
exactly "someone subscribing a mailbox they do not own", which is the case ADR-080
rejected single opt-in for. The admin's word is not the reader's consent, and a
sending reputation does not care who typed the address. Outcomes:

- `invited`
- `already_active`, which the screen says, because the caller can already read
  the whole list
- `restored`: an UNSUBSCRIBED address goes through §2's rule, so Add cannot be
  used to get around it

A repeat inside the 10-minute cooldown sends nothing more. The cooldown applies
only while an unexpired confirmation is still outstanding. A consumed or expired
token is no reason to hold back a new email, and holding back would leave the row
PENDING with no link that could ever confirm it.

Both admin mutations run `requirePermission("newsletter.manage")` first, parse
through `@repo/contracts`, call a `@repo/core` service and write an audit row
(`newsletter.resubscribe`, `newsletter.add`).

### 5. Placements and sources are two lists

`NEWSLETTER_PLACEMENTS` (footer, home, news, analysis) is what the anonymous form
may claim, and what `isNewsletterPlacementEnabled` takes. `NEWSLETTER_SOURCES` adds
`signup` and `admin` and is what the admin filter lists. A tampered public form
cannot plant a row that looks like an admin invitation.

## Enforcement

- `packages/core/src/newsletter-consent.integration.test.ts` (real MariaDB):
  - sign-up rows wait PENDING without an email, and verification activates, links
    and welcomes exactly once
  - a form row is not activated by verification
  - an admin's unsubscribe is restored and the old unsubscribe link still works
  - a self-unsubscribed reader is only invited, including when the admin uses Add
  - a pre-column row is treated as self-unsubscribed
  - a hard-erased link stays null
  - Add invites, is audited, respects the cooldown and reports `already_active`
- `packages/contracts/src/newsletter.test.ts`:
  - the public form refuses `signup` and `admin`
  - the opt-in schema strips any address or user id
  - the add schema normalises and refuses bad input
- `packages/auth/src/email-verified.test.ts`: listeners run, a key re-registered
  replaces its listener, and a throwing listener is contained.
- `apps/web/app/newsletter-consent.test.ts`:
  - the checkbox is never pre-ticked, and runs only after sign-up
  - the action reads the session before anything else and names no address
  - every placement carries the class, and no placement renders from
    `usePublicSession`
  - the layout injects the hint and the provider maintains it
  - both admin actions check the permission before parsing
  - Resubscribe has no ConfirmDialog, and Add lives in the toolbar with a full
    dialog header

## Consequences

- A reader who ticks the box but never verifies their account is never
  subscribed, and the row is purged with every other PENDING row after 7 days.
  Verifying later does nothing unless they tick again. That is the correct
  direction: no proof, no mail.
- A signed-in learner who did not tick the box has no subscribe form anywhere on
  the site. The account/profile page is the natural home for a toggle, and
  `subscribeAccount` already handles a verified account (ACTIVE at once) for when
  that toggle lands.
- A signed-in reader whose session expired sees the bands appear once their
  session read resolves: hidden at first paint because of the stale hint, then
  shown. Showing content late is the safe way to be wrong.
- A reader who unsubscribed themselves and is re-invited by an admin receives one
  confirmation email. That is the least an admin's "redo" can do without
  overriding the reader, and the reader decides.
- `/api/auth/[...all]` now imports `@repo/core` to register the listener. That
  adds weight to the auth route only, not the session path in other routes.

## Alternatives rejected

- **A second confirmation email at sign-up.** It is literal ADR-080, and it
  sends two "click to confirm" emails in the same minute for one proof.
- **Creating the sign-up row ACTIVE immediately.** Better Auth does not require
  verification to sign in, so anyone could create an account with somebody
  else's address and put that address on the list.
- **Admin-added addresses created ACTIVE ("the admin attests consent").** An
  attestation that cannot be checked is single opt-in with extra steps.
- **Resubscribe always restoring to ACTIVE.** It turns a reader's unsubscribe
  into a request an administrator can overrule.
- **Hiding the bands from `usePublicSession()` after the fetch.** The band would
  paint and then collapse on every page for every signed-in reader, and the
  footer sits outside the provider.
- **A server session read to omit the bands.** It is the uncached `auth()` on
  every cached public page that ADR-094 exists to prevent.
- **Hiding only for signed-in AND subscribed readers.** It needs a per-reader
  subscription read on every public page, for a distinction the owner did not
  ask for.
