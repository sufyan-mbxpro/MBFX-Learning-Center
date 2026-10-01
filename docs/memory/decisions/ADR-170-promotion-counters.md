# ADR-170 — Promotion counters: the third anonymous write

- **Status:** Accepted
- **Date:** 2026-09-29
- **Module:** 12 (public site: the popup and the band report), 11 (content: the
  counters and their admin view), 01 (schema, migration)
- **Plan:** `docs/changes/changes-52-promotions-plan.md` §10 P7
- **Extends:** ADR-167 (promotions), which left counting undecided because it
  "would be a third anonymous mutation and needs its own ADR". ADR-080 and
  ADR-113 (the first two anonymous writes) are unchanged. Nothing reversed.

## Context

The owner asked (2026-09-29) how many visitors see each promotion, how many
follow it, and how many close it. Answering needs the visitor's browser to
report back, so it is a write any anonymous visitor can trigger. ADR-080 and
ADR-113 made two such writes and set the rule that a third needs its own
record, because `requirePermission()` (security.md #1) cannot be the first line
of a mutation with no subject, and something else has to take its place.

The first two are forms. They defend themselves with a honeypot, a captcha, a
per-IP limit and a per-address limit. A counter is a beacon, not a form:
nothing is typed, so a honeypot catches nothing, and a captcha call per popup
view would spend a Google request on every page a reader opens. The guards
therefore differ, and this record names the new ones.

## Decision

1. **Counts, never events.** One row per promotion, per UTC day, per surface
   (`POPUP` · `BAND`), with three counters: impressions, clicks and dismissals.
   The table has no IP address, cookie, user id, session id, user agent, page
   path or time finer than the day. There is no event log to leak, subpoena or
   purge, and nothing in it identifies a person, so it needs no consent banner
   and no retention sweep. Rows go when their promotion is hard-deleted
   (cascade). A duplicate starts at zero.
2. **What counts.**
   - **Impression:** the popup shows that promotion (each page of the dialog
     counts when it is shown), or a band card is at least half on screen.
   - **Click:** the reader follows the button, the recording link or "Add to
     calendar".
   - **Dismiss:** the popup closes without a click. It is recorded for every
     promotion the reader saw in that dialog. The band has no dismiss.
3. **One endpoint, `POST /api/promotions/events`, and five guards in place of a
   permission check.** Its body is `{ locale, events: [{ id, surface, type }] }`,
   with at most six events.
   1. **Live only.** An event counts only for a promotion in the same cached
      `getLivePromotions(locale)` list the popup reads, on a surface that
      promotion actually uses. A draft, an ended promotion, the trash or an
      invented id can never gain a row.
   2. **The schema** (`promotionEventsSchema`, `@repo/contracts`): closed enums,
      bounded ids, a dismiss only on the popup.
   3. **Same origin.** `Sec-Fetch-Site` must be `same-origin`, or, when a
      browser does not send it, `Origin` must be this site's. Another site
      cannot make its visitors' browsers inflate our figures.
   4. **Per IP:** 60 requests every ten minutes.
   5. **One count per network per day.** Each (IP, promotion, surface, event)
      counts at most once in 24 hours. This is security.md #13's second
      bucket; with no account or address, the promotion is what is being
      protected. The IP address exists only as a transient rate-limit key in
      Redis, which expires. It is never written to the database.

   **Every answer is the same empty `204`.** A refused event gets what a
   counted one gets. A counter owes its caller nothing, and a different answer
   would tell a script which guard it hit.

4. **The figures are approximate, and the admin says so.** One count per
   network per day undercounts a household or an office behind one address.
   `x-forwarded-for` can be forged (the `client-ip.ts` note), so a determined
   script can still inflate a figure. The numbers show whether a promotion is
   being seen and followed. They are never billing, never a public claim, and
   never an input to any automatic decision. Every screen that shows them
   labels them as approximate (ADR-088 and ADR-100 applied to a new domain).
5. **Read under `promotions.view`, with no new key.** The figures describe
   promotions the viewer can already open. The list shows views and clicks,
   and the editor shows a Results section (totals, click rate, and the last 30
   days).
6. **The counter write is one statement**, an upsert in SQL
   (`ON DUPLICATE KEY UPDATE`) that adds one, so two beacons at once cannot
   lose an increment. Prisma's upsert is a read and then a write, the lesson
   from `translate/usage.ts`.
7. **The count of anonymous writes becomes three, and a fourth needs an ADR.**
   The guard in `support-page.test.ts` still counts the honeypot-bearing
   server actions. This one is a route handler, so `promotions-public.test.ts`
   pins its five guards and lists every POST route under `app/api` with the
   gate it uses. An anonymous POST route added without a gate fails there.

## Consequences

- A new table, `promotion_daily_stats`, and one migration.
- The popup and the band send a small `fetch` with `keepalive` after the fact.
  It never delays what the reader sees, and a failed send is silently dropped.
- A reader who blocks scripts is not counted, and neither is a crawler that
  does not run them. Both are acceptable for a figure labelled approximate.
- A fourth anonymous write (a poll or a rating, for example) needs its own
  ADR, and the enumeration in `promotions-public.test.ts` will say so.
