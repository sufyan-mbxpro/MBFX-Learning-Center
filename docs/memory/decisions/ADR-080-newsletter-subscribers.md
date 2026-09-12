# ADR-080: The newsletter is double opt-in, and its consent outlives the account

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 12 (public site), 11/17 (subscribers + email), 09 (admin shell)
**Supersedes:** —
**Extends:** ADR-078 (delivery), ADR-042 (what may be admin-configured)
**Superseded by:** —

## Context

`newsletter-form.tsx` has shipped hard-`disabled` since changes-03, with
"Newsletter signup is coming soon" underneath and this comment:

```
// TODO(newsletter): when a NewsletterSubscriber model + its ADR land, this
// becomes a client component posting to a server action; the markup below
// is already the target shape.
```

That was the right call — a form that validates an address and drops it on the
floor is worse than an honest placeholder — and this is the ADR it named. The
form renders in four places (footer, homepage section, `/news`, `/analysis`),
all gated by the setting `footer.newsletterEnabled`, which sits in the
`layout` group that ADR-038 paused in admin. The **flag** `newsletter` is
seeded and read by nothing.

The owner scoped this deliberately (D3): signup and subscriber administration
now, **no campaign sending**.

## Decision

1. **Double opt-in.** `subscribe()` creates a `PENDING` row and sends
   `newsletter.confirm`. Only `confirmSubscription()` makes it `ACTIVE` and
   sends `newsletter.welcome`. An unconfirmed row is purged after 7 days.
2. **Tokens are stored hashed** (SHA-256), never in plaintext — the confirm
   token expires in 48 hours and is single-use; the unsubscribe token is
   long-lived, because it has to keep working in an email sent months ago.
3. **This is the one sanctioned anonymous public mutation.** There is no
   subject, so `requirePermission()` cannot apply (security.md #1 assumes
   one). Its place is taken by a stack that must be present in full: the
   `newsletter` flag, a `@repo/contracts` schema, a honeypot field, a per-IP
   limit and a per-email limit. Any other anonymous write needs its own ADR;
   `/api/cron/*` (a shared secret, no subject) is the only existing cousin.
4. **A GET never mutates.** Mail security scanners fetch every link in a
   message, which would confirm and unsubscribe people who never clicked.
   `/newsletter/confirm` and `/newsletter/unsubscribe` render a button that
   POSTs. The sole exception is RFC 8058's one-click endpoint, which mail
   clients POST to directly; newsletter mail carries `List-Unsubscribe` and
   `List-Unsubscribe-Post` headers.
5. **The flag is the feature; the setting is the placement.** `newsletter`
   (admin-toggleable at `/admin/features`) decides whether signup exists at
   all. The four placement toggles move out of the paused `layout` group into
   the `email` group, so placement is editable again without un-pausing
   anything ADR-038 hid.
6. **Consent is independent of the account.** A subscription links to a
   `User` at confirm time when the address matches a live user — useful later
   for audience filtering and immediately for erasure requests — but the
   relation is `onDelete: SetNull`. Deleting the account must not delete a
   consent that was given separately. Today's user deletion is soft
   (`deletedAt`), so the link survives it; `SetNull` is what a hard erase
   hits.
7. **Administration is a list, not a CRM.** `/admin/newsletter` lists,
   filters, exports CSV and deletes. Export is audited and neutralises
   formula cells (`=`, `+`, `-`, `@`). Delete is a hard erase, because that is
   what an erasure request means; unsubscribe is the reversible action.
   Permissions: `newsletter.view`, `newsletter.manage`, `newsletter.export`.
8. **No campaigns** (D3). No composer, no audience builder, no bulk send.
   Bulk delivery needs the changes-12 worker (ADR-078 #11), and a brief of
   its own.

## Enforcement

- `packages/core/src/newsletter.integration.test.ts` — an identical outcome
  for new, pending and active addresses; tokens absent from the database in
  plaintext; confirm single-use and expiring; unsubscribe idempotent; CSV
  injection neutralised; a hard-deleted user leaves the subscription with a
  null `userId`.
- `apps/web/…/newsletter-action.test.ts` — the honeypot, both limits and a
  flag that is off each refuse.
- `apps/web/…/newsletter-form.test.tsx` — the form submits without JS and
  renders every state.
- `apps/web/app/loading-states.test.ts` and the public chrome guards keep
  failing on a `disabled` newsletter control, so the placeholder cannot
  return unnoticed.

## Alternatives rejected

- **Single opt-in.** Cheaper, and it lets anyone subscribe an address they do
  not own. Double opt-in is also what every sending reputation depends on.
- **Confirming on GET.** Simpler link, and scanners would confirm for the
  user.
- **Cascade-deleting subscriptions with the user.** It reads tidy and throws
  away a consent that was given independently of the account.
- **Keeping `footer.newsletterEnabled` in the `layout` group.** It would stay
  uneditable behind ADR-038's pause, which is how it became stranded.
- **Soft-deleting subscribers.** An erasure request is not satisfied by a
  `deletedAt`.

## Consequences

- A subscriber who never clicks confirm disappears after 7 days and can
  subscribe again; the form says the same thing either way, so this is
  invisible to an enumerating attacker.
- The unsubscribe token is long-lived by design, so anyone holding an old
  email can unsubscribe that address. That is the correct trade: unsubscribing
  is the safe direction, and one-click unsubscribe requires it.
- Sending to the list is not possible from the product until the worker
  lands. The admin screen says as much rather than offering a disabled
  button.
