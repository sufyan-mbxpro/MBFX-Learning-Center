# ADR-184 — Sign-up verifies by code; emails get a block vocabulary

- **Status:** Accepted
- **Date:** 2026-10-03
- **Module:** 04 (auth), 17 (email)
- **Supersedes:** nothing. Narrows ADR-079 #7: the verification LINK
  remains, but only for confirming a new address after a change (ADR-155).
  A sign-up is verified by a six-digit code.

## Context

changes-61 asked for the verification email to carry a code in a box (the
owner's reference, image-26), for a registration email, and for every
template to look more finished: bold dynamic values, a highlighted title,
coloured badges, tinted sections, and buttons where there were links.

Two facts shaped the decision.

1. Better Auth sends both kinds of verification through the ONE
   `emailVerification.sendVerificationEmail` hook. A sign-up calls it with
   the account's own address; ADR-155's change of email calls it with the
   NEW address while the row still holds the old one. The `email-otp`
   plugin's `overrideDefaultEmailVerification` replaces that hook wholesale,
   so the change-of-email mail would become a code too — and the plugin's
   `verify-email` looks the code's address up as an account, which a new
   address is not. The change-email flow would have broken silently.
2. The plugin brings more than verification: sign-in by code, password reset
   by code, change-email by code and a bare code check. Each is a way past
   the password form, its lockout (security.md #13) and its captcha
   (ADR-156) that nothing in this product needs.

The template design had its own constraint: an email body is edited in the
visual editor, which keeps only the `ed-*` marks it knows. A styled panel or
a button class written into a seeded body would be stripped by the first
unrelated Visual save, and the HTML tab is not an escape — it switches the
template to HTML mode, which sends without the branded shell.

## Decision

1. **The `email-otp` plugin, for verification only.** Registered with
   `disableSignUp`, hashed storage, ten-minute codes and five attempts. NOT
   `overrideDefaultEmailVerification`.
2. **One hook, two senders.** `sendVerificationEmail` compares the address
   it is given with the stored one (`verificationKind`, pure and tested):
   the same address gets a code through the plugin's own endpoint (so the
   one thing that checks a code also stores it), a different address keeps
   the link and `auth.verify_email`.
3. **Every other plugin door is closed** in `disabledPaths`
   (`DISABLED_EMAIL_OTP_PATHS`), and the send endpoint refuses any `type`
   but `email-verification` (`isRefusedOtpRequest`). Per-IP limits for the
   two open paths sit in `rateLimit.customRules`; a per-address limit (5 an
   hour) sits in front of the send, like the reset's.
4. **Two templates join the registry.** `auth.verify_code` (critical;
   `verify.code`, `expires.minutes`) and `auth.welcome`, the registration
   email, sent from `databaseHooks.user.create.after` for a `/sign-up/email`
   creation only — a staff-created account is not a registration.
5. **The email block vocabulary.** `ed-btn`, `ed-btn-secondary`, `ed-panel`,
   `ed-code`, `ed-eyebrow`, `ed-title` and `ed-badge-{tone}`, resolved by
   `@repo/email`'s layout against the active theme, with the ink on a filled
   ground chosen by contrast like the brand bands. No colour lives in a
   template (code-style #1 still holds). Every table renders full width,
   matching the editor, so a one-cell panel cannot shrink to its words.
6. **The editor keeps them, in email editors only.** `RichTextEditor
emailBlocks` adds a global attribute for the block classes on paragraphs,
   headings and table cells, and a badge mark. They are deliberately NOT in
   `sanitizeRichText`'s `EDITORIAL_CLASSES`: an article does not render them.
   A button is a link's own `class`, which Tiptap's Link already keeps.
7. **Upgrade only what nobody edited.** Seeding stays create-only (ADR-183),
   with one bounded exception: a stored template or design row whose body is
   EXACTLY its pre-changes-61 default takes the new design.
   `EMAIL_TEMPLATE_PREVIOUS_DEFAULTS`, `EMAIL_TEMPLATES_AR_PREVIOUS` and
   `EMAIL_DESIGN_PREVIOUS_BODIES` are those fingerprints and are never edited.
   An edited row keeps its wording; "Reset to default" applies the new one.

## Consequences

- A learner's first screen after sign-up asks for the code, with "I'll do
  this later": verification still blocks nothing (ADR-079 #7).
- The account page sends a code and takes it in place; the link-resend
  helper is gone.
- A template an admin saved before this change (live: `auth.password_reset`
  was saved on 2026-10-02) keeps its old body until someone presses "Reset
  to default".
- A future change to the defaults must add the CURRENT bodies to the
  fingerprint lists before changing them, or the upgrade path ends here.
