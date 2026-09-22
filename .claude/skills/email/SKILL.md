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

packages/core/src/newsletter.ts               # double opt-in + the admin reads (ADR-080)
apps/web/app/(public)/[locale]/_actions/newsletter.ts   # the ONE anonymous mutation
apps/web/app/(public)/[locale]/newsletter/    # confirm + unsubscribe, both POST-only
apps/web/app/api/newsletter/unsubscribe/      # RFC 8058 one-click (POST, no GET export)
apps/web/app/api/cron/housekeeping/           # the 90-day + 7-day retention sweeps
apps/web/app/(admin)/admin/newsletter/        # the subscriber list
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
    the repo may write without a subject. All five are asserted separately by
    `app/(public)/[locale]/_actions/newsletter.test.ts` — remove one and
    exactly one test goes red.
11. **A GET never confirms or unsubscribes** (ADR-080 #4). Mail scanners fetch
    every link in a message. `/newsletter/confirm` and
    `/newsletter/unsubscribe` are static shells whose island POSTs, and
    `/api/newsletter/unsubscribe` exports **no GET at all** — a GET there
    answers 405, which is the assertion worth keeping.
12. **Both newsletter tokens are stored HASHED**, and they expire differently:
    confirm is single-use and 48h, unsubscribe is long-lived because it has to
    keep working in a message sent months ago. `subscribe()` answers
    identically for a new, pending, active and unsubscribed address — the form
    must not become a membership oracle.
13. **No route-level `export const dynamic`.** It is incompatible with
    `cacheComponents` (ADR-004) and Next refuses to COMPILE the file, so the
    route answers 500 to every caller. That is how `/api/cron/publish-due`
    was broken between ADR-071 and changes-21 F9. A route handler reading env
    and headers is dynamic already.
14. **SendGrid is the `SENDGRID` driver, over HTTPS, not SMTP** (ADR-152).
    Its API key lives in `passwordCipher`, so invariant #1 covers it. Sandbox
    mode (`EmailTransport.sandboxMode`) sends
    `mail_settings.sandbox_mode.enable`. SendGrid honours that on no SMTP path,
    which is why the driver exists. A sandboxed send is logged as SENT with
    `SANDBOX_REASON` rather than given a new status. Test a template without
    reaching a real inbox this way: choose SendGrid, turn sandbox on, save,
    then use Send test.

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
- [x] F7 newsletter: model, double opt-in, public action, admin list, export
- [x] F9 gate + DEVLOG
- [ ] Owed to Module 14: E2E for the four new screens, axe on the two new
      public routes, and a Mailpit-backed journey (signup → confirm →
      unsubscribe). The Testcontainers suites could not run on the authoring
      machine (no Docker socket from that shell) — they are written, not yet
      executed.
