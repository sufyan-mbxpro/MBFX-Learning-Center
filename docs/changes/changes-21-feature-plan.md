# changes-21 (features) — password recovery, an email platform, a real newsletter, a fuller dashboard

**Brief:** `changes-21-featuer-improvments.md` (owner, 2026-09-12).
**ADRs to write first (PR F0):** ADR-078 (email platform), ADR-079 (password
recovery + verification), ADR-080 (newsletter subscribers).
**Modules:** 04 (auth), 05 (settings), 07 (ui), 09 (admin shell), 12 (public
site), 01 (db), and a new **Module 17 — Email & newsletter**.
**Date:** 2026-09-12 · **Status:** PLAN — no code, no migration, no ADR yet.

The UI track of changes-21 already uses the letters A–C (Phase A loaders,
shipped; Phase B audit + ADR-077 forms, uncommitted in the tree). This
feature track numbers its PRs **F0–F9** so the two never collide. **F1 builds on
ADR-077's `Field` wiring, so Phase B commits first.**

---

## 1. The brief, line by line

| #   | Owner's line                                                                                                                   | Where it lands       |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| B1  | Add forgot password                                                                                                            | F4 (server), F6 (UI) |
| B2  | Icon to show/hide the password                                                                                                 | F1                   |
| B3  | Email configuration, used for confirmations, forgot password, future uses                                                      | F2, F4, F5           |
| B4  | Templates editable with the rich text editor; from email, from name, logo, dynamic variables; raw HTML; test send per template | F3, F5               |
| B5  | Each template can be activated/deactivated                                                                                     | F4 (rule), F5 (UI)   |
| B6  | Make the public "Newsletter signup is coming soon" real                                                                        | F7                   |
| B7  | Dashboard shows courses, lessons, topics, videos, etc.                                                                         | F8                   |

## 2. Decisions

### 2.1 Taken by the owner (2026-09-12, this session)

| #   | Question                               | Answer                                                                                                                                                        |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where do SMTP credentials live?        | **Admin-editable, encrypted.** AES-256-GCM, key in env (`EMAIL_SECRET_KEY`), password write-only. ADR-078 narrows security.md #10 for exactly this one field. |
| D2  | Must learners verify email to sign in? | **Send, don't block.** `requireEmailVerification` stays `false`. The verification email goes out on sign-up, and the account nudges until verified.           |
| D3  | How far does the newsletter go?        | **Signup + subscriber admin.** Double opt-in, unsubscribe, admin list, CSV export, delete. **No campaign sending**: that is a later brief.                    |

### 2.2 Taken in this plan (reversible; flagged for the owner)

1. **Email is its own package, `@repo/email`.** It is a domain package that
   owns its own tables, the way `@repo/settings` and `@repo/theme` already do.
   - The reason: `@repo/auth` has to send email, and `@repo/core` already
     imports `@repo/auth` (`packages/core/src/users.ts`). Putting email in
     core would create a package cycle.
   - The graph becomes `auth → email`, `core → email`, and
     `email → db/contracts/settings/theme/utils`. ADR-078 records it, and
     architecture.md #8 gains the edge.
2. **The template set is a code registry; its content is data.**
   - Admins edit subject, body, sender overrides and on/off. They cannot
     invent a template key, because code decides _when_ an email is sent.
     This is the ADR-042 split: composition is code, content is data.
3. **Variables are `{{dotted.path}}` with no logic.** There are no
   loops or conditionals, and no Handlebars dependency.
   - Every value is HTML-escaped.
   - A URL-typed variable is checked to be `http(s)` before it is
     substituted.
   - An unknown variable fails the save, in the same Zod schema the action
     runs (ADR-077).
4. **No queue.** Sending happens after the response, through Next's `after()`
   and Better Auth's `advanced.backgroundTasks`.
   - A delivery log records every attempt, but never the body or the
     variables, because reset links must not sit in a table an admin can
     read.
   - The `EmailTransportDriver` seam is the join point for the changes-12
     worker (BullMQ, still unbuilt). Campaigns (D3) would need that worker,
     so they wait for it.
   - This is the one timing risk. It is named here and not again.
5. **Test sends ignore `isActive` but respect the transport.** You can test a
   template before switching it on, but a test can never reach anyone while
   email is globally off.
6. **Critical templates warn before being switched off.** Password reset and
   verification are critical. Turning one off goes through `ConfirmDialog`,
   which says what breaks (code-style #7). Nothing forbids it.
7. **Staff-audience email is English-only, and public-audience email is
   translated per locale** (ADR-043, both halves).
   - A missing translation falls back to the default locale and shows a
     "missing" badge in admin.
8. **Confirmation links never mutate on GET.** Mail scanners prefetch links.
   - `/newsletter/confirm` and `/newsletter/unsubscribe` render a button
     that POSTs.
   - The only GET-free exception is RFC 8058's one-click `List-Unsubscribe-Post`
     endpoint, which mail clients POST to directly.
9. **The dashboard gates every tile by permission, existing tiles included.**
   Today any STAFF member sees user counts; after F8 that needs `users.view`.
   - Also, the "Active menu items" card links to `/admin/navigation`, a
     screen ADR-038 hid. It is replaced by an "Email deliveries" card.

### 2.3 Answered by the owner (2026-09-12, after the first draft)

All three went **against** the draft defaults or added a condition to them.

- **Q1 — `email.settings.manage` is super_admin-only.** The password is
  write-only, but **the host is not**, and that is the escalation path: an
  admin who can edit the transport points delivery at a server they control
  and captures the next password-reset link for anyone, a super_admin
  included. Nothing else on the screen gives them that — `users.password.reset`
  already lets an admin reset a _learner's_ password, but `canAssignRole`'s
  strict `<` keeps them away from a super_admin's, and intercepting the email
  walks straight around it.
  - The key joins `roles.manage`, `permissions.assign` and `users.impersonate`
    in the `admin` role's exclusion list in `seed.ts`.
  - **Template editing and the delivery log stay with `admin`**, so the screen
    splits (F5).
  - ADR-078 records the interception path as the reason, not the level.
- **Q2 — 90 days, and never longer.** The log carries no body, but the
  recipient addresses are still PII, so the shorter of "works" and "minimal"
  wins. Support conversations about a missing reset email happen the same
  week, not the same quarter. 30 days would also be acceptable if it is
  tightened later; the value is one constant in the housekeeping route.
- **Q3 — link at confirm time, and `SetNull` on delete.** It costs nothing
  now and pays for campaign audience filtering later, and it gives erasure one
  place to look.
  - **The consent is independent of the account**, so deleting the user must
    NOT delete the subscription: `userId String?` with
    `onDelete: SetNull`.
  - Today's user deletion is soft (`deletedAt`), which leaves the link intact
    and is correct. `SetNull` is what a hard erase hits.

---

## 3. What exists today (verified against the tree, 2026-09-12)

- **Better Auth already does reset and verification.** The emails just go
  nowhere.
  - `packages/auth/src/index.ts:55` has `logEmail()`, which calls
    `console.log` from both `sendResetPassword` and `sendVerificationEmail`.
  - Reset tokens last 30 minutes (`resetPasswordTokenExpiresIn: 30 * 60`).
  - `sendOnSignUp: true`. `afterEmailVerification` sets `status: "ACTIVE"`.
  - Better Auth 1.7.2's `/request-password-reset` already answers the same
    way for unknown emails and simulates the lookup
    (`better-auth/dist/api/routes/password.mjs:59–70`).
- **Missing pieces:**
  - Not configured: `revokeSessionsOnPasswordReset`, `onPasswordReset`,
    `advanced.backgroundTasks` and `rateLimit.customRules`.
  - No email library, no SMTP env vars and no template, delivery or
    subscriber model. Better Auth's `Verification` model does exist.
  - No encryption helper anywhere in the repo.
- **Password fields.** Six raw `<Input type="password">`:
  - `(admin-auth)/admin/sign-in/admin-sign-in-form.tsx:76`
  - `[locale]/sign-in/sign-in-form.tsx:75`
  - `[locale]/sign-up/sign-up-form.tsx:88`
  - `admin/profile/profile-forms.tsx:153,163,173`
  - `reset-password-dialog.tsx` is an admin-sets-password dialog with a
    visible generated value (code-style #6 exception). It stays as it is.
- **Proxy.** `apps/web/proxy.ts:14,107` has exactly one unauthenticated
  `/admin` path, `ADMIN_SIGN_IN_PATH`.
- **Reserved paths.** `packages/contracts/src/cms/paths.ts:13` reserves
  `sign-in` and `sign-up`, but not `forgot-password`, `reset-password` or
  `newsletter`.
- **Newsletter.** `[locale]/_components/newsletter-form.tsx` is
  hard-`disabled` with a `TODO(newsletter)`.
  - It renders in four places: the footer, the `_sections/newsletter.tsx`
    homepage section, `/news` and `/analysis`.
  - All four are gated by the **setting** `footer.newsletterEnabled`, which
    is in the `layout` group, a group ADR-038 paused in admin.
  - The **flag** `newsletter` (`seed.ts:611`) is seeded but read by nothing.
  - The retained CMS block `packages/blocks/src/newsletter-form` is ADR-042
    history and stays untouched.
- **Dashboard.**
  - `admin/(dashboard)/page.tsx` shows users, published articles and
    employees, plus article charts. It gates nothing per tile.
  - Its data comes from `packages/core/src/admin-reads.ts:150–297`, and
    `loadAdminDashboardCounts()` (`:101`) is dead code.
- **Settings.** The registry is `packages/contracts/src/settings.ts`, with
  hand-kept parity with `seed.ts` SETTINGS.
  - Groups: `general, seo, layout, legal, articles, media, cms`.
  - "Settings is the ONLY system entry in the main sidebar" (changes-05,
    `admin-shell.tsx:189`), so the email screens live under
    `/admin/settings/*`.
- **Jobs.** No queue and no worker. `/api/cron/publish-due` (a `CRON_SECRET`
  bearer) is the only cron-style route.
- **Dev services.** `docker-compose.yml` runs MariaDB 11.4 and Redis 7.
  There is no mail catcher.
- **Registry pin.** `nodemailer` latest is `10.0.8`; `@types/nodemailer`
  latest is `8.0.1`. `minimumReleaseAge: 1440` applies.

---

## 4. PR order and dependencies

```
F0 ADRs/rules/skill ─┬─> F2 schema+pkg ─> F3 render ─> F4 send+auth ─┬─> F5 admin email
                     │                                               ├─> F6 reset/verify UI
                     │                                               └─> F7 newsletter ─┐
F1 PasswordInput ────┼──────────────────────────────────> (F6 uses it)                 │
F8 dashboard ────────┘  (independent; the subscriber tile renders once F7 lands) <──────┘
                                                                          F9 gate + docs
```

F1 and F8 can start the day F0 merges. F5, F6 and F7 can run in parallel once
F4 is in.

---

### PR F0 — ADRs, rules, module skill (docs only)

| File                                                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/memory/decisions/ADR-078-email-platform.md`         | NEW. `@repo/email` and its place in the package graph. The transport seam (`SMTP` / `LOG` drivers). **The security.md #10 exception:** one encrypted column, `EmailTransport.passwordCipher`, sealed with `EMAIL_SECRET_KEY`, write-only, never selected by a reader. **Why the transport is super_admin-only:** an editable host is a mail-interception path around `canAssignRole`'s strict `<`, so the sensitive field is the host, not just the password (§2.3 Q1). Code registry vs data content. The `{{var}}` engine. Two authoring modes. A body-less delivery log, 90-day retention. No queue (§2.2 #4). |
| `docs/memory/decisions/ADR-079-password-recovery.md`      | NEW. Reset routes on both surfaces. The link is routed by the **user's** `userType`, never by the screen it was asked from, so a learner is never sent an `/admin` URL. Per-IP and per-account limits. Sessions revoked on reset. Lockout cleared on reset. A "password changed" notice for self-service, admin and profile changes. D2.                                                                                                                                                                                                                                                                          |
| `docs/memory/decisions/ADR-080-newsletter-subscribers.md` | NEW. Double opt-in. Hashed tokens. Scanner-safe confirm (§2.2 #8). RFC 8058 one-click unsubscribe. Flag = feature, setting = placement. The one sanctioned _anonymous_ public mutation shape: flag + Zod + honeypot + per-IP and per-email limit + audit-free. D3, including what "no campaigns" defers.                                                                                                                                                                                                                                                                                                          |
| `.claude/rules/security.md`                               | #10 gains a one-line pointer: "…except the SMTP password, sealed per ADR-078." #13 gains `request-password-reset` and newsletter signup in its list.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.claude/rules/architecture.md`                           | #8 adds `auth → email`, `core → email`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.claude/skills/email/SKILL.md`                           | NEW Module 17 skill: package map, registry, how to add a template (registry entry + seed row + sample + test), invariants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `CLAUDE.md`                                               | Module 17 row. Architecture diagram gains `email/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `docs/memory/stack.md`                                    | `nodemailer` **10.0.8 exact** and `@types/nodemailer` **8.0.1 exact** (re-check both against `minimumReleaseAge` on install day), and the Mailpit image for dev and tests.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Exit:** `pnpm governance:check` green. Every later PR cites one of these ADRs.

---

### PR F1 — `PasswordInput` (B2)

| File                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/password-input.tsx`      | NEW. `PasswordInput(props: InputProps & { showLabel: string; hideLabel: string })`. It wraps `Input`, so `useFieldControl` and the ADR-077 `Field` wiring are kept. The toggle is `type="button"` with lucide `Eye`/`EyeOff`, `aria-pressed`, `aria-controls`, and the label as its accessible name. It sits at `end-*` with `pe-*` on the input (logical properties). Toggling keeps focus and caret position. It adds `::-ms-reveal { display: none }` so Edge doesn't draw a second eye. |
| `packages/ui/package.json`                           | Granular export `./components/password-input`.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| The 6 call sites in §3                               | `Input type="password"` → `PasswordInput`. Every existing `autoComplete` is kept.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/i18n/messages/en.json` (+ `es/ar/ur`)      | `auth.showPassword`, `auth.hidePassword` (public). `admin.password.show`, `admin.password.hide` (en only, ADR-043).                                                                                                                                                                                                                                                                                                                                                                         |
| `admin/design-system/design-system-client.tsx`       | Adds the component to the Forms section. `admin-design-system.test.ts` keeps passing.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `apps/web/app/password-fields.test.ts`               | NEW guard: no `type="password"` under `apps/web/app` outside `reset-password-dialog.tsx`'s documented exception.                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/ui/src/components/password-input.test.tsx` | NEW.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

### PR F2 — schema, `@repo/email` skeleton, transport, secret sealing (B3)

**Schema** (`packages/db/prisma/schema.prisma`). The migration is additive, so
it uses `migrate dev`.

```prisma
enum EmailDriver    { SMTP LOG }
enum SmtpSecurity   { NONE STARTTLS TLS }
enum EmailBodyMode  { RICH HTML }
enum EmailDeliveryStatus { SENT FAILED SUPPRESSED }

model EmailTransport {            // singleton, id = "default"
  id             String       @id @default("default")
  driver         EmailDriver  @default(LOG)
  host           String?
  port           Int?
  security       SmtpSecurity @default(STARTTLS)
  username       String?
  passwordCipher String?      @db.Text   // "v1:<iv>:<tag>:<ct>", ADR-078 — never selected by a reader
  lastVerifiedAt DateTime?
  lastError      String?      @db.Text
  updatedById    String?
  updatedAt      DateTime     @updatedAt
}

model EmailTemplate {
  key          String   @id               // EMAIL_TEMPLATES registry key
  isActive     Boolean  @default(true)
  fromName     String?                    // null = settings default
  fromEmail    String?
  replyTo      String?
  updatedById  String?
  updatedAt    DateTime @updatedAt
  translations EmailTemplateTranslation[]
}

model EmailTemplateTranslation {  // the GlossaryTermTranslation shape (translationStatus + sourceHash)
  id                String            @id @default(cuid())
  templateKey       String
  locale            String            @db.VarChar(10)
  subject           String            @db.VarChar(200)
  preheader         String?           @db.VarChar(200)
  mode              EmailBodyMode     @default(RICH)
  bodyHtml          String            @db.MediumText
  translationStatus TranslationStatus @default(DRAFT)   // existing enum: DRAFT TRANSLATED NEEDS_REVIEW OUTDATED
  sourceHash        String?           @db.VarChar(64)
  updatedAt         DateTime          @updatedAt
  template          EmailTemplate     @relation(fields: [templateKey], references: [key], onDelete: Cascade)
  @@unique([templateKey, locale])
}

model EmailDelivery {             // no body, no variables — ADR-078
  id                String   @id @default(cuid())
  templateKey       String
  to                String
  locale            String
  subject           String   @db.VarChar(200)
  status            EmailDeliveryStatus
  reason            String?  @db.VarChar(500)
  providerMessageId String?
  isTest            Boolean  @default(false)
  triggeredById     String?
  createdAt         DateTime @default(now())
  @@index([createdAt])
  @@index([templateKey, createdAt])
  @@index([status, createdAt])
}
```

The seed writes the `en` source rows as `TRANSLATED`. Saving the default-locale
body re-hashes it and flips the sibling locales to `OUTDATED`, the same rule
the glossary editor uses (ADR-069).

**Package**

| File                                    | Change                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/email/package.json`           | `@repo/email`. Deps: `@repo/db`, `@repo/contracts`, `@repo/settings`, `@repo/theme`, `@repo/utils`, `nodemailer`, `sanitize-html` (2.17.7, already in core). Exports: `.`, `./render`, `./testing`. Standard tooling configs.                                                                                                                |
| `packages/email/src/secret.ts`          | `sealSecret(plain: string): string`, `openSecret(sealed: string): string`. Node `crypto` AES-256-GCM, a random 12-byte IV, and a `v1:` version prefix for rotation. The key is `EMAIL_SECRET_KEY` (32 bytes, base64). If it is missing it throws `EmailSecretKeyMissingError`; nothing falls back to plaintext.                              |
| `packages/email/src/transport.ts`       | `interface EmailTransportDriver { send(m: OutgoingEmail): Promise<{ messageId: string }>; verify(): Promise<void> }`. `smtpDriver(cfg)` (nodemailer) and `logDriver()`, which keeps today's `logEmail` console line and is the default while no SMTP row exists. `loadTransportDriver()` is the **only** code that selects `passwordCipher`. |
| `packages/email/src/testing.ts`         | `memoryDriver()`, which records sends for tests. It is not exported from `.`.                                                                                                                                                                                                                                                                |
| `docker-compose.yml`                    | `mailpit` service (SMTP 1025, UI 8025) for dev.                                                                                                                                                                                                                                                                                              |
| `.env.example`                          | `EMAIL_SECRET_KEY=` (name only), with a comment on how to generate it.                                                                                                                                                                                                                                                                       |
| `turbo.json`, `pnpm check:phantom-deps` | The new package is wired into test and typecheck.                                                                                                                                                                                                                                                                                            |

---

### PR F3 — registry, renderer, email sanitizer (B4)

| File                              | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/email.ts` | NEW. `EMAIL_TEMPLATES` registry (below). Global variables: `site.name`, `site.url`, `logo.url`, `year`, `recipient.email`, `recipient.name`. `findTemplateVariables(text)`. Zod v4: `emailTemplateSaveSchema` (subject ≤ 200 with no CR/LF, body, mode; `superRefine` rejects unknown variables and requires each template's `required` ones), `emailTransportSaveSchema` (host, port 1–65535, security, username, `password?`, where empty means _keep_), `emailTestSendSchema { key, locale, to }`. |
| `packages/email/src/render.ts`    | `renderEmail(input): { subject: string; html: string; text: string }`. Substitution runs **after** sanitising and HTML-escapes every value. URL variables must be `http(s)` or they throw. The subject strips CR/LF (header injection). RICH mode wraps the body in `layout.ts`; HTML mode is the owner's full document. `/uploads/…` srcs are made absolute with `NEXT_PUBLIC_SITE_URL`. There is a plain-text alternative and a hidden preheader.                                                   |
| `packages/email/src/layout.ts`    | A table-based 600px shell: logo header, body, footer text, postal address, and the unsubscribe line when the registry says so. **Colours come from `getActiveTheme("web")`** (`@repo/theme`), so there are no hex literals (code-style #1). The editor's `ed-*` classes (`editor-extensions.ts`) are mapped to inline styles here, because email clients drop class CSS.                                                                                                                              |
| `packages/email/src/sanitize.ts`  | `sanitizeEmailHtml(html, mode)`, built on sanitize-html. The email allowlist is table layout attributes plus a `style` attribute with a property allowlist; `<style>` is allowed in HTML mode only. No script, iframe, form, object, or `on*` attributes. Schemes `http/https/mailto`. `{{…}}` survives in `href`/`src`. Runs **on save** (security.md #8) and again on render.                                                                                                                       |

**Registry** (seeded content is `en`, RICH mode):

| Key                     | Audience | Critical | Required variables             | Fired by                                       |
| ----------------------- | -------- | -------- | ------------------------------ | ---------------------------------------------- |
| `auth.password_reset`   | any      | yes      | `reset.url`, `expires.minutes` | Better Auth `sendResetPassword`                |
| `auth.verify_email`     | public   | yes      | `verify.url`                   | Better Auth `sendVerificationEmail`            |
| `auth.password_changed` | any      | no       | `changed.at`                   | `onPasswordReset`, admin reset, profile change |
| `newsletter.confirm`    | public   | yes      | `confirm.url`                  | `subscribe()`                                  |
| `newsletter.welcome`    | public   | no       | `unsubscribe.url`              | `confirmSubscription()`                        |

Adding a template means a registry entry, a seed row, a sample and a
test. `email-registry.test.ts` names any missing half (the ADR-065 drift-guard
pattern).

---

### PR F4 — the send service, settings, and wiring auth (B1 server, B3, B5)

| File                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/email/src/send.ts`                     | `sendTemplatedEmail({ key, to, locale, variables, triggeredById?, isTest? }): Promise<DeliveryResult>`. Rules in order: `email.enabled` off → SUPPRESSED; template inactive and not a test → SUPPRESSED; translation lookup is locale → default locale; render; send; write an `EmailDelivery` row. A delivery failure **returns** FAILED and never throws into auth. `verifyTransport(): Promise<{ ok: true } \| { ok: false; error: string }>`. |
| `packages/contracts/src/settings.ts` + `seed.ts` | New group `email`, every key `isPublic: false`: `email.enabled` (BOOLEAN, true), `email.fromName` (STRING), `email.fromEmail` (STRING, email), `email.replyTo` (STRING), `email.logo` (IMAGE; falls back to the theme logo), `email.footerText` (TEXT, translatable), `email.postalAddress` (TEXT, which the newsletter footer needs).                                                                                                            |
| `packages/db/prisma/seed.ts`                     | The 5 templates with `en` content. **Create-only**: an edited template is never overwritten, the same rule as settings.                                                                                                                                                                                                                                                                                                                           |
| `packages/auth/src/index.ts`                     | Delete `logEmail`. Details below.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/auth/package.json`                     | `+ @repo/email`.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/core/src/users.ts`                     | `recordPasswordReset` (the admin reset) also sends `auth.password_changed`. `core → @repo/email`.                                                                                                                                                                                                                                                                                                                                                 |

Changes in `packages/auth/src/index.ts`:

- **`sendResetPassword({ user, token })`:**
  1. Check the per-account limit with `rateLimit("pwreset:" + user.id, 3, 3600)`.
     Over the limit, it silently sends nothing.
  2. Build the URL from `user.userType`:
     - STAFF → `${ADMIN_URL}/admin/reset-password?token=`
     - everyone else → `${SITE_URL}/<locale prefix>reset-password?token=`
  3. Send `auth.password_reset`.
- **`sendVerificationEmail`** sends `auth.verify_email`.
- **`advanced.backgroundTasks.handler`** uses `after()`, so a known email and
  an unknown one answer in the same time.
- **`rateLimit.customRules`:** `/request-password-reset` 3 per 10 min,
  `/send-verification-email` 3 per 10 min, `/reset-password` 10 per 10 min.
- **`revokeSessionsOnPasswordReset: true`.**
- **`onPasswordReset({ user })`:**
  - clears `failedLoginCount` and `lockedUntil`
  - writes an `auth.passwordReset.self` audit row through `@repo/db`, the
    same way the lockout hook already writes
  - sends `auth.password_changed`
- **`changeOwnPassword`** sends `auth.password_changed`.

---

### PR F5 — admin: email settings, template editor, delivery log (B3, B4, B5)

**Permissions** (`seed.ts` PERMISSIONS, new group `email`):

- `email.settings.manage`
- `email.templates.view`
- `email.templates.update`
- `email.templates.test`
- `email.log.view`

**`email.settings.manage` is super_admin-only** (§2.3 Q1). It is the fourth
entry in the `admin` role's exclusion list at `seed.ts:153–155`:

```ts
!["roles.manage", "permissions.assign", "users.impersonate", "email.settings.manage"].includes(k);
```

`super_admin` holds `"*"`, so it needs no entry of its own. `admin` picks up
the other four keys through the same filter, and `read_only` picks up the
`.view` keys. `support` also gets `email.log.view`, for "I never got my reset
email". `pnpm check:permission-keys` covers every call site.

**Core** (`packages/core/src/email-admin.ts`; actions only ever call core):

```ts
loadEmailTransportView(): Promise<EmailTransportView>        // { driver, host, port, security, username, hasPassword, lastVerifiedAt, lastError } — no password field exists on the type
saveEmailTransport(actor, input: EmailTransportSave): Promise<void>   // seals password; empty password keeps the old cipher
listEmailTemplates(): Promise<EmailTemplateRow[]>            // + per-locale translation status
loadEmailTemplate(key): Promise<EmailTemplateDetail | null>
saveEmailTemplate(actor, key, locale, input): Promise<void>  // sanitizes on save; one transaction; flips sibling locales OUTDATED via sourceHash
setEmailTemplateActive(actor, key, isActive): Promise<void>
resetEmailTemplate(actor, key, locale): Promise<void>        // back to seeded default
renderEmailPreview(key, locale, draft?): Promise<RenderedEmail> // sample variables from the registry
listEmailDeliveries(filter, cursor?): Promise<EmailDeliveriesPage> // keyset, limit clamp 100 (the ADR-067 shape)
```

**Actions** (`app/(admin)/admin/_actions/email-actions.ts`). Each one starts
with `requirePermission`, parses with Zod, calls core and then `recordAudit`,
whose diff redacts `password`:

- `saveEmailTransportAction`, `testEmailConnectionAction` (`email.settings.manage`)
- `saveEmailTemplateAction`, `setEmailTemplateActiveAction`,
  `resetEmailTemplateAction` (`email.templates.update`)
- `sendTestEmailAction` (`email.templates.test`). It is limited to 10 per
  hour per actor with `rateLimit`. The recipient defaults to the actor's own
  address.

**Screens.** Settings sub-nav, `settings-shared.ts` + `settings-nav.tsx`.

| Route                                   | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/settings/email`                 | A static `email/page.tsx`, which wins over `[group]` the way `social/` already does. It needs `settings.view` and **splits by permission** (§2.3 Q1): **Sender** (the `email` group fields, saved under `settings.update`) renders for any admin; **Delivery** (driver, host, port, security, username, and a write-only password `PasswordInput` showing "saved — replace" when `hasPassword`) with **Test connection** renders ONLY with `email.settings.manage`, and is absent — not disabled — without it. Below it, the current sender identity is shown read-only, so an admin can see where mail comes from without being able to move it. The `EMAIL_SECRET_KEY`-missing warning lives in the Delivery section. |
| `/admin/settings/email/templates`       | DataTable: name, audience, active `Switch` (a critical one goes through `ConfirmDialog`), locale badges (current / outdated / missing), last edited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/settings/email/templates/[key]` | The editor. Details below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/admin/settings/email/log`             | DataTable: time, template, recipient, status, reason, a test badge. The status, template and search filters sit in the toolbar (code-style #9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

What the template editor (`/admin/settings/email/templates/[key]`) contains:

- Subject and preheader fields.
- A **Rich / HTML** mode switch:
  - Rich mode is the existing `RichTextEditor`.
  - HTML mode is a `font-mono` textarea; code-style #6's exception applies,
    because the value is code.
- A variables panel that inserts at the cursor, with each variable's
  description.
- Sender overrides.
- Locale tabs, for public-audience templates only.
- A live preview with a 600px / 375px toggle.
- **Send test**: a dialog with a title and description (code-style #11)
  that takes a recipient and locale.
- **Reset to default** (`ConfirmDialog`).
- Save sits at the inline end.

**Preview isolation.**

- **The route.** `POST /admin/api/email/preview` returns the rendered HTML
  and runs `requirePermission("email.templates.view")` itself.
- **Its own CSP:** `sandbox; default-src 'none'; img-src https: data:;
style-src 'unsafe-inline'`.
- **The frame.** The editor posts the draft into a named `<iframe
sandbox="">`, which gives it an opaque origin and no script.
- **The proxy.** `apps/web/proxy.ts` `applySecurityHeaders` gets a single
  framable exception for that one path: `frame-ancestors 'self'` and
  `X-Frame-Options: SAMEORIGIN`. Every other `/admin` path stays `DENY`.
- **Why not `srcDoc`.** It would inherit the admin nonce CSP, and the `<style>`
  blocks HTML mode allows would break once CSP is enforced.

**Catalog:** `admin.email.*`, `admin.settingsGroups.email`, and
`admin.settingsGroupDesc.email` (en only).

---

### PR F6 — forgot / reset password UI on both surfaces, plus the verification nudge (B1)

| File                                                                    | Change                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/_lib/credentials.ts`                                      | `requestPasswordReset(email)` → `POST /api/auth/request-password-reset`; `resetPassword(token, newPassword)` → `POST /api/auth/reset-password`; `resendVerification(email)`. They go over HTTP, so the limiter applies.                                                                                                   |
| `app/(public)/[locale]/forgot-password/{page,forgot-password-form}.tsx` | Email field → **the same success message whatever the server says** (anti-enumeration). `noindex`.                                                                                                                                                                                                                        |
| `app/(public)/[locale]/reset-password/{page,reset-password-form}.tsx`   | Reads `?token` in a client island inside `Suspense`, so the shell stays static (architecture.md #6). New password + confirm (`PasswordInput`), validated by the contracts' `passwordSchema` through `useFieldErrors`. `INVALID_TOKEN` → "link expired" with a link to request a new one. On success → `/sign-in?reset=1`. |
| `[locale]/sign-in/sign-in-form.tsx`                                     | A "Forgot password?" link. Notices for `?reset=1` and `?verified=1`.                                                                                                                                                                                                                                                      |
| `[locale]/sign-up/sign-up-form.tsx`                                     | Passes `callbackURL: /<locale>/sign-in?verified=1`.                                                                                                                                                                                                                                                                       |
| `[locale]/_components/auth-slot.tsx`                                    | For a signed-in user with `emailVerified === false`, the account menu shows "Verify your email" with a Resend action (D2). First confirm that the slot's session read carries `emailVerified`.                                                                                                                            |
| `app/(admin-auth)/admin/{forgot-password,reset-password}/…`             | The staff equivalents, in the admin-auth shell. English only.                                                                                                                                                                                                                                                             |
| `(admin-auth)/admin/sign-in/admin-sign-in-form.tsx`                     | A "Forgot password?" link.                                                                                                                                                                                                                                                                                                |
| `apps/web/proxy.ts`                                                     | `ADMIN_SIGN_IN_PATH` → `ADMIN_PUBLIC_PATHS = new Set(["/admin/sign-in", "/admin/forgot-password", "/admin/reset-password"])`. The comment is updated to cite ADR-079.                                                                                                                                                     |
| `packages/contracts/src/cms/paths.ts`                                   | `RESERVED_PATHS` gains `forgot-password` and `reset-password` (the ADR-047 same-PR rule).                                                                                                                                                                                                                                 |
| `packages/i18n/messages/*.json`                                         | `auth.forgot*`, `auth.reset*`, `auth.verify*` (public); `admin.passwordReset.*` (en only).                                                                                                                                                                                                                                |

---

### PR F7 — newsletter (B6)

**Schema** (additive):

```prisma
enum SubscriberStatus { PENDING ACTIVE UNSUBSCRIBED }

model NewsletterSubscriber {
  id                   String           @id @default(cuid())
  email                String           @unique          // lower-cased
  locale               String
  status               SubscriberStatus @default(PENDING)
  source               String           @db.VarChar(32)  // footer | home | news | analysis
  confirmTokenHash     String?          @unique          // sha256; plaintext never stored
  confirmExpiresAt     DateTime?
  unsubscribeTokenHash String           @unique
  // Q3: linked at confirm time when the email matches a live user. The consent
  // is independent of the account, so a hard erase nulls this and KEEPS the row.
  userId               String?
  user                 User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
  confirmedAt          DateTime?
  unsubscribedAt       DateTime?
  lastConfirmSentAt    DateTime?
  createdAt            DateTime         @default(now())
  @@index([status, createdAt])
}
```

**Core** (`packages/core/src/newsletter.ts`):

```ts
subscribe({ email, locale, source }): Promise<void>   // idempotent, identical outcome for new/pending/active; re-sends confirm at most every 10 min; UNSUBSCRIBED → PENDING (opt-in again)
confirmSubscription(token): Promise<"confirmed" | "invalid">   // single use, 48h expiry, sends newsletter.welcome
unsubscribe(token): Promise<"unsubscribed" | "invalid">        // idempotent
listSubscribers(filter, cursor?): Promise<SubscribersPage>
exportSubscribersCsv(actor, filter): AsyncIterable<string>     // cells starting = + - @ are quoted-prefixed (CSV injection)
adminUnsubscribe(actor, id) / deleteSubscriber(actor, id)      // delete = hard erase (GDPR), audited
purgeExpiredPending(now) / purgeEmailDeliveries(before)         // housekeeping
```

**Public**

| File                                                                           | Change                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/(public)/[locale]/_actions/newsletter.ts`                                 | `"use server"`. Checks `isFeatureVisible("newsletter", null)`, then the honeypot field, then `rateLimit` (5 per 10 min per IP, 3 per hour per email), then `newsletterSubscribeSchema`, then `subscribe()`. The email goes out through `after()`. ADR-080 records this as the sanctioned anonymous-mutation shape. |
| `[locale]/_components/newsletter-form.tsx`                                     | A client form on `useActionState` that still submits without JS. States: idle, pending (`Button loading`), sent ("check your inbox"), invalid, rate-limited. It takes a `source` prop and adds a consent/privacy line. The `unavailableLabel` prop and the `TODO(newsletter)` are removed.                         |
| `footer.tsx`, `_sections/newsletter.tsx`, `news/page.tsx`, `analysis/page.tsx` | Render only when the `newsletter` **flag** is visible **and** the placement setting allows it. Each passes its `source`.                                                                                                                                                                                           |
| `[locale]/newsletter/{confirm,unsubscribe}/page.tsx`                           | A static shell with a client island that reads `?token` and offers one POST button (§2.2 #8). `noindex`.                                                                                                                                                                                                           |
| `apps/web/app/api/newsletter/unsubscribe/route.ts`                             | RFC 8058 one-click `POST`. `newsletter.*` sends carry `List-Unsubscribe` and `List-Unsubscribe-Post` headers.                                                                                                                                                                                                      |
| `apps/web/app/api/cron/housekeeping/route.ts`                                  | A copy of `publish-due`: the `CRON_SECRET` bearer, 503 when unset. It purges pending subscribers older than 7 days and deliveries older than **90 days — one named constant, and never raised** (Q2).                                                                                                              |
| `RESERVED_PATHS`                                                               | `+ newsletter`.                                                                                                                                                                                                                                                                                                    |
| `packages/i18n/messages/*.json`                                                | `footer.newsletterUnavailable` → `newsletterSent`, `newsletterInvalid`, `newsletterLimited`, `newsletterConsent`; `newsletter.confirm*`, `newsletter.unsubscribe*` (public namespace, added to code-style #2's list).                                                                                              |

**Admin**

- **`/admin/newsletter`.** It is a new `navPeople` entry, "Subscribers",
  gated by `newsletter.view`.
- **Counts header:** active, pending, unsubscribed.
- **DataTable.** Search, status and source filters sit in the toolbar. Row
  actions: unsubscribe and delete, each through `ConfirmDialog`.
- **Export CSV** is `GET /admin/api/newsletter/export`
  (`newsletter.export`, audited, streamed).
- **Permissions:** `newsletter.view`, `newsletter.manage`, `newsletter.export`
  (new group `newsletter`).
- **Settings.** `footer.newsletterEnabled` is stranded in the paused `layout`
  group, so it moves to the `email` group as `newsletter.placements.footer`.
  The other placements get sibling keys, so placement is editable again
  without un-pausing `layout`.

---

### PR F8 — dashboard: learning stats (B7)

| File                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/admin-reads.ts`                   | `loadAdminDashboardLearning(range, allowed: DashboardTileKey[]): Promise<AdminDashboardLearning>`. For each allowed entity it computes `{ total, published, inPipeline, created: DashboardTrend }`, where `inPipeline` is DRAFT through SCHEDULED, `deletedAt: null` is excluded, and it uses one `groupBy(["status"])` per model. Plus learners, enrollments, lesson completions, quiz attempts with pass rate, and subscribers. It **runs no query for a tile the viewer can't see.** The dead `loadAdminDashboardCounts()` is deleted. |
| `apps/web/app/(admin)/admin/_lib/dashboard-tiles.ts` | NEW, pure. `dashboardTilesFor(subject): DashboardTileKey[]` maps tiles to keys. Content: courses → `courses.view`; lessons, quizzes and videos → `lessons.view` (ADR-058/068); glossary terms and topics → `glossary.view`; articles → `analysis.view` or `news.manage`. People and engagement: users → `users.view`; employees → `employees.view`; engagement → `analytics.view`; subscribers → `newsletter.view`.                                                                                                                       |
| `admin/(dashboard)/page.tsx`                         | A new "Learning content" grid of 6 tiles. Each shows the published count, "N in progress" and new-in-range, and links to its list. An "Engagement" row sits beside it. The existing cards are gated too (§2.2 #9), and the `/admin/navigation` card is replaced.                                                                                                                                                                                                                                                                          |
| `admin/(dashboard)/loading.tsx`                      | Reserves the new grid (the Phase A rule: no layout jump).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/i18n/messages/en.json`                     | `admin.dashboard*` keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

### PR F9 — the gate, docs, DEVLOG

- Run the gate in this order: lint → typecheck → per-package tests (`email`,
  `auth`, `core`, `contracts`, `ui`, `web`, `i18n`) → dev server. Root
  `pnpm test` and `pnpm build` exhaust this machine's resources. The dev server step signs in, requests a reset,
  opens it in Mailpit, resets, subscribes, confirms, and tests every template.
- Run `governance:check`, `check:phantom-deps`, `check:permission-keys`,
  `check:catalog-completeness` and `check-reserved-paths`.
- Write the DEVLOG entry.
- Update the skills: `auth`, `settings`, `admin-shell`, `public-site` and the
  new `email` skill.
- Update the Module 04 CLAUDE.md row: "Password reset, email verification…
  still have no UI" becomes true only for OAuth.
- Owed to Module 14: E2E for every new screen, and axe on the four new public
  routes.

---

## 5. Criterion → test

| Criterion                                                                                                             | Test                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| The toggle flips `type` and `aria-pressed` and never submits the form                                                 | `password-input.test.tsx`                                                    |
| No raw password input remains in the app                                                                              | `password-fields.test.ts`                                                    |
| A sealed secret round-trips; tampering or a wrong key throws; no plaintext fallback                                   | `secret.test.ts`                                                             |
| The transport view type and its loader never carry the password                                                       | `email-admin.integration.test.ts` + a type-level `expectTypeOf`              |
| An SMTP send reaches a real server                                                                                    | `send.integration.test.ts`: Testcontainers Mailpit, asserted through its API |
| Global off, or an inactive template, → SUPPRESSED row and no send; a test send ignores inactive only                  | `send.integration.test.ts`                                                   |
| The delivery log never stores the body or the variables                                                               | `send.integration.test.ts` (asserts the reset token is absent from the row)  |
| Variables are escaped; an unknown variable fails save; a missing required one fails save                              | `render.test.ts`, `email.test.ts` (contracts)                                |
| A `javascript:` URL can't arrive through a variable; CR/LF can't reach the subject                                    | `render.test.ts`                                                             |
| No script, `on*` or `javascript:` survives sanitizing (fast-check over an XSS corpus)                                 | `sanitize.test.ts`                                                           |
| RICH mode's `ed-*` classes become inline styles with colours from the theme                                           | `layout.test.ts`                                                             |
| The template registry, the seed and the samples agree                                                                 | `email-registry.test.ts`                                                     |
| A STAFF reset link points at `/admin/reset-password`; a LEARNER's never contains `/admin`                             | `auth.integration.test.ts` (memoryDriver)                                    |
| An unknown email → same response, no delivery row                                                                     | `auth.integration.test.ts`                                                   |
| The per-account reset limit holds; sessions are revoked; the lockout is cleared; a "password changed" email is sent   | `auth.integration.test.ts`                                                   |
| `/admin/forgot-password` and `/admin/reset-password` are reachable anonymously; every other `/admin` path stays gated | `proxy.test.ts`                                                              |
| Only the preview path is framable                                                                                     | `proxy.test.ts`                                                              |
| Every email action refuses a subject without its key (denied at the DB: no row written)                               | `email-actions.test.ts`                                                      |
| An `admin`-level subject cannot save or test the transport, and never sees the host field                             | `email-actions.test.ts`, `email-settings-page.test.tsx`                      |
| No role but `super_admin` carries `email.settings.manage`                                                             | `seed-roles.test.ts`                                                         |
| Confirming links a matching live user; a hard erase nulls `userId` and keeps the subscription                         | `newsletter.integration.test.ts`                                             |
| Deactivating a critical template confirms; the modals have a title and a description                                  | `admin-dialog-conventions.test.ts` (extended), component test                |
| Subscribe answers identically for new, pending and active; tokens are stored only hashed                              | `newsletter.integration.test.ts`                                             |
| Confirm is single-use and expires; unsubscribe is idempotent; GET never mutates                                       | `newsletter.integration.test.ts`, page test                                  |
| Honeypot, per-IP limit and a flag that's off each refuse; the form works without JS                                   | `newsletter-action.test.ts`, `newsletter-form.test.tsx`                      |
| CSV export neutralises formula cells                                                                                  | `newsletter.integration.test.ts`                                             |
| New public routes are reserved                                                                                        | `check-reserved-paths`                                                       |
| Dashboard counts exclude deleted rows and count SCHEDULED as in progress                                              | `admin-reads.integration.test.ts`                                            |
| A subject without `courses.view` gets no Courses tile, and no query runs for it                                       | `dashboard-tiles.test.ts` + `admin-reads.integration.test.ts`                |

**Coverage floors (testing.md #1):** `@repo/email` is a service package, so
its floor is 80%. `render.ts`, `sanitize.ts` and `secret.ts` hold 90%, like
the pure-logic packages.

---

## 6. Not in scope

- **Newsletter campaigns and a composer** (D3). They need the changes-12
  worker.
- **A queue, retries and bounce/complaint webhooks.** These belong to the
  worker as well. FAILED rows are visible in the log.
- **DKIM signing in-app.** Every mainstream SMTP relay signs for you, and
  SPF/DKIM/DMARC are DNS work that goes on the launch checklist.
- **OAuth buttons**, still owed by Module 04.
- **Staff invitation email.** It would be a sixth registry entry and is
  cheap to add once F4 lands.
- **The retained CMS `newsletter-form` block** (ADR-042: retained, not
  resumed).

## 7. Risks

- **Losing `EMAIL_SECRET_KEY`** means re-entering the SMTP password. That is
  by design, and the screen says so. Rotation uses the `v1:` prefix.
- **A misconfigured transport** with D2 costs nothing, because sign-in is
  never blocked. It is visible as FAILED rows and a red "Delivery" status.
  With `requireEmailVerification: true` this would have been an outage.
  That is D2's reason.
- **nodemailer 10.x is a new major** compared with most snippets online. Pin
  it exact and read its changelog on install (stack.md discipline).
