# ADR-131: The support inbox is the General setting, and a missing template restores itself

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 12 (public site), 05 (settings), 17 (email)
**Plan:** owner request, 2026-09-17
**Supersedes:** ADR-113 §2's choice of `SUPPORT_CONTACT.email` in the facts file as the one address. ADR-113 §2's _rule_ stands: the Email Support card and the form share one address, so the page cannot show one inbox and mail another.
**Superseded by:** —

## Context

The owner saved **Support email** in Settings → General, sent a message
through `/support`, and it did not arrive there. The delivery log showed why.
The message had gone to `support@mbfx.co`, the address hard-coded in
`support/_content/support-facts.ts`. `site.supportEmail` had been seeded,
typed and editable since Module 05, and nothing read it. That is the failure
code-style.md #28 describes: an admin saves, sees "Saved", and nothing
changes.

The same request asked for three more things:

- a clear, coloured confirmation, because the success message was a grey line
  under the Send button;
- the email filled in automatically;
- the template added when it is missing. When a key is added to the registry
  after a database was seeded, its send was a FAILED row that said "run the
  seed", and the visitor was still told the message had gone.

## Decision

1. **`site.supportEmail` is the support inbox.** The action reads it as its
   first guard (ADR-113 §4 part 1). The page and the footer read the same
   setting, for the Email Support card and the footer's email line. The facts
   file keeps the phone and WhatsApp numbers only.
2. **`site.supportEmail` is public.** The page prints it, so a flag saying
   otherwise would be false, and security.md #12 is about serialising values
   a page does not mean to show. The seed row flips, and migration
   `20260917200000_support_email_public_adr131` flips existing databases. The
   migration changes the flag only, never the value.
3. **Still not an open relay.** The destination is a setting only STAFF can
   edit. No submitted value reaches `to`, and the guard test still checks for
   that.
4. **"Send Email" opens a compose window that is addressed and has a
   subject** (`mailto:…?subject=`, from the catalog key
   `support.channels.email.mailSubject`).
5. **The form fills in a signed-in learner's name and email** from the one
   public session read (ADR-094). This is display only, and the fields stay
   editable.
6. **Success is a panel in the success tone** that replaces the form. It moves
   focus to itself and offers "Send another message". A refusal renders in
   the destructive `Alert`, and the action hands back what the visitor typed,
   because React resets the form after the action settles.
7. **`sendTemplatedEmail` restores a missing template from its code
   default.** It does this when the row or its `en` content is absent, and it
   is create-only in the same way the seed is. An admin's edited content is
   never overwritten, and a template an admin switched off stays off.
8. WhatsApp links use digits only (`wa.me/447…`), which is the documented
   form.

## Consequences

- Changing where support mail goes is an admin action, not a deploy.
- A template key added in code works on an old database without a re-seed.
  The "no template row" FAILED branch stays for a key with no default, which
  `check:email-templates` makes unreachable.
- Actual delivery still depends on the transport in Admin → Email. With the
  LOG driver, the message is written to the server console and logged as
  SENT.
