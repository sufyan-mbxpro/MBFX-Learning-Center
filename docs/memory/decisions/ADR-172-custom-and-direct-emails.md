# ADR-172 — Custom and direct emails: a body per campaign, designs, and one-to-one sends

- **Status:** Accepted
- **Date:** 2026-09-30
- **Module:** 17 (email: designs, rendering, sending), 10 (the users and
  subscribers screens), 03/10 (one new permission key), 14 (E2E)
- **Plan:** `docs/changes/changes-55-custome-notifications.md` (owner decisions
  E1–E8 accepted 2026-09-30, §14)
- **Amends:** **ADR-171 #6** (audiences never include STAFF) and **ADR-171 #8**
  (a campaign's body is the template's), for the two new campaign kinds only.
  Course announcements keep both rules exactly. Nothing else in ADR-171 changes:
  the queue, the database-enforced dedupe, at-most-once delivery, soft opt-in,
  suppression, the unsubscribe token and its guards all apply to the new kinds
  unchanged.
- **Leaves untouched:** **ADR-078 #5** ("an admin cannot mint a template key").

## Context

The owner asked (2026-09-30) for three things beyond course announcements:

1. a page where an admin writes a **free-form email** and sends it, in the
   background, to all users or to chosen groups (the ADR-171 audiences);
2. reusable **email designs**, built in Settings → Email → Templates, to start
   such an email from;
3. a **"Send email"** action for one person, on the users list, the user detail
   page, the subscribers list and the subscriber detail page.

ADR-171 #8 fixes a campaign's body to its template: "a campaign overrides only
its subject and a short plain-text note", so an announcement is never a new,
unreviewed HTML document. A free-form email is exactly that. ADR-171 #6 keeps
staff out of every audience, and the owner accepted a Staff group for internal
notices (E3). A one-to-one email has a different consent question from a
broadcast (E4).

## Decision

1. **Two new campaign kinds on the ADR-171 queue: `CUSTOM` and `DIRECT`.** Both
   are `EmailCampaign` rows sent by the same runner. `targetId` becomes
   nullable, since neither is about a piece of content. A `DIRECT` campaign has
   exactly one recipient and is created, snapshotted and kicked in one call; it
   gets the delivery log, the audit row, retry and at-most-once delivery with
   no separate send path.

2. **A campaign of these kinds carries its own body** in
   `EmailCampaignContent`, one row per locale (subject, preheader, RICH or HTML
   mode, body). This amends ADR-171 #8 for these kinds. What replaces the review
   a fixed template gave:
   - the email sanitiser runs server-side on every save (security.md #8), and
     again at render;
   - the variables are a closed set: the globals plus `unsubscribe.url`; any
     other `{{name}}` is refused on save;
   - an HTML-mode body must contain `{{unsubscribe.url}}`, because it replaces
     the shell whose footer carries the link;
   - **a bulk `CUSTOM` email cannot be sent until a test has been sent to the
     author since the last edit** (owner, E5). The campaign stores the hash of
     the content at the last test; any edit changes it;
   - the body is frozen once the campaign leaves `DRAFT`. The runner renders
     from the stored content, never from a design.

3. **Designs are not templates.** `EmailDesign` is its own table: a name, a
   mode, an optional subject and preheader, and a body, English only. Starting
   an email from a design COPIES it; editing or archiving the design later
   changes no draft and no sent email. A design has no key and is never sent by
   code, so ADR-078 #5 stands: code still decides every email the system sends
   on its own, and a person decides every email built from a design. Designs are
   edited on the Templates screen under the existing `email.templates.update`
   key, because they are harmless until someone with `announcements.send` sends
   one.

4. **The two kinds render under their own keys, `campaign.custom` and
   `campaign.direct`, in a small registry of their own** (`CAMPAIGN_EMAILS`,
   `@repo/contracts`), not in `EMAIL_TEMPLATES`. Those keys have no stored body,
   no translations and no on/off row: the body is the campaign's. Putting them
   in `EMAIL_TEMPLATES` would give the Templates screen a body editor that
   nothing reads (code-style #28), and every consumer of that registry assumes
   a key owns content. The keys exist so the delivery log names and filters
   them, and so the renderer knows their variables.

5. **A Staff group for `CUSTOM` only** (owner, E3). It amends ADR-171 #6 for
   custom emails: an internal notice to every employee is a real need, and a
   staff member is not a marketing recipient. It is offered only when the viewer
   also holds `employees.view`, the same reasoning as ADR-171 #11's
   `users.view` on the hand-picked group. Course announcements stay
   learners-only.

6. **A direct email has its own consent rule** (owner, E4):
   - to an **account holder** (learner or staff, including a banned or
     suspended one, who may need telling why) it is correspondence, not
     marketing. An announcements suppression does **not** block it; the dialog
     warns that the person has unsubscribed;
   - to a **subscriber-only contact**, whose only relationship with the site is
     the mailing list, it is refused while they are suppressed or
     `UNSUBSCRIBED`, and never offered to a `PENDING` one (an unconfirmed address
     never proved it is theirs);
   - every direct email still carries the unsubscribe footer. One render path,
     and a way out is never wrong.

7. **One new key, `announcements.direct`**, in the ADR-171 group, seeded to
   `super_admin` and `admin` only. The action also re-checks the right to see
   the person: `users.view` for an account, `newsletter.view` for a subscriber.
   A staff member may send at most **30 direct emails an hour** (owner, E8), a
   constant rather than a setting, so a careless or compromised account cannot
   turn the dialog into a bulk tool one row at a time. There is no bulk "Send
   email" on a table selection: a broadcast goes through the composer, with its
   count, test gate and confirmation.

8. **The section is labelled "Email campaigns"** (owner, E2). The route
   `/keystone/announcements`, the permission keys `announcements.*` and every
   internal identifier keep their names: ADR-171 shipped them and the catalog
   never renders them (code-style #5), so renaming them would be a migration of
   live permission grants for no visible difference.

9. **No machine translation of a campaign body** (owner, E6). Only `en` is
   active, and a bulk email in unreviewed machine words is sent before anyone
   reads it. A missing locale falls back to the default locale's content.

10. **Images for emails get their own media category, `email`** (owner, E7), so
    they are findable and their usage is counted.

## Consequences

- One migration: `EmailDesign`, `EmailCampaignContent`, the two
  `AnnouncementKind` members, a nullable `EmailCampaign.targetId`, `designId`,
  `replyToSelf`, `lastTestedAt` and `testedHash` on the campaign, and an index on
  `EmailCampaignRecipient.userId` for a person's email history.
- `@repo/email`'s send session gains per-message `content` and `replyTo`. The
  existing callers pass neither and behave exactly as before.
- Campaign content rows are kept with the campaign: they are the record of what
  was sent, hold no secret, and are not a list of addresses. ADR-078 #10 still
  governs `EmailDelivery`, which holds no body.
- A user's detail page gains an Emails tab listing what was sent to them, for
  as long as the recipient rows exist (90 days, ADR-171).
- A body is capped at 200 KB after sanitising.
- Out of scope: attachments, pasted addresses (ADR-171 #6 still holds for them),
  open and click tracking, receiving replies in the admin, and bulk sends from a
  table selection.
