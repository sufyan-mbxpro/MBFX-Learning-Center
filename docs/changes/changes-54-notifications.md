# changes-54 — Announcement emails: tell chosen audiences about new content

- **Status:** Complete — N0–N7 landed 2026-09-30 (three DEVLOG entries; the N1–N6 one records the deviations). The owner
  answered D1–D8 on 2026-09-30 (§16); the plan below is written to those
  answers. D5 was answered against the recommendation: a SCHEDULED course can
  be announced in Phase 1, and the email waits until the course is live
  (§8.1).
- **Decision record:** **ADR-171** (`docs/memory/decisions/ADR-171-announcement-emails.md`),
  Accepted 2026-09-30. It supersedes **ADR-080 #8** ("No campaigns")
  and the last sentence of **ADR-078 #11** ("Campaign sending waits for the
  changes-12 worker"). The rest of both ADRs stands.
- **Modules:** 17 (email: templates, sending, unsubscribe), 11 (content: the
  course entry point), 10/03 (a new permission group), 12 (a public
  unsubscribe page), 14 (E2E).
- **Phase 1 = courses only.** Videos, news and glossary are Phase 2 (§14). The
  design has a place for each from day one, so adding one is a registry entry,
  a template and an editor button.

## 1. What the owner asked for

> When we add a new course, or other content like videos, glossary or news,
> we want to notify our users. There should be an option to send an email
> about a specific course to: specific users, all users, verified users, only
> subscribers, or hand-picked (custom) users, as in the reference picture. The
> admin selects the categories of users, and the email goes to those users.
> **Don't send a duplicate email if a user is in more than one category.**
>
> There will be specific templates for courses, videos and news. After the
> categories are selected, the email is sent **in the background** using the
> designed template. **In the first phase we complete only courses.**

The reference picture is a four-step campaign screen: 1. Content · 2. Subject
& sender · 3. Audience · 4. Review & send. The Audience step shows selectable
cards, each with an icon, a label, a one-line description and a live count:
All users · Active users · Email verified · KYC verified · Inactive users ·
Top depositors · Segment · Select users.

**What carries over, and what doesn't.** This platform has no KYC status, no
deposits and no CRM, so *KYC verified* and *Top depositors* have no data behind
them and are **not built**. Offering them would mean a card counting zero, or
one that counts something it doesn't say. *Segment* (saved rules) is Phase 2
(§14). Everything else maps onto columns that already exist (§4).

## 2. Why this needs an ADR

Two accepted decisions forbid this feature as written:

- **ADR-080 #8:** "No campaigns. No composer, no audience builder, no bulk
  send. Bulk delivery needs the changes-12 worker, and a brief of its own."
- **ADR-078 #11:** "No queue … Campaign sending waits for the changes-12
  worker."

The changes-12 worker (BullMQ + `apps/worker`) was never built, and nothing
schedules it. Since those ADRs, **ADR-162** has established a database-backed
job queue in production use: `TranslationJob`, an atomic claim token, stale
leases, backoff, drained by `POST /api/cron/translate` plus an `after()` kick.
It was chosen over BullMQ for the same reason that applies here: "new
infrastructure to run and secure for one workload that a table handles."

**ADR-171 decides:** announcement delivery uses the ADR-162 pattern on its own
table. This plan is the "brief of its own" ADR-080 #8 asked for. ADR-078's
reasoning against retries does not apply here: that ADR rejected *storing
rendered bodies* because a reset link would sit in the database. An
announcement recipient row holds no body; the runner re-renders from the
template at send time, which is exactly what ADR-078 said a worker would do.

ADR-171 must also record:
- the consent rule (§5);
- the FOURTH anonymous public write, the announcement unsubscribe (§9), with
  its guard stack. Newsletter signup, `/support` and the promotion counters
  are the first three;
- the new env secret `EMAIL_LINK_SECRET` (§9.1). It is an env var, so it is
  not a security.md #10 exception.

## 3. Shape of the feature

An **announcement** (`EmailCampaign`) is one email about one piece of
content, sent once to a deduplicated set of recipients.

```
Admin: Announcements → New          (or "Announce" in the course editor)
  1. Content     pick a PUBLISHED (or SCHEDULED, D5) course → preview card
  2. Message     subject (template default, overridable) + optional short note
  3. Audience    cards with live counts, several may be selected,
                 + "Select users" picker → live "N unique recipients"
  4. Review      summary, "Send me a test", Send now | Schedule
        │
        ▼  (server action: announcements.send)
  queueAnnouncement()  → resolve audiences, union, DEDUPE BY EMAIL,
                          drop suppressed, insert recipient rows, status SENDING
        │
        ▼  after() kick  +  POST /api/cron/announcements (every minute)
  drainAnnouncementQueue() → claim 50 recipients → re-check suppression →
                              render the template in the recipient's language →
                              send → mark SENT / retry / FAILED
        │
        ▼
  Campaign detail: live progress, sent / failed / skipped, Cancel
```

## 4. Audiences (`ANNOUNCEMENT_AUDIENCES`, a code registry in `@repo/contracts`)

The set of audiences is **code**, the ADR-042 split: each is a key with a
catalog label, a description and an icon, resolved by one function in
`@repo/core`. Every audience starts from the **eligible base**:

> `User`: `userType = LEARNER`, `deletedAt IS NULL`, `banned` not true,
> `status ≠ SUSPENDED`.
> `NewsletterSubscriber`: `status = ACTIVE`.
> Then any address in `EmailSuppression` (§5) is removed.

| Key | Card label | Rule on top of the base | Source |
|---|---|---|---|
| `all_learners` | All users | every eligible learner | `User` |
| `active` | Active users | `status = ACTIVE` | `User.status` |
| `verified` | Email verified | `emailVerified = true` | `User.emailVerified` |
| `inactive` | Inactive users | `lastLoginAt` is null or older than `announcements.inactiveDays` (setting, default **30**) | `User.lastLoginAt` |
| `subscribers` | Newsletter subscribers | ACTIVE subscribers only, **including those with no account**. A subscriber who has unsubscribed is never sent to (owner, D1) | `NewsletterSubscriber` |
| `course_learners` | Learners of a course | enrolled in one or more courses the admin picks (e.g. "people who took Forex Basics" for a follow-up course) | `CourseEnrollment` |
| `custom` | Select users | hand-picked accounts, searched by name or email, at most 500 | `User` ids |

**Rules:**

- **Selection is a UNION.** A person matching two cards is one recipient.
- **Deduplication is by normalised email** (trimmed, lower-cased). A learner
  who is also a subscriber under the same address is **one** recipient. The
  account row wins, so their name and language come from `User`.
  - The dedupe is enforced **in the database**, not only in code:
    `EmailCampaignRecipient` has `@@unique([campaignId, email])`, and the
    snapshot inserts with `createMany({ skipDuplicates: true })`. A bug in the
    union, or a double-clicked Send, still cannot produce two rows for one
    address in one announcement.
- **Staff are never in a card** (owner, D3). STAFF accounts are excluded from every
  audience, including `custom`: the picker searches learners only. Testing
  goes through "Send me a test".
- **Custom means existing people only** (owner, D4). Pasting arbitrary addresses is not
  offered, because an address that never signed up or subscribed gave no
  consent (§5), and it would turn the tool into a cold-mailing form.
- **Counts are live and honest.** Each card shows its own count after
  suppression. The footer shows **"N unique recipients"** for the current
  selection, computed by the same resolver the send uses, so the number
  confirmed is the number queued (± people who unsubscribe in between).
  Counting runs in SQL (`COUNT(DISTINCT LOWER(email))` across a `UNION`),
  never by loading rows into Node.
- **The audience is snapshotted at send time** (or when a scheduled send falls
  due), not when the draft is saved. Someone who signs up between drafting and
  sending is included; someone who unsubscribes is not.
- **Enrolled learners of THIS course** are excluded automatically: they
  already have it.
- **`course_learners` and `custom`** store their ids in the campaign's
  `audience` JSON, validated by the contracts schema: ≤ 20 courses, ≤ 500
  users.

## 5. Consent and suppression — **D1: soft opt-in (decided)**

Announcing a new course to people who registered is marketing email, not a
transactional one. Two things make it acceptable:

1. **Every announcement carries a working one-click unsubscribe** (the
   `List-Unsubscribe` headers + a footer link), and one click is honoured
   forever.
2. **Every announcement carries the sender's postal address.** The
   `email.postalAddress` setting already exists for this (labelled "Postal
   address (bulk mail)"). **An announcement cannot be sent while it is
   empty**; the Review step says why and links to Settings → Email.

**D1: who counts as having agreed?** **Decided: (a)** (owner, 2026-09-30).
The owner's rule, per card:

- **Newsletter subscribers:** only ACTIVE subscribers receive it. Anyone who
  has unsubscribed is never sent to.
- **All users** (and the other learner cards): every eligible learner, as §4
  lists, under soft opt-in, with the sign-up line and one-click unsubscribe.

| Option | Who can be emailed | Trade-off |
|---|---|---|
| **(a) Soft opt-in** *(recommended)* | Registered learners (they have a relationship with the site, and the email is about the same kind of thing they signed up for), plus ACTIVE newsletter subscribers. Both can opt out in one click. A line is added under the sign-up form: "We'll occasionally email you about new courses. You can unsubscribe at any time." | Matches what the owner asked for ("all users"). The sign-up line is needed so the expectation is set at the moment of registration. |
| (b) Explicit opt-in | Only learners who tick a new "Email me about new courses" box, plus newsletter subscribers | Smallest legal risk; "All users" would reach almost nobody at first. |

**`EmailSuppression`** is ONE email-keyed table, whatever the option: `email`
(unique, normalised), `scope` (`ANNOUNCEMENTS`), `reason` (`UNSUBSCRIBED` ·
`ADMIN` · later `BOUNCE` / `COMPLAINT`), `createdAt`.

- **It is keyed by address, not by user**, so it covers a learner and a
  subscriber-only contact the same way. The bounce and complaint webhooks of
  §14 can write to it later without a schema change.
- **It is never purged.** It is the record that someone said no; deleting it
  would re-enrol them.
- **It is separate from the newsletter.** Unsubscribing from announcements
  does not unsubscribe from the newsletter, and the reverse holds too. The
  confirmation page offers the second as an explicit, separate button (§9).
- **An unsubscribed newsletter subscriber** (`UNSUBSCRIBED`) is not in the
  `subscribers` audience, but *is* still a learner if they have an account.
  Their newsletter "no" is not treated as an announcements "no" (owner,
  **D6**: the lists stay separate).
- **An admin can add or remove a suppression** on the user's detail screen
  (`announcements.send`, audited). Removing one is only allowed for
  `reason = ADMIN`; a person's own unsubscribe cannot be undone by staff.

## 6. Data model (`@repo/db`)

```prisma
enum AnnouncementKind      { COURSE }          // Phase 2: VIDEO_TOPIC ARTICLE GLOSSARY_TERM
enum AnnouncementStatus    { DRAFT SCHEDULED SENDING SENT CANCELLED }
enum AnnouncementRecipientStatus { PENDING SENDING SENT FAILED SUPPRESSED SKIPPED }
enum EmailSuppressionScope { ANNOUNCEMENTS }
enum EmailSuppressionReason { UNSUBSCRIBED ADMIN BOUNCE COMPLAINT }

model EmailCampaign {
  id              String   @id @default(cuid())
  kind            AnnouncementKind
  targetId        String   @db.VarChar(191)   // Course.id; no FK — kinds point at different tables
  name            String   @db.VarChar(160)   // admin-facing label, e.g. "Forex Basics — launch"
  subject         String?  @db.VarChar(200)   // null = the template's own subject, per language
  message         String?  @db.VarChar(500)   // optional plain-text note, escaped like any variable
  audience        Json                         // { keys: string[], courseIds?: string[], userIds?: string[] }
  status          AnnouncementStatus @default(DRAFT)
  scheduledFor    DateTime?
  sendWhenLive    Boolean  @default(false)     // D5: target is SCHEDULED; start when it becomes public
  snapshotAt      DateTime?
  startedAt       DateTime?
  finishedAt      DateTime?
  recipientCount  Int      @default(0)         // aggregate counters survive the 90-day recipient purge
  sentCount       Int      @default(0)
  failedCount     Int      @default(0)
  skippedCount    Int      @default(0)
  createdById     String
  sentById        String?
  cancelledById   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  recipients      EmailCampaignRecipient[]

  @@index([status, scheduledFor])
  @@index([kind, targetId])
  @@map("email_campaigns")
}

model EmailCampaignRecipient {
  id            String   @id @default(cuid())
  campaignId    String
  email         String   @db.VarChar(255)     // normalised; the dedupe key
  userId        String?                       // the account, when there is one
  subscriberId  String?                       // the subscription, when there is one
  name          String?  @db.VarChar(255)
  locale        String   @db.VarChar(10)
  status        AnnouncementRecipientStatus @default(PENDING)
  attempts      Int      @default(0)
  runAfter      DateTime @default(now())
  claimToken    String?  @db.VarChar(40)
  claimedAt     DateTime?
  lastError     String?  @db.VarChar(40)      // a taxonomy code, never a provider message (ADR-162 #1)
  deliveryId    String?                       // the EmailDelivery row, for the log link
  sentAt        DateTime?
  campaign      EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, email])
  @@index([status, runAfter])
  @@index([claimToken])
  @@index([campaignId, status])
  @@map("email_campaign_recipients")
}

model EmailSuppression {
  id        String   @id @default(cuid())
  email     String   @db.VarChar(255)
  scope     EmailSuppressionScope
  reason    EmailSuppressionReason
  createdById String?                         // null when the person did it themselves
  createdAt DateTime @default(now())

  @@unique([email, scope])
  @@map("email_suppressions")
}
```

**`EmailDelivery` gains `campaignId String?`** (indexed, no FK), so the
delivery log can filter by announcement. ADR-078 #10 is unchanged: the row
still holds no body and no variables.

**The recipient row holds no rendered content.** `name` and `locale` are
copied at snapshot so the runner needs no join per send; everything else is
read at send time.

**Retention** (added to `/api/cron/housekeeping`):
- recipient rows are deleted **90 days after the campaign's `finishedAt`**,
  the `EmailDelivery` rule: they are a list of addresses;
- the campaign and its counters are kept;
- `EmailSuppression` is kept (§5).

Migration name: `YYYYMMDDHHMMSS_announcements_changes54_adr171`.

## 7. The template (`@repo/email`)

A new `EMAIL_TEMPLATES` entry, **`announcement.course`**:
- `audience: "public"`, so it is translated per active locale (ADR-043);
- `critical: false`.

| Variable | Kind | Value |
|---|---|---|
| `course.title` | text | the course title in the recipient's language, else English |
| `course.summary` | text | `CourseTranslation.summary`, plain text, ≤ 300 chars |
| `course.level` | text | the difficulty label from the catalog, in the recipient's language |
| `course.lessonCount` | text | `Course.lessonCount` (the reachable count, ADR-081 #2) |
| `course.url` | **URL** | absolute: `siteUrl()` + `coursePath(locale, …)` |
| `course.coverUrl` | **URL** | absolute raster image (below) |
| `campaign.message` | text | the optional note; empty string when none |
| `unsubscribe.url` | **URL** | the §9 link |
| globals | | `site.name`, `site.url`, `logo.url`, `year`, `recipient.name` |

**Constraints this design works within** (all from ADR-078, all kept):

- **Substitution only.** There are no loops or conditionals (ADR-078 #6
  rejects a template language with logic). Every variable therefore always
  has a value:
  - **`course.coverUrl` always resolves.** It is the uploaded cover when one
    exists. Otherwise it is a committed **raster** per track
    (`/email/track-forex.png`, `/email/track-crypto.png`), rendered once from
    the existing generated art by `scripts/generate-home-art.mjs`. The web
    covers are SVG, and Gmail and Outlook do not render SVG images.
  - **An empty `campaign.message`** renders as nothing, because the default
    body wraps it in a block that collapses when empty.
- **Values are escaped, and URL variables are validated.** They are escaped
  after sanitising; `<img>` and `src` are already on the email sanitiser's
  allowlist (`sanitize.ts:78,113`). `course.url`, `course.coverUrl` and
  `unsubscribe.url` join `URL_EMAIL_VARIABLES`.
- **Admins edit the template** in the existing Settings → Email → Templates
  editor, with the existing isolated preview. There is no new editor.

**Default content** (`EMAIL_TEMPLATE_DEFAULTS`, which the seed writes and
"Reset to default" restores):
- **Subject:** "New course: {{course.title}}".
- **Preheader:** "{{course.summary}}".
- **Body:** a card with a full-width cover image, a "New course" eyebrow, the
  title, level · N lessons, the summary, the optional note, one button "Start
  the course", then the standard shell footer (footer text, postal address,
  unsubscribe).
- `check:email-templates` guards the default against the registry.

**Language.** Each recipient gets the template in their `locale` if that
locale is **active** and the template has a translation in it; otherwise
English. The course words follow the same rule, checked separately: a
translation is used only when `isIndexableTranslation` allows it (a human
translation, not raw machine output). The course link uses the same locale
the words were taken from, so the email and the page agree. Only `en` is
active today, so Phase 1 sends English.

**Per-campaign overrides** are limited to the **subject** and the **short
note**. The body design stays the template's. That is the "designed template"
the owner asked for, and it keeps each announcement from being a new
unreviewed HTML document.

## 8. Sending in the background (`@repo/core/announcements.ts`)

**All delivery goes through the job queue (owner, D8).** Pressing Send never
emails anyone directly. It writes one `EmailCampaignRecipient` row per
address (the job), and the runners in §8.3 claim, send, retry and finish
those rows. "Send me a test" is the one exception: a single email to the
admin's own address, sent at once, with no recipient row.

### 8.1 Queue

`queueAnnouncement(actor, campaignId)`, called by the Send action:

1. Refuse unless:
   - the campaign is `DRAFT`;
   - the course is **publicly reachable** (`publicCourseWhere()`, the same rule
     the site uses; a draft course would mail a link to a 404), or SCHEDULED
     for a future date, in which case the campaign waits (below, D5);
   - `email.enabled` is on;
   - the `announcement.course` template is active;
   - `email.postalAddress` is set.

   Each refusal has its own error code, and the UI names it.
2. In one transaction at `ReadCommitted` (ADR-056's lesson):
   - lock the campaign row;
   - resolve the audience into recipient rows with `INSERT … SELECT`, in chunks
     of 1,000, using `skipDuplicates`;
   - set `recipientCount`, `snapshotAt`, `startedAt` and `status = SENDING`.
3. Audit `announcement.send` with the audience keys and the count, never the
   addresses.
4. Return. The action kicks the runner in `after()`.

**Scheduled send:** `scheduleAnnouncement` stores `scheduledFor` and sets
`SCHEDULED`. The cron tick runs step 1–2 for any due campaign. It is
re-checked at that moment, so a course unpublished in the meantime makes the
campaign `CANCELLED` with reason `target_unavailable`, not a mail-out of a
dead link.

**A course that is SCHEDULED but not yet live (owner, D5).** It can be
announced, but **no email goes out before the course is live.**

- Step 1's reachability check also accepts a course whose status is SCHEDULED
  and whose `scheduledFor` is in the future. Send (or Schedule) then stores
  the campaign as `SCHEDULED` with `sendWhenLive = true`, and sends nothing.
- The cron tick starts it the first time `publicCourseWhere()` matches the
  course. That is the site's own visibility rule (ADR-071: decided in the
  query), so the tick does not depend on `/api/cron/publish-due` having run.
  If the admin also chose a send time, the email waits for whichever is later.
- If the course's date moves, the announcement moves with it: nothing is
  copied from the course's `scheduledFor`.
- If the course leaves SCHEDULED without going live (back to draft, archived,
  deleted), the campaign becomes `CANCELLED` with `target_unavailable`.
- The Review step says: "This course goes live on 14 Oct 09:00. The email
  will be sent then, not now." The list's status chip reads "Waiting for
  course".

**Twice about one course:** allowed (e.g. a relaunch), but the Content step
warns: "This course was announced on 12 Oct to 1,204 people." Nothing stops a
deliberate second send.

### 8.2 Runner

`drainAnnouncementQueue({ budgetMs })` follows ADR-162:

- **Atomic claim:** one `UPDATE … SET status='SENDING', claimToken=?,
  claimedAt=NOW(3) WHERE status='PENDING' AND runAfter<=NOW(3) ORDER BY id
  LIMIT n`, then the runner reads back its own rows. `n` =
  `email.campaignBatchSize` (default **50**).
- **Pacing:** `email.campaignRatePerMinute`, default **120**. It is a setting,
  not a constant, because the ceiling belongs to the provider. Gmail/Workspace
  SMTP allows a few hundred a day; SendGrid allows thousands a minute. The
  runner sleeps between sends to hold the rate, and stops a batch when the
  drain budget (**240 s**, the translate route's) runs out.
- **Suppression is re-checked per recipient** just before sending. An
  unsubscribe that lands mid-campaign is honoured; the row becomes
  `SUPPRESSED`.
- **Send.** A new `createSendSession(key)` in `@repo/email` loads the
  template, the render context, the sender settings and the transport **once
  per batch** and returns `send({ to, locale, variables, unsubscribe,
  campaignId })`. Today each send makes about eight reads of its own. The
  SMTP driver gains `pool: true` for a session. `sendTemplatedEmail` keeps its
  exact behaviour for every existing caller and is re-implemented on top of a
  one-shot session.
- **Outcomes:**
  - Success: `SENT`, `sentAt`, `deliveryId`, and `sentCount++`.
  - A transient failure (connection, 4xx SMTP, 429/5xx from SendGrid):
    `attempts++`, retry after 1 min, then 5 min, then `FAILED`
    (ADR-162 #6).
  - A permanent refusal (invalid address, 5xx SMTP): `FAILED` at once.
  - Every outcome writes its `EmailDelivery` row as today.
- **At-most-once, deliberately.** A row claimed as `SENDING` whose runner
  died (its lease is older than 10 minutes) becomes **`FAILED` with
  `lastError = lease_expired`**, not `PENDING`. Returning it to `PENDING` could
  send a second copy to someone whose first one did go out before the crash,
  and the owner's one hard rule is no duplicates. A missed email is visible on
  the detail screen and can be re-sent (below). A duplicate cannot be undone.
- **Completion:** when a campaign has no `PENDING` or `SENDING` rows, it
  becomes `SENT` with `finishedAt`, in the same statement that counts, so two
  runners cannot both finish it.
- **Email switched off mid-send:** if `email.enabled` turns off, the runner
  stops claiming; rows stay `PENDING`, and the detail screen shows "Paused:
  email sending is switched off". Rows are not burned as `SUPPRESSED`.
- **Cancel** (`announcements.send`): every `PENDING` row becomes `SKIPPED`
  and the campaign becomes `CANCELLED`. Rows already `SENDING` finish.
- **"Retry failed"** (`announcements.send`): `FAILED` rows go back to
  `PENDING` with `attempts = 0`. The `@@unique` still means one row per
  address, so a retry can only reach people who have not been sent it.

### 8.3 Runners

1. `after()` in the Send action. The first batches go out within seconds of
   pressing Send.
2. **`POST /api/cron/announcements`, every minute.** It has the same shape as
   the other four: POST only, `Bearer CRON_SECRET`, 503 `not_configured` when
   unset, no route-level `dynamic`. It starts due scheduled campaigns and
   drains the rest.
   - A crontab line, a row in `docs/ops/cron.md` and the README deploy
     section.
   - Its first task is to extract the copied bearer check into
     `apps/web/app/api/cron/_lib/cron-auth.ts`, used by all five routes.

Both runners use the atomic claim, so they cannot collide.

## 9. Unsubscribe

### 9.1 The token

The newsletter stores only a **hash** of its unsubscribe token, so an
existing subscriber's link cannot be rebuilt for a new email. Rotating it per
send would break every earlier email's link, which ADR-080 #2 forbids.
Announcements therefore use a **signed, stateless** token:

```
t = "v1." + base64url(kind + ":" + id) + "." + base64url(HMAC-SHA256(EMAIL_LINK_SECRET, "announce-unsub:v1:" + kind + ":" + id))
    kind = "u" (User.id) | "s" (NewsletterSubscriber.id)
```

- **No address in the URL.** The address is looked up from the id, so an
  email address never lands in access logs.
- **It never expires.** One click months later still works. It does nothing
  except add a suppression, so a leaked link can only unsubscribe its owner.
- **`EMAIL_LINK_SECRET`** is a new env var: 32 random bytes, listed in
  `.env.example`. Rotating it invalidates old links, so the verifier accepts
  `EMAIL_LINK_SECRET_PREVIOUS` too during a rotation. Signing and verifying
  live in `@repo/email/links.ts`, and nothing else reads the secret.

### 9.2 The surfaces

- **`/[locale]/email/unsubscribe?t=…`** is a `noindex` static shell whose
  island **POSTs**. A GET never mutates (ADR-080 #4: mail scanners fetch
  links).
  - It says "You won't receive course announcements at this address any
    more."
  - It offers **Undo**, which removes only an `UNSUBSCRIBED` suppression the
    same token created.
  - If the address is also an ACTIVE newsletter subscriber, it offers a
    separate **"Also unsubscribe from the newsletter"** button.
- **`POST /api/email/unsubscribe?t=…`** is RFC 8058 one-click. It is what
  the `List-Unsubscribe` header points to (with `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`), it exports **no GET** (a GET answers 405), and
  it returns the same 200 for valid, unknown and already-suppressed tokens.

**The anonymous-write guard stack** (ADR-171, the fourth such write):
1. the HMAC token, which is the credential;
2. `@repo/contracts` schema over the token;
3. per-IP limit, 20 per 10 minutes (the newsletter one-click's);
4. an idempotent write (`upsert` on `[email, scope]`);
5. one answer for every case, so it is not an oracle.

Like ADR-170's route, it is added to the "every POST under `app/api` has a
gate or a declared anonymous entry" walk in `promotions-public.test.ts`.

**Public strings** (`email.unsubscribe.*`) are needed in `en` **and `ar`**,
because `ar` is in `ENFORCED_LOCALES`.

### 9.3 A bug to fix first (PR N0)

`sendWelcome` (`packages/core/src/newsletter.ts:271-280`) puts the
**page** URL `/newsletter/unsubscribe?token=` in `List-Unsubscribe`. It should
be the RFC 8058 handler `/api/newsletter/unsubscribe`, which nothing currently
references. A mail client's one-click POST therefore lands on a page route,
not the handler. It must be fixed, with its regression test, before
announcements copy the pattern (testing.md #2).

## 10. Admin

### 10.1 Where it lives

- **Sidebar:** **People → Announcements**, after Newsletter, at
  `/keystone/announcements`, gated `announcements.view`. It is an audience
  tool like the newsletter list, not a content editor.
- **Course editor:** in the status aside, once the course is PUBLISHED or
  SCHEDULED (D5), an
  **"Announce this course"** button opens `/keystone/announcements/new?course=<id>`
  with step 1 filled in. It is gated `announcements.create`, and the button
  is absent without it. After a successful Publish, the toast offers the same
  link.

### 10.2 List

A `DataTable` (ADR-106):
- **Columns:** Name · Content (course title, linked) · Audience (chips) ·
  Status chip (Draft · Scheduled · Waiting for course · Sending n% · Sent · Cancelled) · Recipients
  · Sent / Failed · Created by · Date.
- **Toolbar:** "New announcement" and filters (status, kind).
- **Row actions:** Open · Duplicate · Delete. Delete is for DRAFT only,
  through `ConfirmDialog`.

### 10.3 The four-step editor (the reference picture's shape)

The steps are a tab strip, and each step saves the draft ("Save & continue").
The steps are not locked: an admin can jump back.

1. **Content.** A searchable picker over **publicly reachable** courses and
   SCHEDULED ones, the latter labelled with their go-live date (D5) (title,
   track, level, cover thumbnail). The selected course is shown as the
   email will show it. A warning appears if it was announced before (§8.1).
2. **Subject & message.**
   - Subject: the template's subject is shown as a placeholder, and an
     override is optional.
   - Short note: plain text, ≤ 500, with a live counter.
   - A live preview through the existing isolated
     `POST /keystone/api/email/preview` route, which gains a
     `campaignId`/`courseId` mode that fills real variables. A language switch
     shows the preview in any active locale.
   - The sender (from name / address) is shown read-only, with a link to
     Settings → Email (changing the sender is `email.settings.manage`).
3. **Audience.** Cards laid out like the reference: icon · label ·
   description · live count badge, several may be selected, and a selected
   card has the brand outline.
   - **Learners of a course** opens a course multi-picker.
   - **Select users** opens an async **`UserPickerField`**, the one new shared
     control. It is a searchable multi-select backed by
     `searchAnnouncementUsersAction(query)`, which returns id, name and email
     for LEARNERS only, 20 per query. The card is **absent** unless the viewer
     also holds `users.view`: without it, the picker would be a way to read
     the user list.
   - The footer shows **"1,204 unique recipients (38 duplicates and 12
     unsubscribed people removed)"**, then Save & continue.
   - The line under the heading says: "Only people who can receive
     announcements are counted. Unsubscribed and suspended addresses are left
     out automatically."
4. **Review & send.**
   - A summary of course, subject, audience and unique count.
   - The blocking checklist from §8.1, each item with a fix-it link.
   - **"Send me a test"** sends to the admin's own address through the same
     session with `isTest`, and writes no recipient row.
   - **Send now** goes through a `ConfirmDialog` that names the number ("Send
     to 1,204 people? This cannot be stopped once the emails have gone out.").
   - **Schedule** uses the themed `DateTimePicker`, in the editor's local
     time (ADR-071).

### 10.4 Detail (after Send)

- A progress bar and counts (sent · failed · skipped · pending), refreshed by
  `LiveRefresh` while `SENDING`.
- A failed-recipient table showing the address, reason code and attempts,
  gated `email.log.view`, because it lists addresses.
- **Retry failed** and **Cancel** buttons (`announcements.send`, Cancel
  through `ConfirmDialog`).
- A link to the delivery log filtered by `campaignId`.

The editor follows every admin convention: a `Field` with `useFieldErrors`
against the action's own schema (#24), `AdminCombobox`, a
`DialogTitle`+`DialogDescription` on every modal (#11), and no raw audience or
status keys on screen (#5).

## 11. Permissions (ADR-083)

- **A new group, `announcements`,** is added to `PERMISSION_GROUPS` right
  after `newsletter`, which is where the sidebar entry sits. Its label is
  `admin.permissionGroups.announcements`.
- **Keys:**
  - `announcements.view`: the list and detail.
  - `announcements.create`: drafts, editing, test sends, the course editor
    button.
  - `announcements.send`: send, schedule, cancel, retry failed, admin
    suppressions. The bulk action is the dangerous one, so it has its own key.
- **Seed:** `super_admin` and `admin` only. The owner can grant them to other
  roles in the role editor. `content_manager`'s pinned set is unchanged.
- **Every action:** the STAFF gate first, then `requirePermission(<key>)` as
  its first line, then contracts parse, then the `@repo/core` call. Core
  writes the audit row (`announcement.create/update/send/schedule/cancel/retry`,
  `email.suppression.add/remove`).
- **Audience counts** are only returned to `announcements.create`. They
  reveal the size of the user base, which the dashboard gates too.

## 12. Settings (group `email`, all non-public)

| Key | Type | Default | Read by |
|---|---|---|---|
| `email.campaignRatePerMinute` | NUMBER (1–1000) | 120 (revisit for SendGrid once the list size is known, D2) | the runner's pacing |
| `email.campaignBatchSize` | NUMBER (1–200) | 50 | the claim size |
| `announcements.inactiveDays` | SELECT 14/30/60/90 | 30 | the `inactive` audience |

Each is read by code in the same PR that seeds it (code-style #28). The
option labels for the SELECT come from `admin.settingOptions.*` (ADR-105 #7).

## 13. PRs

| PR | Scope | Done when |
|---|---|---|
| **N0** | ADR-171 (supersedes ADR-080 #8 and the last sentence of ADR-078 #11; the consent rule; the fourth anonymous write; `EMAIL_LINK_SECRET`). This plan. Fix §9.3's `List-Unsubscribe` URL, with its regression test. | `governance:check` green; the owner has answered D1–D8 (done 2026-09-30) |
| **N1** | Schema + migration (§6); `EmailDelivery.campaignId`. Contracts: `ANNOUNCEMENT_AUDIENCES`, `ANNOUNCEMENT_KINDS` (COURSE only), `announcementSaveSchema`, `announcementAudienceSchema` (≤ 20 courses, ≤ 500 users, known keys only), `unsubscribeTokenSchema`. The permission group + seed; the settings + seed; `.env.example` | Contracts ≥ 90% coverage; `permission-groups.test.ts` green; the seed is idempotent |
| **N2** | `@repo/email`: the `announcement.course` registry entry + default + sample; `createSendSession` (`sendTemplatedEmail` rebuilt on it with unchanged behaviour); SMTP `pool`; `links.ts` sign/verify with a previous-secret fallback; track raster covers | `email-registry.test.ts`, `check:email-templates` and the existing send suites all green; round-trip, tamper and rotation tests on the token |
| **N3** | `@repo/core/announcements.ts`: CRUD, `resolveAudience` (SQL counts + snapshot), suppression, queue/schedule/cancel/retry, `drainAnnouncementQueue`, the unsubscribe service, housekeeping rules, audit | Testcontainers suite green (§15) |
| **N4** | `POST /api/cron/announcements`; the shared `cron-auth.ts` for all five routes; the `after()` kick; `docs/ops/cron.md`; README | Route tests: 503 unset, 401 wrong token, 405 on GET |
| **N5** | Public `/[locale]/email/unsubscribe` + `POST /api/email/unsubscribe`; `en` + `ar` catalog; the sign-up form's consent line (under D1 (a)) | Guard-stack tests (one red test per removed guard, the ADR-080 way); the anonymous-POST walk updated |
| **N6** | Admin: sidebar entry, list, four-step editor, `UserPickerField`, preview mode, detail + progress, the course editor button and publish toast, suppression controls on the user detail | The admin form, dialog and toolbar convention guards green |
| **N7** | E2E (below), axe on the three new admin screens and the public page, RTL smoke on the page; DEVLOG; skill updates (email, content); CLAUDE.md module 17 row | CI green |

## 14. Phase 2 (not in this plan's PRs)

Each Phase 2 content type is:
- an `AnnouncementKind` member;
- an `ANNOUNCEMENT_KINDS` entry (target loader, public-reachability rule,
  variables builder);
- an `announcement.<kind>` template + default;
- an "Announce" button in that editor.

The queue, audiences, unsubscribe and admin screens are shared and do not
change.

| Kind | Template | Button in |
|---|---|---|
| `VIDEO_TOPIC` | `announcement.video` | video topic editor |
| `ARTICLE` | `announcement.article` | article editor |
| `GLOSSARY_TERM` | `announcement.glossary` (probably a weekly "new terms" digest instead: one email per term is noise) | glossary editor |

**Later still**, each needing its own decision:
- **Saved segments:** the reference's "Segment" card, a stored rule set.
- **Bounce and complaint webhooks** (SendGrid Event Webhook) writing
  `EmailSuppression`. This matters once volumes grow, because repeatedly
  mailing dead addresses hurts the sender's reputation.
- **Open and click tracking:** deliberately **not** proposed. A tracking
  pixel is a privacy decision, not a feature.
- **Learner preference centre:** a page in the learner account to toggle
  announcements.

## 15. Tests the plan commits to

- **Contracts:** unknown audience keys refused; caps on course and user ids;
  subject CR/LF stripped; note length; token schema.
- **`links.ts`:** the round-trip; one flipped byte refused; a token for `u:`
  not accepted as `s:`; the previous secret accepted and an unknown secret
  refused; fast-check over ids.
- **Core integration (Testcontainers MariaDB):**
  - **Dedupe:** a user who is a verified, active learner AND a subscriber
    AND custom-picked gets **one** row. A subscriber whose address differs
    only in case from a user's is one row. A double `queueAnnouncement` makes
    no second set.
  - **Exclusions:** STAFF, banned, suspended, soft-deleted, suppressed,
    already-enrolled learners and `UNSUBSCRIBED` subscribers are all absent.
  - **Counts:** each card's count equals the snapshot's row count for that
    card alone, and the union count equals the rows inserted.
  - **Claims:** two concurrent drains never share a row.
  - **At-most-once:** an expired `SENDING` lease becomes `FAILED
    lease_expired`, never `PENDING`.
  - **Retry and suppression:** retry reaches only `FAILED` rows. A mid-send
    unsubscribe is honoured as `SUPPRESSED`.
  - **State:** `email.enabled` off pauses without burning rows. Cancel skips
    pending rows only. Completion is counted exactly once under two runners.
  - **Scheduled:** a campaign whose course was unpublished becomes
    `CANCELLED target_unavailable`.
  - **Send when live (D5):** a campaign on a SCHEDULED course sends nothing
    before the course's `scheduledFor`, starts on the first tick after it
    without `publish-due` having run, follows a moved date, and is cancelled
    when the course goes back to draft.
  - **Housekeeping:** recipient rows are purged at 90 days; suppressions
    survive.
- **Send session:** a batch of 50 makes one template/context/transport load.
  `sendTemplatedEmail`'s existing suites pass unchanged.
- **Template:** the default renders with the sample. A coverless course gets
  the track PNG, never an SVG. An unsafe `course.url` is refused.
- **Routes:** the cron route's 503/401/405; the unsubscribe route's five
  guards (one red test each); GET answers 405; one answer for every token.
- **Permissions:** each action refuses without its key, asserted at the DB
  (no campaign row, no recipient row). A learner session 404s on
  `/keystone/announcements`. The Select users card is absent without
  `users.view`.
- **E2E (Mailpit):** publish a course → Announce → choose Verified +
  Subscribers with an overlapping address → Send → the cron tick → Mailpit
  holds exactly **one** message per address → click unsubscribe → confirm →
  a second announcement skips that address.

## 16. Owner decisions (answered 2026-09-30)

| # | Question | Recommended | **Owner's answer** |
|---|---|---|---|
| **D1** | Consent: soft opt-in for registered learners, or an explicit tick box? (§5) | **(a) soft opt-in** + a line under the sign-up form + one-click unsubscribe | **(a).** With the Subscribers card, only ACTIVE subscribers receive it, and anyone who has unsubscribed is never sent to. With All users, the rules in §4 apply as listed. |
| **D2** | Which provider sends in production (SMTP host or SendGrid), and roughly how many learners? | It sets the default of `email.campaignRatePerMinute`. **SendGrid** for bulk: Gmail/Workspace SMTP caps daily volume far below a full list | **SendGrid.** The learner count was not given, so the rate default stays 120/min until it is (§12). |
| **D3** | Can "Select users" include staff, or learners only? | **Learners only.** Staff use "Send me a test" | **No staff:** learners only, as recommended. |
| **D4** | Can "Select users" take pasted addresses that are not users or subscribers? | **No**: no consent was given (§4) | **No**, as recommended. |
| **D5** | A SCHEDULED (not yet live) course: allow "send when it goes live" in Phase 1? | **No, Phase 2** (§14). Phase 1 announces published courses only | **Nothing is sent before the course is live, but a scheduled course can be announced:** the email goes out once the course's schedule makes it live. This moves into **Phase 1** (§8.1, `sendWhenLive`). |
| **D6** | Should someone who unsubscribed from the NEWSLETTER also stop getting announcements? | **No**, they are separate lists, but the unsubscribe page offers both. Say yes if you would rather err toward fewer emails | **No**, as recommended: the lists stay separate. |
| **D7** | Inactive threshold default | **30 days**, editable in settings | **30 days.** The recommendation stands (answered together with D3–D6). |
| **D8** | How are the emails sent: inline, or through a job queue? (§8) | **A job queue** on the ADR-162 pattern: one recipient row per address, atomic claims, retries, drained in the background | **Job queue** (owner, 2026-09-30). No announcement email is sent inline from a request. The Send action only queues recipient rows, and the runners in §8.3 deliver them. |

## 17. Out of scope (Phase 1)

- KYC verified and Top depositors audiences (no data exists for either).
- Saved segments, A/B subjects, open and click tracking.
- A free-form HTML composer per campaign. The design is the template's; a
  campaign sets only its subject and a short note.
- Bounce and complaint webhooks.
- Emailing arbitrary addresses.
- Announcements for videos, news and glossary (Phase 2).
