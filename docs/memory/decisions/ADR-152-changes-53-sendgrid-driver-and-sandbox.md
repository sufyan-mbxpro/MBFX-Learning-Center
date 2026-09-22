# ADR-152 — SendGrid is a driver of its own, with a sandbox mode

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 17 (email)
- **Plan:** owner request, 2026-09-22: "add sandbox test mode to test the
  email" — SendGrid's `mail_settings.sandbox_mode`, which validates a send
  and returns success without delivering it
- **Amends:** changes-49's "SendGrid as a provider, not a driver" (the
  transport form stored SendGrid as an SMTP row) and ADR-078 #2's list of
  transport implementations
- **Does not change:** the sealed-secret rules (security.md #10, ADR-078 #3),
  who may edit the transport (`email.settings.manage`, ADR-078 #4), or the
  delivery pipeline in `sendTemplatedEmail`

## Context

changes-49 added SendGrid by filling SendGrid's SMTP host, port and the
literal username `apikey` into an ordinary SMTP row. That was enough to send.
It cannot sandbox: `sandbox_mode` is a field of the v3 Mail Send JSON body,
and SendGrid honours it on no SMTP path.

## Decision

1. **`EmailDriver` gains `SENDGRID`.** `sendgridDriver` in `@repo/email`
   POSTs to `https://api.sendgrid.com/v3/mail/send` with plain `fetch` (one
   request does not earn an SDK). `verify()` reads `/v3/scopes` and fails
   unless the key holds `mail.send`, so "Test connection" catches a key that
   authenticates but cannot send, and sends nothing itself.
2. **The API key stays in `passwordCipher`.** It was already stored there
   under changes-49, and it is the same key. This adds no fourth sealed
   secret, and `loadTransportDriver()` is still its only reader.
3. **`EmailTransport.sandboxMode`** (default `false`) is sent as
   `mail_settings.sandbox_mode.enable`. The switch appears only for SendGrid.
   SMTP has no equivalent, so there the switch is absent, not disabled.
4. **A sandboxed send is a SENT row with a reason.** The driver returns
   `sandbox: true`, and the delivery log records `SANDBOX_REASON`. Without it,
   a message that reached no inbox would look the same as one that did. No
   new `EmailDeliveryStatus` was added: SendGrid did accept the send.
5. **While sandbox mode is saved on, the Delivery tab shows a warning.** That
   includes the read-only summary, because sandbox mode also discards
   password-reset mail.
6. **Migration `20260922150000_sendgrid_sandbox_changes53`** moves only rows
   that exactly match the changes-49 shape (`SMTP`, `smtp.sendgrid.net`,
   `apikey`) to `SENDGRID`, and clears their last-verified state. Any other
   SMTP row is left alone.

## Consequences

- SendGrid mail now goes over HTTPS rather than SMTP on port 587.
- A missing key on a `SENDGRID` row falls back to the log driver, the same
  way a half-filled SMTP row does.
- `saveEmailTransport` resets `sandboxMode` to `false` on any save that omits
  it (the seed-live SMTP path). Sandbox mode is only ever turned on on purpose.
