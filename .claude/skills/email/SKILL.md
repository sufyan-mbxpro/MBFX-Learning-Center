# SKILL — Module 17: `@repo/email` + newsletter

ADR-078 (platform), ADR-079 (password recovery), ADR-080 (newsletter).
Plan: `docs/changes/changes-21-feature-plan.md` (PRs F0–F9).

## The shape

```
packages/email/src/
├── secret.ts      # sealSecret / openSecret — AES-256-GCM under EMAIL_SECRET_KEY
├── transport.ts   # EmailTransportDriver seam: smtpDriver | logDriver
├── render.ts      # {{var}} substitution, escaping, text alternative
├── layout.ts      # the table-based shell; ed-* classes → inline styles
├── sanitize.ts    # the email allowlist (save AND render)
├── send.ts        # sendTemplatedEmail(): switches → render → send → log
└── testing.ts     # memoryDriver(), not exported from "."

packages/db/src/email-template-defaults.ts   # the starting CONTENT (seed + reset)
packages/core/src/email-admin.ts             # the ADMIN's door: transport, templates, log
apps/web/app/(admin)/admin/settings/email/   # the four screens
apps/web/app/(admin)/admin/api/email/preview # the isolated preview route
```

`auth → email` and `core → email` — email sits BELOW both senders, because
both layers send. It never imports an app, `@repo/core`, or `@repo/auth`.
The ADMIN read/write services live in `@repo/core` like every other admin
service; `@repo/email` stays the sending layer.

## Invariants

1. **The sealed password has one reader.** `loadTransportDriver()` selects
   `passwordCipher`; `EmailTransportView` has no password property. Adding a
   second reader is a schema-level mistake, not a style one.
2. **`email.settings.manage` is super_admin-only** — the host is the
   escalation path (ADR-078 #4). Templates, tests and the log are `admin`.
3. **The registry decides what exists.** A new email = an `EMAIL_TEMPLATES`
   entry in `@repo/contracts` + a seed row + a sample + a test.
   `email-registry.test.ts` names any half you forget.
4. **Variables are escaped; URL variables are validated.** Substitution runs
   _after_ sanitising, so a `javascript:` URL cannot arrive through a value.
   The subject has CR/LF stripped (header injection).
5. **The delivery log holds no body and no variables.** A reset link must not
   be readable in admin. 90-day retention, purged by
   `/api/cron/housekeeping`.
6. **A test send ignores `isActive`, never `email.enabled`.**
7. **Public-audience templates are translated; staff-audience ones are
   English** (ADR-043).
8. **The preview is a route, never a string.** The rendered HTML is served by
   `POST /admin/api/email/preview` under its own
   `sandbox; default-src 'none'` CSP and framed in `sandbox=""`. The editor
   reaches it with a real form POST at a named frame: `fetch` + a blob URL
   would put the author's markup back on the ADMIN origin, and `srcDoc` would
   inherit the admin nonce CSP. It is the ONE entry in `proxy.ts`'s
   `ADMIN_FRAMABLE_PATHS`; every other /admin path stays `DENY`.
9. **Default CONTENT lives in `@repo/db`'s `EMAIL_TEMPLATE_DEFAULTS`**, not in
   `seed.ts`, because "Reset to default" writes the same five bodies the seed
   does. `check:email-templates` scans that file against the registry.
10. **Anonymous public mutation** (newsletter signup) needs the full stack:
   flag + schema + honeypot + per-IP limit + per-email limit. Nothing else in
   the repo may write without a subject.

## Adding a template

1. `EMAIL_TEMPLATES` entry: key, audience, `critical`, variables, required,
   sample values.
2. An `EMAIL_TEMPLATE_DEFAULTS` entry with `en` content
   (`packages/db/src/email-template-defaults.ts`), which the seed writes and
   "Reset to default" restores (create-only — an edited template is never
   overwritten).
3. The call site: `sendTemplatedEmail({ key, to, locale, variables })`.
4. A test asserting the send and its suppression paths.

## Required tests

Secret round-trip and tamper - a real SMTP send against a Mailpit container -
both switches suppressing - the reset token absent from the delivery row -
an XSS corpus plus a fast-check property on the sanitiser - escaping and URL
validation - registry/seed/sample agreement - permission denial asserted at
the database. Floors: 80% for the package, 90% for `render`, `sanitize` and
`secret`.

## DoD

- [x] F2 schema + package skeleton + Mailpit in `docker-compose.yml`
- [x] F3 registry, renderer, sanitiser
- [x] F4 send service, `email` settings group, auth wired (reset,
      verification, notices, limits, session revocation, lockout clear)
- [x] F5 admin: settings split by permission, template editor, isolated
      preview, test send, delivery log
- [x] F6 reset/forgot screens on both surfaces, proxy allowlist,
      verification nudge
- [ ] F7 newsletter: model, double opt-in, public action, admin list, export
- [ ] F9 gate + DEVLOG
