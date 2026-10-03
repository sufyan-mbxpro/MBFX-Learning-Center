# SKILL — Module 17: `@repo/email` + newsletter

ADR-078 (platform), ADR-079 (password recovery), ADR-080 (newsletter),
ADR-171 (announcement emails), ADR-172 (custom and direct emails, designs), ADR-179 (the branded shell).
Plans: `docs/changes/changes-21-feature-plan.md` (PRs F0–F9),
`docs/changes/changes-54-notifications.md` (announcements, N0–N7),
`docs/changes/changes-55-custome-notifications.md` (custom and direct emails).

## The shape

```
packages/email/src/
├── secret.ts      # sealSecret / openSecret — AES-256-GCM under EMAIL_SECRET_KEY
├── transport.ts   # EmailTransportDriver seam: smtpDriver | logDriver
├── render.ts      # {{var}} substitution, escaping, text alternative
├── layout.ts      # the table-based shell (two brand bands, ADR-179); ed-* classes → inline styles
├── sanitize.ts    # the email allowlist (save AND render)
├── send.ts        # createSendSession() + sendTemplatedEmail() (a one-shot session)
├── links.ts       # the announcement unsubscribe token — the ONE reader of EMAIL_LINK_SECRET
├── unsubscribe-headers.ts # List-Unsubscribe: the header names the POST handler, not the page
└── testing.ts     # memoryDriver(), not exported from "."

packages/db/src/email-template-defaults.ts   # the starting CONTENT (seed + reset), + pre-changes-61 fingerprints
packages/db/src/email-blocks.ts              # eyebrow/headline/button/panel/badge/codeBox markup (ADR-184)
packages/core/src/email-admin.ts             # the ADMIN's door: transport, templates, log
apps/web/app/(admin)/admin/settings/email/   # the four screens
apps/web/app/(admin)/admin/api/email/preview # the isolated preview route

packages/core/src/newsletter.ts               # double opt-in + the admin reads (ADR-080)
apps/web/app/(public)/[locale]/_actions/newsletter.ts   # the ONE anonymous mutation
apps/web/app/(public)/[locale]/newsletter/    # confirm + unsubscribe, both POST-only
apps/web/app/api/newsletter/unsubscribe/      # RFC 8058 one-click (POST, no GET export)
apps/web/app/api/cron/housekeeping/           # the 90-day + 7-day retention sweeps
apps/web/app/(admin)/admin/newsletter/        # the subscriber list

packages/core/src/announcements.ts            # ADR-171: drafts, queue, cancel/retry, suppression, unsubscribe
packages/core/src/announcement-audience.ts    # every audience as SQL; the snapshot is INSERT IGNORE … SELECT
packages/core/src/announcement-target.ts      # live / scheduled / unavailable, per-locale words
packages/core/src/announcement-runner.ts      # the job runner: claim, pace, settle, lease expiry, purge
apps/web/app/api/cron/announcements/          # the queue's cron runner (every minute)
apps/web/app/api/email/unsubscribe/           # RFC 8058 one-click — the FOURTH anonymous write
apps/web/app/(public)/[locale]/email/unsubscribe/ # the page an announcement's footer links to
apps/web/app/(admin)/keystone/announcements/  # "Email campaigns": list, course editor, custom composer, detail

packages/core/src/custom-emails.ts            # ADR-172: designs, custom drafts + test, direct send, a user's history
packages/core/src/campaign-content.ts         # a campaign's own words: load, pick per locale, hash for the test gate
packages/db/src/email-design-defaults.ts      # the seeded "Plain message" design (create-only, fixed id)
apps/web/app/(admin)/keystone/settings/email/designs/  # the design editor (the list is a Templates section)
apps/web/app/(admin)/keystone/_components/send-email-dialog.tsx # "Send email" on users + subscribers
apps/web/app/(admin)/keystone/_components/email-preview.tsx     # THE preview: frame (device/scheme/HTML), dialog, thumbnail
```

`auth → email` and `core → email` — email sits BELOW both senders, because
both layers send. It never imports an app, `@repo/core`, or `@repo/auth`.
Since ADR-179 it imports `@repo/i18n` for the shell's words (`emailShell.*`).
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
   8b. **The email block vocabulary is theme-resolved and editor-kept** (ADR-184).
   `ed-btn`, `ed-panel`, `ed-code`, `ed-eyebrow`, `ed-title`, `ed-badge-*` map
   to inline styles in `layout.ts`; the editor keeps them only with
   `RichTextEditor emailBlocks`, and they are NOT article classes. A seeded
   body upgrades only while it still equals its fingerprint in
   `EMAIL_TEMPLATE_PREVIOUS_DEFAULTS` / `EMAIL_TEMPLATES_AR_PREVIOUS`; add the
   current bodies there before changing a default again.
9. **Default CONTENT lives in `@repo/db`'s `EMAIL_TEMPLATE_DEFAULTS`**, not in
   `seed.ts`, because "Reset to default" writes the same five bodies the seed
   does. `check:email-templates` scans that file against the registry.
10. **Anonymous public mutation** (newsletter signup) needs the full stack:
    flag + schema + honeypot + per-IP limit + per-email limit. There are FOUR
    anonymous writes now (signup, /support, the promotion counters, and
    ADR-171's announcement unsubscribe); a fifth needs its own ADR, and
    `promotions-public.test.ts` walks every POST route under `app/api`. All five are asserted separately by
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

15. **Announcements are delivered only through the job queue** (ADR-171 #1,
    owner D8). Send writes `EmailCampaignRecipient` rows; the `after()` kick
    and `/api/cron/announcements` send them. `@@unique([campaignId, email])`
    makes "one announcement, one email per address" a database property, and
    a lease that expires mid-send becomes FAILED `lease_expired`, never
    PENDING (at-most-once). Transactional mail still sends inline through
    `after()` (ADR-078 #11 stands for it).
16. **A batch uses `createSendSession`**, which reads the switches, template,
    context, sender and transport once. Never loop `sendTemplatedEmail` over a
    list. A FAILED result's `failure` says whether to retry.
17. **A message has two unsubscribe addresses.** The footer link is a PAGE
    (a GET never mutates); the `List-Unsubscribe` header is the POST handler
    (`unsubscribe.oneClickUrl`). Using one URL for both is how the newsletter
    welcome's one-click posted into a page for months (changes-54 §9.3).
18. **`EmailSuppression` is never purged** and is keyed by address. Staff can
    lift only a suppression staff made (`reason = ADMIN`).
19. **A design is not a template** (ADR-172 #3). `EmailDesign` has no key and
    nothing sends it; starting an email COPIES it. Never fold designs into
    `EmailTemplate` rows: ADR-078 #5 (code decides every email the system
    sends on its own) depends on the difference.
20. **`campaign.custom` and `campaign.direct` live in `CAMPAIGN_EMAILS`**, not
    `EMAIL_TEMPLATES` (ADR-172 #4). They own no stored body and no on/off row;
    the session renders the words passed as `content`. `renderEmail` accepts
    either registry's key.
21. **A CUSTOM or DIRECT campaign's words are its own**, per locale in
    `EmailCampaignContent`, sanitised on save and frozen once it leaves DRAFT.
    Only globals + `unsubscribe.url` may appear, and an HTML-mode body must
    carry `{{unsubscribe.url}}` itself. A bulk custom email is refused
    (`test_required`) unless a test went out since the last edit: the campaign
    stores the hash of its words at that test.
22. **A direct email is a one-recipient campaign on the same queue**
    (ADR-172 #1). An announcements suppression WARNS for an account holder
    and REFUSES for a subscriber-only contact (#6); 30 per author per hour.
    The dialog is mounted per open, so each open re-asks the server.
23. **The audience cards are one component** (`audience-cards.tsx`), used by
    both editors; `audiencesForKind()` decides the set. `staff` is a custom
    email's only (ADR-172 #5) and needs `employees.view`.

24. **The shell's lines are data and its words are the catalog's**
    (ADR-179). `localizeEmailShell` composes links, contact rows and the
    copyright / "sent to" lines from the render context, `emailShell.*` in
    the reader's language, and the recipient; an absent value removes its
    line. Band inks are derived against `brand.secondary`, never chosen.
    Shell text is brace-escaped, because substitution runs after it.
25. **One preview component.** Every email screen previews through
    `email-preview.tsx` (frame, dialog, thumbnail), which keeps #8's
    POST-to-named-sandboxed-frame. `scheme=dark` renders `tokens.dark` for
    the preview only; a send is always light.

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
- [x] ADR-171 announcements N0–N7 (schema, session, links, core, cron,
      public unsubscribe, admin, and the Mailpit-backed E2E journey
      `e2e/admin/announcements.spec.ts`, 5/5)
- [x] ADR-172 custom and direct emails (schema, contracts, session content
      mode, core, designs, composer, dialog on four screens, Emails tab,
      Testcontainers suite `custom-emails.integration.test.ts`, E2E
      `e2e/admin/custom-emails.spec.ts`)
- [ ] Owed to Module 14: E2E for the four new screens, axe on the two new
      public routes, and a Mailpit-backed journey (signup → confirm →
      unsubscribe). The Testcontainers suites could not run on the authoring
      machine (no Docker socket from that shell) — they are written, not yet
      executed.
