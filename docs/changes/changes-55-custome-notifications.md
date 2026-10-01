# changes-55 — Custom emails: design them, write them, send them to a group or to one person

- **Status:** Complete (2026-09-30). The owner accepted E1–E8 (§14);
  ADR-172 is Accepted. §16 records where the build departed from this text.
- **Builds on changes-54** (course announcements, ADR-171), which shipped in
  full on 2026-09-30 (N0–N7). changes-55 does **not** build a second sending
  system. It adds two new _kinds_ of campaign to that one: the same audiences,
  deduplication, suppression, unsubscribe link, queue, cron runner and detail
  screen. §2 lists exactly what is shared and what is new.
- **Decision record:** **ADR-172**
  (`docs/memory/decisions/ADR-172-custom-and-direct-emails.md`). It amends
  ADR-171 #6 (no staff in any audience) and #8 (the body is the template's)
  for the two new kinds only. ADR-078 #5 ("an admin cannot mint a template
  key") stands unchanged; §5 explains how.
- **Modules:** 17 (email), 10 (users and subscribers screens), 03/10
  (permissions), 14 (E2E).

## 1. What the owner asked for

> There should be a separate page where the admin can send an email to all
> users, or choose by group, the same groups we already select users by. The
> custom email template can be designed in Templates. The admin writes a
> custom email and it is sent in the background to the selected group.
>
> There should also be an option to email a single user from the users list
> and the subscribers list, and from a specific user's details page, where the
> admin can send an email to that user only.

That is three features:

| #     | Feature                                                                                                                                                    | Where                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **A** | **Compose and send to groups.** A page where the admin writes a free-form email, chooses one or more groups, and sends it now or later, in the background. | New page (§6)                     |
| **B** | **Designs.** Reusable email layouts the admin builds once in Templates and starts a custom email from.                                                     | Settings → Email → Templates (§5) |
| **C** | **Email one person.** A "Send email" action on a user row, a subscriber row, the user detail page and the subscriber detail page.                          | Four existing screens (§7)        |

"Notifications" in this plan means **email only**. SMS, push and in-app
notifications are not part of it (§15).

## 2. Relation to changes-54

changes-54 designs everything a bulk email needs except a free-form body:

| Piece                                                                                                                        | Owner     | changes-55                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `EmailCampaign` + `EmailCampaignRecipient` tables                                                                            | 54 §6     | **Reused.** Gains two kinds, a nullable `targetId` and a content table (§8).                               |
| The groups: `ANNOUNCEMENT_AUDIENCES` (all users, active, verified, inactive, subscribers, learners of a course, hand-picked) | 54 §4     | **Reused** as-is. These are "the groups we already select users by". One optional new group, `staff` (E3). |
| Dedupe by normalised email, enforced by `@@unique([campaignId, email])`                                                      | 54 §4     | Reused. A person in two groups gets one email.                                                             |
| `EmailSuppression`, one-click unsubscribe, `EMAIL_LINK_SECRET`, postal address                                               | 54 §5, §9 | Reused. Every bulk custom email carries the unsubscribe link and the postal address.                       |
| Queue, atomic claim, pacing, at-most-once, `POST /api/cron/announcements`                                                    | 54 §8     | Reused. The runner renders from the campaign's own content for the new kinds (§8.3).                       |
| `createSendSession`                                                                                                          | 54 §8.2   | Reused. Gains a "content" mode (§8.3).                                                                     |
| Detail screen: progress, failed list, Retry, Cancel                                                                          | 54 §10.4  | Reused unchanged.                                                                                          |

**Build order (E1).** Settled by events: changes-54 shipped in full before
this plan was accepted, so everything in the table above exists and changes-55
starts at C1.

### 2.1 One name for the section (E2)

changes-54 shipped its section as **Announcements** (`/keystone/announcements`,
permission group `announcements`). With custom and direct emails beside the
course announcement, that name describes one kind out of three, and
`PromotionKind.ANNOUNCEMENT` already means something else on this site.

**Accepted, as a label change (ADR-172 #8).** The sidebar entry, headings and
page titles read **Email campaigns**. The route `/keystone/announcements`, the
permission keys `announcements.*` and every internal identifier keep their
shipped names: the catalog never renders them (code-style #5), and renaming
them would migrate live permission grants for no visible difference. The rest
of this plan uses the shipped names.

## 3. Why this needs an ADR

- **ADR-171 (changes-54 §7, §17)** fixes the body of a campaign to the
  template: a campaign sets only a subject and a 500-character note, "so an
  announcement is never a new unreviewed HTML document". Feature A is exactly a
  new HTML document per send. ADR-172 allows it **for the `CUSTOM` and
  `DIRECT` kinds only**, and records what replaces the review a fixed template
  gave: the same server-side sanitiser, a closed variable set, a mandatory
  test send before a bulk send (§6, step 3), and the `announcements.send` key
  separate from `announcements.create`.
- **ADR-078 #5** says an admin cannot mint a template key, "because code
  decides when an email is sent". Designs (feature B) do not touch it: a
  design is **not** an `EmailTemplate` row, has no key, and is never sent by
  code. It is only a starting point a person copies into an email a person
  sends. ADR-172 states this so the next reader does not "simplify" designs
  into template rows.
- **Direct one-to-one email (feature C)** is a new kind of send with its own
  consent rule (§7.3). ADR-172 records it.

## 4. Shape

```
Feature B  Settings → Email → Templates → "Custom designs" → New design
           (name, RICH or HTML body, isolated preview)          ── stored, never sent

Feature A  Email campaigns → New → "Custom email"
  1. Content    start from a design or blank → subject, preheader, body
  2. Audience   the changes-54 group cards, live "N unique recipients"
  3. Review     checklist, "Send me a test" (required), Send now | Schedule
        │
        ▼  same queue, same runner, same cron as changes-54
     one email per unique address, rendered from THIS campaign's body

Feature C  Users list row ⋯ / user detail header / subscriber row ⋯ / subscriber detail
           → "Send email" dialog (design or blank, subject, body) → Send
        │
        ▼  a DIRECT campaign with exactly one recipient, sent at once in after()
```

## 5. Designs (feature B)

### 5.1 Model

```prisma
model EmailDesign {
  id          String        @id @default(cuid())
  name        String        @db.VarChar(120)   // admin-facing, e.g. "Monthly update"
  description String?       @db.VarChar(300)
  mode        EmailBodyMode @default(RICH)     // RICH = inside the shared shell; HTML = a full document
  subject     String?       @db.VarChar(200)   // a suggested subject, copied into the email
  preheader   String?       @db.VarChar(200)
  bodyHtml    String        @db.MediumText     // sanitised on save (sanitizeEmailHtml)
  archivedAt  DateTime?
  createdById String
  updatedById String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([archivedAt, updatedAt])
  @@map("email_designs")
}
```

- **English only, no translation rows.** A design is a starting layout that
  gets copied, not something a reader receives. The words a reader receives
  live in the campaign (§8.1), which is where languages are handled.
- **Copied, never linked.** Starting an email from a design copies its
  subject, preheader, mode and body into the campaign. Editing or archiving
  the design later changes no draft and no email already sent. The campaign
  keeps `designId` for "made from" only.
- **Archive, not delete.** An archived design is hidden from the pickers and
  stays listed under an "Archived" filter. There is nothing to cascade, so a
  hard delete is also safe; archive is the default because it is the undo
  (code-style #7).

### 5.2 Where it is edited

**Settings → Email → Templates** gets two sections on one page:

1. **System emails:** the existing registry list, unchanged (password reset,
   verification, newsletter, support, and changes-54's course announcement).
2. **Custom designs:** a `DataTable` with Name · Mode · Updated · Updated by,
   "New design" in the toolbar (ADR-106), row actions Edit · Duplicate ·
   Archive/Restore.

The design editor **reuses the system template editor's parts**: the rich-text
editor with the email toolbar, the HTML source view, the RICH/HTML switch,
and the isolated preview route (`POST /keystone/api/email/preview`, which gains
a `design` mode). No second editor and no second preview path (email
SKILL invariant #8).

### 5.3 Rules

- **Sanitised on save** with `sanitizeEmailHtml(html, mode)`, the same
  allowlist system templates use (security.md #8).
- **Closed variables.** A design may use `GLOBAL_EMAIL_VARIABLES`
  (`site.name`, `site.url`, `logo.url`, `year`, `recipient.name`,
  `recipient.email`) plus `unsubscribe.url`. Any other `{{name}}` is refused
  by the save schema and named in the field error, which is the protection
  `emailTemplateSaveSchema` already gives system templates.
- **An HTML-mode design must contain `{{unsubscribe.url}}`.** A RICH design
  gets the unsubscribe link and postal address from the shared shell footer.
  An HTML design replaces the shell, so without the variable a bulk email
  would go out with no way to opt out. The save schema refuses it with a
  message that says why.
- **Images** come from the media picker (new category `email`, E7) and render
  as absolute URLs through `absoluteUrl()`. An SVG shows a warning in the
  editor ("Gmail and Outlook do not show SVG images"), the reason changes-54
  §7 renders raster covers.
- **Seed:** one design, **"Plain message"** (logo, a heading, a paragraph, a
  button), created only if missing and never overwritten. The composer also
  always offers **Blank**, which is code, not a row.

## 6. The composer (feature A, kind `CUSTOM`)

**Route:** `/keystone/announcements/new?kind=custom`. The list's "New" button is a
menu: **Custom email** · **Course announcement** (changes-54). Same three-part
layout as changes-54 §10.3, with a different first step.

1. **Content**
   - "Start from": a picker over active designs plus Blank. Changing it after
     typing asks first (it replaces the body).
   - **Subject** (required, ≤ 200, CR/LF stripped), **preheader** (optional).
   - **Body**: the email rich-text editor, or the HTML source view for an
     HTML-mode email. A variable menu inserts only the allowed variables
     (§5.3).
   - **Languages** (only when more than one locale is active; today only `en`
     is, so the tab strip is absent): one tab per active locale. A missing
     language falls back to the default for readers in that locale, and the
     tab says so. No machine translation in v1 (E6).
   - A live preview through the isolated preview route (`campaign` mode), in
     light layout, desktop and phone width, per language.
2. **Audience**: the changes-54 cards unchanged: All users · Active users ·
   Email verified · Inactive users · Newsletter subscribers · Learners of a
   course · Select users. Plus **Staff**, if E3 is yes. The same footer:
   "1,204 unique recipients (38 duplicates and 12 unsubscribed people
   removed)".
3. **Review & send**
   - Summary: subject, languages, groups, unique count.
   - The blocking checklist of changes-54 §8.1 without the course line
     (`email.enabled` on · the `campaign.custom` sender switch on · postal
     address set), plus one line for this kind: **a test has been sent since
     the last edit.** A free-form body has had no other review, so the
     author must see it in a real inbox before 1,000 people do. Editing the
     content clears the tick.
   - **Send me a test** sends to the admin's own address, writes no recipient
     row, and records `lastTestedAt` + the content hash on the campaign.
   - **Send now** goes through `ConfirmDialog` with the number. **Schedule**
     uses `DateTimePicker` in the editor's local time (ADR-071).

**After Send the content is frozen.** The runner renders from the campaign's
stored content, not from the design and not from anything editable. A
SENDING, SENT or SCHEDULED campaign's content is read-only. Cancelling a
scheduled one returns it to DRAFT, where it can be edited again.

## 7. Email one person (feature C, kind `DIRECT`)

### 7.1 Entry points

| Screen            | File                                                             | Where                                       | Shown when                                                           |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Users list        | `keystone/users/users-table.tsx` (row menu, L208–252)            | ⋯ → **Send email**                          | the viewer holds `announcements.direct`                              |
| User detail       | `keystone/users/[id]/page.tsx` (header, L140–175)                | **Send email** button beside Reset password | same, and the user is not soft-deleted                               |
| Subscribers list  | `keystone/newsletter/subscribers-table.tsx` (row menu, L153–190) | ⋯ → **Send email**                          | `announcements.direct` + `newsletter.view`, subscriber not `PENDING` |
| Subscriber detail | `keystone/newsletter/[id]/subscriber-actions.tsx`                | **Send email** button                       | same                                                                 |

No bulk "Send email" is added to the users table's selection bar: sending to
many people is feature A, which has the audience count, the test-send gate and
the confirm dialog. Otherwise a 500-row selection would be a bulk send with
none of them.

### 7.2 The dialog

`SendEmailDialog` (one component, four call sites) uses `DialogTitle`
"Email {name}" + `DialogDescription` (code-style #11) and contains:

- **To:** name and address, read-only.
- **Start from:** design picker + Blank (default: "Plain message").
- **Subject** and **Body** (the email editor with a trimmed toolbar: bold,
  italic, link, list, button). `{{recipient.name}}` works as in a design.
- **Replies go to me** (switch, off by default, leading its row per
  code-style #25): sets `Reply-To` to the staff member's own address instead
  of the sender setting. That is useful for a real conversation, and it is a
  choice because it exposes the staff address.
- **Preview** (a collapsible pane using the same preview route) and **Send**.
  There is no required test step: the author is looking at the one recipient's
  exact email.
- A notice when the person has unsubscribed from campaigns (§7.3).

On Send: a toast, then the dialog closes. The email is sent within seconds
in `after()`. The user detail page gains an **Emails** tab listing what was
sent to this person (direct and bulk, from recipient rows, which are kept 90
days), each linking to its campaign. Its rows are gated `email.log.view`.

### 7.3 Rules

- **A `DIRECT` campaign is an `EmailCampaign` with exactly one recipient**,
  created and queued in one call, `status = SENDING`, and drained for that
  campaign id in `after()`. There is no separate send path: it gets the
  delivery log row, the audit row, retry and the at-most-once rule for free.
  The cron tick picks it up if `after()` did not finish.
- **Who can be emailed:** any account (learner or staff) that is not
  soft-deleted, including banned and suspended accounts, since the message may
  be telling them why. A subscriber-only contact in `ACTIVE` or
  `UNSUBSCRIBED` status; never `PENDING` (an unconfirmed address never
  proved it is theirs).
- **Consent (E4, accepted):**
  - To an **account holder**, a direct email is correspondence, not
    marketing. A campaigns suppression does **not** block it; the dialog
    shows "This person has unsubscribed from campaign emails. Send only if
    this is about their account."
  - To a **subscriber-only contact**, whose only relationship with the site
    is the mailing list, a suppression or `UNSUBSCRIBED` status **blocks**
    the send, and the menu item is absent.
  - Every direct email still carries the shell footer with the unsubscribe
    link. One render path, and a way out is never wrong.
- **Rate brake:** at most **30 direct emails per staff member per hour**
  (`DIRECT_SEND_LIMIT_PER_HOUR`, a constant with its reason in a comment,
  not a setting). It stops a compromised or careless account from turning
  the dialog into a bulk tool one row at a time. The 31st is refused with its
  own error code, and the toast names it.

## 8. Data and sending changes (on top of changes-54 §6 and §8)

### 8.1 Schema delta

```prisma
enum AnnouncementKind { COURSE CUSTOM DIRECT }   // was { COURSE }

model EmailCampaign {
  // … every changes-54 field …
  targetId      String?  @db.VarChar(191)  // was required; null for CUSTOM and DIRECT
  designId      String?                    // "made from"; provenance only, no FK
  replyToSelf   Boolean  @default(false)   // DIRECT: Reply-To = the creator's address
  lastTestedAt  DateTime?
  testedHash    String?  @db.VarChar(64)   // content hash at the last test send (§6 step 3)
  contents      EmailCampaignContent[]
}

model EmailCampaignContent {
  id          String        @id @default(cuid())
  campaignId  String
  locale      String        @db.VarChar(10)
  subject     String        @db.VarChar(200)
  preheader   String?       @db.VarChar(200)
  mode        EmailBodyMode @default(RICH)
  bodyHtml    String        @db.MediumText   // sanitised on save
  updatedAt   DateTime      @updatedAt
  campaign    EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, locale])
  @@map("email_campaign_contents")
}
```

- A `COURSE` campaign has no content rows. It keeps changes-54's `subject` +
  `message` override on the campaign row.
- A `CUSTOM` or `DIRECT` campaign must have a content row for the default
  locale before it can be sent or tested.
- **Retention:** content rows are kept with the campaign, unlike recipient
  rows. They are the record of what was sent, they hold no secret and no
  address, and changes-54 already keeps the campaign row indefinitely. ADR-078
  #10 governs `EmailDelivery`, which still holds no body.
- **Size:** a body is capped at 200 KB after sanitising, checked by the
  contracts schema, so one email cannot become a multi-megabyte send ×
  10,000.
- Migration: joins changes-54 N1's if unwritten, else
  `YYYYMMDDHHMMSS_custom_emails_changes55_adr172`.

### 8.2 Registry (`@repo/contracts` / `@repo/email`)

Two keys, **`campaign.custom`** and **`campaign.direct`**, in a small registry
of their own, **`CAMPAIGN_EMAILS`** (`@repo/contracts` `custom-emails.ts`), not
in `EMAIL_TEMPLATES` (ADR-172 #4):

- Their body and subject come from the campaign. They have no `EmailTemplate`
  row, no default content and no translations, so the Templates screen shows
  no body editor for them. A body field that nothing reads would break
  code-style #28, and every consumer of `EMAIL_TEMPLATES` (the seed, the
  defaults, the editor, `check:email-templates`) assumes a key owns content.
- The sender is the site-wide sender (Settings → Email → Sender). A DIRECT
  email may set `Reply-To` to its author (§7.2).
- The off switch is `email.enabled`, as for every email. There is no
  per-key on/off row: the permission keys decide who can send.
- Two keys, not one, so the delivery log can filter direct from bulk.
- Variables: globals + `unsubscribe.url`, which is required (every message
  carries the footer, ADR-172 #6).

_(Changed from the first draft of this plan, which put both keys in
`EMAIL_TEMPLATES` with a `content: "campaign"` flag and an on/off row. Reading
the shipped code showed ten consumers of that registry that would each need an
exemption.)_

### 8.3 Runner

`createSendSession` (changes-54 N2) gains a second form:
`createSendSession({ key: "campaign.custom", contents })`. It renders each
recipient from the content row for their locale (§6 fallback rule) through
the existing `renderEmail` → shell → sanitiser path. `drainAnnouncementQueue`
picks the form by `campaign.kind`. Everything else in changes-54 §8.2 applies
unchanged: claim, pacing, per-recipient suppression re-check (skipped for a
DIRECT email to an account holder, §7.3), retries, at-most-once, completion,
pause when `email.enabled` is off.

## 9. Permissions (ADR-083)

In the `announcements` group (ADR-171 #11), seeded to
`super_admin` and `admin` only:

| Key                              | Grants                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| `announcements.view`             | the list and detail (changes-54)                                      |
| `announcements.create`           | drafts, editing content, test sends (changes-54, now covering custom) |
| `announcements.send`             | send, schedule, cancel, retry (changes-54, now covering custom)       |
| **`announcements.direct`** (new) | the "Send email" dialog on the four screens                           |

- **Designs** are edited under the existing **`email.templates.update`**
  (viewed under `email.templates.view`). They live on the Templates screen,
  and a design is harmless until someone with `announcements.send` sends it.
- **The direct dialog also needs the right to see the person:** `users.view`
  on the user screens and `newsletter.view` on the subscriber screens. The
  server action re-checks both, not only the button.
- `role-exclusions.ts` is unchanged. `content_manager`'s pinned set is
  unchanged (`permission-groups.test.ts`).
- Every action: STAFF gate → `requirePermission` → contracts parse →
  `@repo/core`, which writes the audit row. Actions audited:
  `email.design.create/update/archive/restore`,
  `campaign.create/update/test/send/schedule/cancel/retry`, and
  `campaign.direct.send`. The audit row records the recipient's id, never the
  address and never the body.

## 10. Services (`@repo/core`)

| Function                                                                                                                 | Notes                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `listEmailDesigns` / `getEmailDesign` / `saveEmailDesign` / `archiveEmailDesign` / `restoreEmailDesign`                  | sanitise + variable check + HTML-mode unsubscribe rule on save                                                                         |
| `saveCampaignContent(actor, campaignId, locale, input)`                                                                  | DRAFT only; sanitises; clears the test tick when the hash changes                                                                      |
| `sendCampaignTest(actor, campaignId)`                                                                                    | to the actor's own address; stores `lastTestedAt` + `testedHash`                                                                       |
| `queueAnnouncement` (changes-54)                                                                                         | refuses a CUSTOM campaign whose `testedHash` ≠ the current content hash (`test_required`)                                              |
| `sendDirectEmail(actor, { recipient: { kind: "user" \| "subscriber", id }, designId?, subject, bodyHtml, replyToSelf })` | eligibility (§7.3), rate brake, creates + queues the one-recipient campaign in one transaction, returns its id for the `after()` drain |
| `listEmailsSentTo(userId)`                                                                                               | the user detail's Emails tab                                                                                                           |

## 11. Found while planning: fix first (PR C0)

`keystone/users/[id]/page.tsx:270` checks
`user.newsletter?.status === "CONFIRMED"`, but `SubscriberStatus` is
`PENDING | ACTIVE | UNSUBSCRIBED` (`packages/core/src/roles.ts:487–492`
passes it through unchanged). The Newsletter tile on every user's Controls
card is therefore **never ticked**, even for a confirmed subscriber. C0 fixes
it to `"ACTIVE"`, with a regression test (testing.md #2). It is the screen C6
adds the Send email button to, and §7.3 depends on reading that status
correctly.

## 12. PRs

| PR     | Scope                                                                                                                                                                                                                                                                                                                                                     | Done when                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **C0** | ADR-172; this plan; the §11 fix + test                                                                                                                                                                                                                                                                                                                    | `governance:check` green                                      |
| **C1** | Schema + migration (§5.1, §8.1); contracts: `emailDesignSaveSchema`, `campaignContentSchema` (closed variables, HTML-mode unsubscribe rule, 200 KB cap, subject CR/LF), `directEmailSchema`; the two registry keys with `content: "campaign"`; `announcements.direct` in the permission seed; the `email` media category; the "Plain message" design seed | Contracts ≥ 90%; registry + seed tests green; seed idempotent |
| **C2** | `@repo/email`: `createSendSession` content mode; preview route `design` and `campaign` modes; `check:email-templates` learns `content: "campaign"`                                                                                                                                                                                                        | Existing send suites unchanged; render tests for both keys    |
| **C3** | `@repo/core`: §10 services; runner kind switch; direct-send eligibility + rate brake                                                                                                                                                                                                                                                                      | Testcontainers suite (§13) green                              |
| **C4** | Admin: Custom designs on the Templates page + design editor                                                                                                                                                                                                                                                                                               | Admin form/dialog/toolbar convention guards green             |
| **C5** | Admin: the Custom email composer (three steps), list "New" menu, kind column + filter                                                                                                                                                                                                                                                                     | same                                                          |
| **C6** | Admin: `SendEmailDialog` on the four screens; the user detail Emails tab                                                                                                                                                                                                                                                                                  | same                                                          |
| **C7** | E2E (§13); axe on the composer, the design editor and the open dialog; DEVLOG; email + users-employees skill updates; CLAUDE.md module 17 row                                                                                                                                                                                                             | CI green                                                      |

## 13. Tests the plan commits to

- **Contracts:** an undeclared `{{variable}}` is refused in a design, a
  campaign body and a direct body; an HTML-mode body without
  `{{unsubscribe.url}}` is refused; a `javascript:` href is stripped by the
  sanitiser, not merely refused; the 200 KB cap; subject CR/LF stripped; a
  direct recipient kind outside `user | subscriber` is refused.
- **Render:** `campaign.custom` renders a stored body per locale and falls
  back to the default locale; a RICH body gets the shell footer with
  unsubscribe and postal address; `{{recipient.name}}` is escaped.
- **Core integration (Testcontainers MariaDB):**
  - a design edit after a campaign was made from it changes nothing in that
    campaign;
  - a CUSTOM campaign cannot be queued untested, and cannot be queued after an
    edit that followed the test;
  - a sent campaign's content cannot be saved;
  - dedupe across groups holds for CUSTOM exactly as for COURSE (reuses
    changes-54's fixtures);
  - direct: a soft-deleted user and a `PENDING` subscriber are refused; a
    suppressed account holder is sent to, and a suppressed subscriber-only
    contact is refused; the 31st send in an hour is refused; exactly one
    recipient row is created per call;
  - switching `campaign.custom` off pauses bulk custom sends while
    `campaign.direct` still sends.
- **Permissions (asserted at the DB):** each action refuses without its key
  and leaves no row; the direct action refuses with `announcements.direct` but
  without `users.view` (or `newsletter.view`); the menu item and button are
  absent without the keys; a learner session 404s on `/keystone/announcements`.
- **E2E (Mailpit):**
  1. Create a design → compose a custom email from it → pick Verified +
     Subscribers with one overlapping address → Send is blocked until a test
     is sent → send → cron tick → Mailpit holds exactly one message per
     address, rendered from the design.
  2. Users list → ⋯ → Send email → Mailpit holds one message, and the user's
     Emails tab lists it.
  3. Subscriber detail → Send email → one message, and it carries the
     unsubscribe link.

## 14. Owner decisions (all accepted 2026-09-30)

| #      | Question                                                                                 | Decision                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** | Build order: course announcements first, or custom emails first?                         | Shared infrastructure first, then custom emails. **Moot:** changes-54 shipped in full before this plan was accepted                                 |
| **E2** | Rename the section from "Announcements" to **Email campaigns**?                          | **Yes, as a label** (§2.1, ADR-172 #8). changes-54 had shipped, so the route and the `announcements.*` keys keep their names                        |
| **E3** | Add a **Staff** group so a custom email can go to all employees?                         | **Yes, CUSTOM only**, gated additionally on `employees.view`. Course announcements stay learners-only                                               |
| **E4** | Direct email to someone who unsubscribed (§7.3)                                          | **Account holders: allowed with a notice. Subscriber-only contacts: blocked**                                                                       |
| **E5** | Require a test send before every bulk custom email?                                      | **Yes**. It is the review a fixed template gave for free                                                                                            |
| **E6** | Machine translation of a custom email's body ("Translate with Google" per language tab)? | **Not in v1.** Only `en` is active, and a bulk email in a machine language is sent before anyone reviews it. Revisit when a second locale goes live |
| **E7** | A new media category `email` for images used in emails?                                  | **Yes**, so they are findable and their usage is counted                                                                                            |
| **E8** | Direct-send limit per staff member                                                       | **30 per hour**                                                                                                                                     |

## 15. Out of scope

- SMS, push and in-app notifications. This plan is email only.
- Attachments. Link to a file in the media library instead.
- Pasting arbitrary addresses that are neither users nor subscribers
  (changes-54 D4: no consent was given).
- A bulk "Send email" on a users-table selection (§7.1: that is feature A).
- Open and click tracking (changes-54 §14: a privacy decision, not a feature).
- Receiving replies inside the admin. "Replies go to me" sends them to the
  staff member's own mailbox.
- Machine translation of campaign bodies (E6).
- Saved segments and bounce webhooks (changes-54 §14, unchanged).

## 16. As built (2026-09-30)

Where the build departed from the text above, and why. ADR-172 records the
decisions; these are the details a reader would otherwise rediscover.

- **Names follow what changes-54 shipped** (§2.1): the route stays
  `/keystone/announcements`, the keys stay `announcements.*`, and the new key
  is `announcements.direct`. Only the visible label changed to "Email
  campaigns".
- **The campaign keys have their own registry** (§8.2): `CAMPAIGN_EMAILS` in
  `@repo/contracts` `custom-emails.ts`, with no `EmailTemplate` row. There is
  therefore no per-key on/off switch for custom or direct sending;
  `email.enabled` and the permission keys are the controls.
- **The direct dialog uses the full email editor**, with the same Visual/HTML
  switch as the template editor (§7.2 said "a trimmed toolbar").
  `RichTextEditor` has no toolbar-trimming option, and adding one for a
  single dialog was not worth a second editor configuration.
- **"Replies go to me" does not print the author's address**: the pages do
  not have it without a new read, and the hint says "your own email address".
- **Direct emails are left out of the Email campaigns list by default**
  (a Type filter shows custom or course emails). They appear on the person's
  Emails tab and in the delivery log; a hundred of them would bury the
  broadcasts.
- **"New design" sits on the Templates tab's title row** through
  `<HeaderActions>` (ADR-140 §3 superseded the table-toolbar placement §5.2
  assumed). `/keystone/settings/email/designs` redirects to the Templates tab,
  so the breadcrumb between a design and the list never 404s.
- **The newsletter screen's notice changed.** It still said "Sending to this
  list is not available yet" (ADR-080 #8), which changes-54 had made untrue.
  It now points to Email campaigns and to the row's Send email.
- **The public unsubscribe wording changed in `en` and `ar`.** One click stops
  every campaign kind, so "Stop course announcements" had become inaccurate;
  it now speaks of "emails about new courses and other news". The course
  announcement template's own default footer still names course
  announcements, because that email is one.
- **The audience cards became one shared component** (`audience-cards.tsx`),
  used by the course editor and the composer, so the two cannot drift.
