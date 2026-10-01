# ADR-171 — Announcement emails: a job-queued campaign, and the fourth anonymous write

- **Status:** Accepted
- **Date:** 2026-09-30
- **Module:** 17 (email: template, sending, unsubscribe), 11 (content: the
  course entry point), 03/10 (a new permission group), 12 (the public
  unsubscribe page), 14 (E2E)
- **Plan:** `docs/changes/changes-54-notifications.md` (owner decisions D1–D8
  answered 2026-09-30, §16)
- **Supersedes:** **ADR-080 #8** ("No campaigns") and the last sentence of
  **ADR-078 #11** ("Campaign sending waits for the changes-12 worker"). The
  rest of both ADRs stands. In particular ADR-078 #11's "no queue" still holds
  for every TRANSACTIONAL email (reset, verification, notices, newsletter
  confirm and welcome, support); only announcements use the queue below.
- **Extends:** ADR-162 (the database-backed job queue) to a second workload,
  and ADR-170 #7 (the count of anonymous writes) to four.

## Context

The owner asked (2026-09-29) to email chosen audiences when new content is
published, starting with courses: all learners, verified ones, active ones,
inactive ones, newsletter subscribers, learners of a given course, or
hand-picked people. **No one may receive the same announcement twice**, even
when they fall in several audiences, and the sending happens **in the
background**.

Two accepted decisions forbid that as written. ADR-080 #8 rules out "a
composer, an audience builder, a bulk send" until "the changes-12 worker, and a
brief of its own". ADR-078 #11 says "no queue". The changes-12 worker (BullMQ
plus an `apps/worker`) was never built. Since those ADRs, ADR-162 put a
database-backed job queue into production for translation: a job table, an
atomic claim, leases, backoff, drained by a cron route and an `after()` kick.
It was chosen over BullMQ as "new infrastructure to run and secure for one
workload that a table handles". The same reasoning applies here, and the
changes-54 plan is the brief ADR-080 #8 asked for.

ADR-078 rejected a queue partly because a stored rendered body would put a
reset link in the database. An announcement recipient row holds no body: the
runner renders from the template at send time, which is what ADR-078 said a
worker would do.

## Decision

1. **Announcements are delivered only through a job queue** (owner, D8), on
   ADR-162's pattern and in their own tables: `EmailCampaign` (one
   announcement) and `EmailCampaignRecipient` (one job per address). Pressing
   Send writes recipient rows and returns; the runners (an `after()` kick in
   the action and `POST /api/cron/announcements` every minute) claim them
   atomically, send, retry and finish the campaign. The one exception is
   "Send me a test", a single message to the acting admin's own address with
   no recipient row.

2. **One announcement reaches one address once, enforced by the database.**
   Audiences are a UNION deduplicated by normalised address (trimmed,
   lower-cased), and `EmailCampaignRecipient` carries
   `@@unique([campaignId, email])`, inserted with `skipDuplicates`. A bug in
   the union or a double-pressed Send still cannot create a second row.

3. **Delivery is at-most-once.** A row whose runner died mid-send (lease older
   than ten minutes) becomes `FAILED` with `lease_expired`, never `PENDING`.
   A missed email is visible and can be retried by a person; a duplicate
   cannot be recalled, and the owner's one hard rule is no duplicates. "Retry
   failed" returns only `FAILED` rows, so it still cannot reach anyone twice.

4. **Consent is soft opt-in** (owner, D1). Registered learners may be emailed
   about new courses because the mail is about what they registered for, on
   three conditions: a line under the sign-up form says so; every
   announcement carries a working one-click unsubscribe honoured forever; and
   every announcement carries the sender's postal address
   (`email.postalAddress`), without which the send is refused. Newsletter
   subscribers are included only while `ACTIVE`; an unsubscribed subscriber
   is never sent to. A newsletter unsubscribe does not stop announcements,
   and the reverse holds too (owner, D6); the confirmation page offers the
   other as a separate button.

5. **Suppression is one table keyed by address**, `EmailSuppression`
   (`@@unique([email, scope])`), never purged, because deleting it would
   re-enrol someone who said no. It is re-checked per recipient just before
   each send, so an unsubscribe during a campaign is honoured. Staff can add
   a suppression and can remove only one they added (`reason = ADMIN`); a
   person's own unsubscribe cannot be undone by staff.

6. **The audiences are code** (`ANNOUNCEMENT_AUDIENCES`, `@repo/contracts`),
   the ADR-042 split: learners only (STAFF are never in any audience,
   including the hand-picked one, owner D3), existing people only (no pasted
   addresses, owner D4). KYC-verified and top-depositor audiences are not
   built, because no data exists for either.

7. **A scheduled course can be announced before it is live, and nothing is
   sent until it is** (owner, D5). The campaign waits with `sendWhenLive`, and
   the runner starts it the first tick on which `publicCourseWhere()` matches
   the course, the site's own visibility rule (ADR-071), so it does not
   depend on `/api/cron/publish-due` having run. If the course leaves
   SCHEDULED without going live, the campaign is cancelled.

8. **The body is the template's.** A campaign overrides only its subject and
   a short plain-text note. The template `announcement.course` is a registry
   entry with default content like every other (ADR-078 #5), public-audience
   and so translated per active locale.

9. **The announcement unsubscribe is the FOURTH anonymous write.** Its token
   is stateless and signed, because the newsletter stores only a hash of its
   token and so cannot put an existing subscriber's link into a new message:
   `v1.<base64url(kind:id)>.<base64url(HMAC-SHA256(EMAIL_LINK_SECRET, …))>`,
   with `kind` `u` (user) or `s` (subscriber). It carries no address and never
   expires, and it can only suppress its own address. Five guards stand in
   for `requirePermission()`:
   1. the HMAC token, which is the credential;
   2. the contracts schema over the token;
   3. a per-IP limit, 20 per ten minutes (the newsletter one-click's);
   4. an idempotent write (an upsert on `[email, scope]`);
   5. one answer for every case, so the route is not an oracle.

   The page is a static shell whose island POSTs (ADR-080 #4), and
   `POST /api/email/unsubscribe` is the RFC 8058 one-click handler with no GET
   export. `promotions-public.test.ts`'s walk of anonymous POST routes gains
   it as a declared entry. A fifth anonymous write needs its own ADR.

10. **`EMAIL_LINK_SECRET` is an environment variable**, not a database secret,
    so it is not a security.md #10 exception. `@repo/email`'s `links.ts` is
    its only reader. The verifier also accepts `EMAIL_LINK_SECRET_PREVIOUS`, so
    the secret can be rotated without breaking every earlier email's link.

11. **Sending is a new permission group, `announcements`**, placed after
    `newsletter` (ADR-083): `view`, `create` and `send`. The bulk action has
    its own key. Seeded to `super_admin` and `admin` only. The hand-picked
    audience additionally needs `users.view`, because a user picker without it
    would be a way to read the user list.

12. **Pacing is a setting, not a constant.** `email.campaignRatePerMinute`
    (default 120) and `email.campaignBatchSize` (default 50), because the
    ceiling belongs to the provider. Production sends through SendGrid (owner,
    D2; ADR-152's driver).

## Consequences

- Three tables (`email_campaigns`, `email_campaign_recipients`,
  `email_suppressions`) and a nullable `campaignId` on `email_deliveries`.
  Recipient rows are purged 90 days after the campaign finishes (the delivery
  log's rule, because they are a list of addresses); campaigns and their
  counters are kept.
- A fifth cron route, `POST /api/cron/announcements`, every minute, with the
  bearer check shared by all five routes in one helper.
- A new env var, `EMAIL_LINK_SECRET`, required for announcements to send.
- `@repo/email` gains a send session that loads the template, the render
  context, the sender and the transport once per batch.
  `sendTemplatedEmail` keeps its behaviour and is built on a one-shot session.
- Found while planning, and fixed with this ADR: the newsletter welcome's
  `List-Unsubscribe` header pointed at the unsubscribe PAGE, so a mail
  client's one-click POST reached no handler. `@repo/email` now separates the
  footer link (`url`) from the header target (`oneClickUrl`).
- Phase 2 content types (videos, articles, glossary) are each an
  `AnnouncementKind`, an `ANNOUNCEMENT_KINDS` entry, a template and an editor
  button; the queue, audiences, unsubscribe and screens do not change.
- Open and click tracking is deliberately not proposed: a tracking pixel is a
  privacy decision, not a feature.
