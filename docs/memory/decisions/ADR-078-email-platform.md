# ADR-078: Transactional email is a platform — `@repo/email`, a sealed transport, templates as data

**Status:** Accepted
**Date:** 2026-09-12
**Module:** new **17** (`@repo/email` + newsletter), touching 04 (auth),
05 (settings), 09 (admin shell), 01 (db)
**Supersedes:** —
**Extends:** ADR-043 (what is translated), ADR-042 (composition is code,
content is data)
**Superseded by:** —

## Context

`packages/auth/src/index.ts:55` has carried this since Module 04:

```ts
function logEmail(kind: string, to: string, url: string) {
  console.log(`[auth email — ${kind}] to=${to} url=${url}`);
}
```

Both `sendResetPassword` and `sendVerificationEmail` call it. Better Auth
1.7.2 already mints, stores and expires the tokens; nothing delivers them.
The DEVLOG has recorded this as open since 2026-09-07, and `plan.md` assigns
no email provider to any module.

The changes-21 feature brief (owner, 2026-09-12) asks for the whole surface at
once: configurable email, templates edited in the rich text editor with sender
identity and dynamic variables, a raw-HTML option, a per-template test send,
and a per-template on/off switch.

Two facts shaped the answer before any design did:

- **Two different layers have to send.** `@repo/auth` sends the reset and
  verification mail; `@repo/core` sends the admin-initiated reset notice and,
  later, the newsletter. `core` sits well above `auth` — it pulls in `rbac`,
  `settings`, `theme`, `i18n`, `blocks` and `sanitize-html` — and `auth` is on
  the session path every request touches. Neither can own email without the
  other importing it.
- **Secrets are env-only** (security.md #10), but the owner asked for
  admin-editable SMTP so a provider can be changed without a redeploy.

## Decision

1. **Email is its own package, `@repo/email`, BELOW both senders.** It owns
   its own tables, the way `@repo/settings` and `@repo/theme` already own
   theirs. The graph gains `auth → email` and `core → email`; `email` depends
   on `db / contracts / settings / theme` and never on an app, on `core`, or
   on `auth`.

   A package two layers both need cannot live in either of them. Putting
   email in `core` would mean `auth → core`, dragging `rbac`, `settings`,
   `theme`, `i18n`, `blocks` and `sanitize-html` onto the session path that
   the proxy and every server component already touch. Putting it in `auth`
   would make the newsletter import the authentication package.

2. **The transport is a seam, not a provider.**
   `EmailTransportDriver { send(); verify() }` has two implementations:
   `smtpDriver` (nodemailer) and `logDriver`, which keeps today's console line
   and is what runs until SMTP is configured. A provider API driver, or the
   changes-12 worker, replaces the implementation and nothing else.
3. **One sealed secret, and it is the narrowest possible exception to
   security.md #10.** `EmailTransport.passwordCipher` holds the SMTP password
   AES-256-GCM-sealed under `EMAIL_SECRET_KEY`, an env var. The seal is
   `v1:<iv>:<tag>:<ciphertext>`, so rotation is a version bump. The field is
   write-only in the UI, `loadTransportDriver()` is the only code that selects
   it, and `EmailTransportView` has no password property at all — a leak has
   to get past the type, not just past a reviewer. **The key stays in env.**
   Nothing else in this repo may store a secret in the database without its
   own ADR.
4. **Editing the transport is super_admin-only.** The password is write-only,
   but the **host is not**, and that is the escalation path: an admin who can
   repoint delivery captures the next password-reset link for anyone,
   including a super_admin, walking straight around `canAssignRole`'s strict
   `<`. `email.settings.manage` therefore joins `roles.manage`,
   `permissions.assign` and `users.impersonate` in the `admin` role's
   exclusion list. Template editing, test sends and the delivery log stay with
   `admin`, so the settings screen splits by permission rather than hiding
   whole.
5. **The template set is code; its content is data.** `EMAIL_TEMPLATES` in
   `@repo/contracts` declares each key, its audience, whether it is critical,
   and the variables it may use. `EmailTemplate` + `EmailTemplateTranslation`
   hold subject, preheader, body, mode and sender overrides. An admin cannot
   mint a key, because code decides _when_ an email is sent — the ADR-042
   split, applied to email.
6. **Variables are `{{dotted.path}}` and carry no logic.** No loops, no
   conditionals, no Handlebars. Every value is HTML-escaped at substitution;
   a URL-typed variable must parse as `http(s)` or the render throws; an
   unknown variable fails the save, in the same `@repo/contracts` schema the
   server action parses with (ADR-077's rule, applied here).
7. **Two authoring modes.** `RICH` composes the body into the shared
   table-based layout, mapping the editor's `ed-*` classes to inline styles,
   because email clients drop class CSS. `HTML` takes a full document as the
   designer wrote it. Both are sanitised **on save** (security.md #8) and
   again on render, through an email allowlist that permits table layout and
   inline styles and refuses script, iframe, form and every `on*` handler.
8. **Preview is isolated, not trusted.** The rendered HTML is served by one
   route under its own `Content-Security-Policy: sandbox` and framed in a
   `sandbox=""` iframe. It is deliberately not `srcDoc`, which would inherit
   the admin surface's nonce CSP and break exactly the `<style>` blocks the
   HTML mode allows.
9. **Two switches, at two levels.** `email.enabled` is the global kill
   switch; `EmailTemplate.isActive` is per template. A suppressed send writes
   a `SUPPRESSED` row and never reaches a transport. A **test send ignores
   `isActive`** — you must be able to test a template before switching it on —
   but never ignores the global switch. Switching off a **critical** template
   (password reset, verification) goes through `ConfirmDialog` stating what
   breaks; it is not forbidden.
10. **The delivery log records the attempt, never the message.**
    `EmailDelivery` holds template, recipient, locale, subject, status, reason
    and a provider id. It holds **no body and no variables**, because a reset
    link in a table an admin can read is a second interception path. Rows are
    purged after **90 days** — the addresses are PII, and support
    conversations about a missing email are same-week.
11. **No queue.** Sending happens after the response, through `after()` and
    Better Auth's `advanced.backgroundTasks`. This also removes the timing
    side channel from anti-enumeration (ADR-079). A failure is a `FAILED` row,
    not a retry. Campaign sending waits for the changes-12 worker.
12. **Locale follows ADR-043 exactly.** Public-audience templates are
    translated per active locale, falling back to the default locale and
    showing a "missing" badge in admin. Staff-audience templates are English
    only.

## Enforcement

- `packages/email/src/secret.test.ts` — round-trip, tamper detection, and no
  plaintext fallback when the key is absent.
- `packages/email/src/send.integration.test.ts` — a real send against a
  Mailpit container; suppression by both switches; the assertion that a reset
  token never appears in the delivery row.
- `packages/email/src/sanitize.test.ts` — an XSS corpus plus a fast-check
  property that no output holds `<script` or an `on*=` attribute.
- `packages/email/src/render.test.ts` — escaping, `javascript:` refused
  through a variable, CR/LF stripped from the subject.
- `packages/core/src/email-admin.integration.test.ts` — the transport view
  never carries the password, at runtime and at the type level.
- `apps/web/…/email-actions.test.ts` and `seed-roles.test.ts` — an
  `admin`-level subject can neither save nor test the transport, and no role
  but `super_admin` holds the key.
- `email-registry.test.ts` — registry, seed rows and samples agree.

## Alternatives rejected

- **Email inside `@repo/core`.** It would force `auth → core`: an edge that
  does not exist today, inverting the layering and pulling core's whole
  dependency graph onto the session path. (An earlier draft of this ADR
  claimed core already imported auth, making the edge a cycle. It does not —
  the only mention is a comment. The conclusion survives the correction; the
  reason is layering and weight, not a cycle.)
- **Env-only SMTP credentials.** The safer default, and the owner declined it
  (D1): changing provider would need a redeploy. The exception is narrowed to
  one field, one reader and one role instead.
- **A template language with logic (Handlebars, Liquid) or a component
  renderer (react-email, MJML).** Each adds a dependency and lets template
  authors write behaviour. The five templates need substitution, nothing more.
- **Storing rendered bodies so a failed send can be retried.** That is the
  reset link sitting in the database again. Retry belongs to the worker, which
  will re-render from the template.
- **A queue now (BullMQ on the existing Redis).** changes-12 plans it, no code
  exists, and auth email is time-sensitive enough that a sweep minutes later
  adds little. The driver seam is the join point.

## Consequences

- **Losing `EMAIL_SECRET_KEY` means re-entering the SMTP password.** That is
  the design; the screen says so, and an unreadable seal surfaces as a
  configuration error rather than a silent send failure.
- **A transient SMTP failure is not retried.** It is a `FAILED` row an admin
  can see and act on. This is the one timing risk this ADR accepts.
- **The delivery log cannot answer "what did the email say".** It answers
  "was it sent, to whom, and why not". Reproducing a body means rendering the
  template's preview.
- **`@repo/email` touches the database**, so "core is the only code that
  touches db" (CLAUDE.md) now reads as it always did in practice: a domain
  package owns its own tables, and `settings` and `theme` are the precedent.
