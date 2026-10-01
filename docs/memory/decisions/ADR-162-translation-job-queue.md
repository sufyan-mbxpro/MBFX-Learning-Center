# ADR-162 — A database-backed translation job queue

- **Status:** Accepted
- **Date:** 2026-09-25
- **Module:** 06 (i18n), 14 (hardening / ops)
- **Plan:** `docs/changes/multilingual-automation-plan.md` (revision 2),
  ADR-D.
- **Amends:** ADR-078's "no queue" — for this one workload only. Email still
  sends through `after()`.

## Context

A single edit can be translated in the tail of its own request. A backfill
cannot: activating a language means every article, lesson, term and label,
which needs batching, retries with backoff, pacing against Google's quota,
progress a person can watch, and protection against overwriting human work
saved while a job ran. The server already calls three cron routes from its
crontab with `CRON_SECRET` (`docs/ops/cron.md`).

## Decision

1. **`TranslationJob`**, owned by `@repo/translate`: `kind` (`ITEM` or
   `BACKFILL_LOCALE`), `entityType`, `entityId`, `locale`, `status`
   (`PENDING / RUNNING / DONE / FAILED`), `attempts`, `runAfter`,
   `claimToken`, `claimedAt`, `lastError` (a taxonomy string, never a
   provider message), `@@unique([kind, entityType, entityId, locale])`,
   `@@index([status, runAfter])`. For a backfill, `entityType` and `entityId`
   are `"*"`, **never NULL**: MariaDB treats every NULL as distinct in a
   unique index, which would let duplicates through.
2. **Enqueue is an upsert.** A `DONE` or `FAILED` row goes back to `PENDING`
   with `attempts = 0` and `runAfter = now`. A `PENDING` row is left alone.
   A `RUNNING` row is marked **`rerun`**, and finishing turns `DONE` into
   another pass when the flag is set, in one statement. The hash check in #5
   is not enough on its own: an edit saved after the job's write commits but
   before it is marked done would pass that check and leave a stale
   translation until the next save. (Amended during Phase 3, before merge;
   the column is migration `20260925170000_translation_job_rerun_adr162`.)
3. **Atomic claim.** One `UPDATE` sets `status = RUNNING`, a fresh
   `claimToken` and `claimedAt` on up to N rows that are `PENDING` with
   `runAfter` due, oldest first (`ORDER BY createdAt LIMIT N`); the runner
   then reads back its own rows by `claimToken`. Two runners never take the
   same job. N starts at 25.
4. **Stale leases.** Each tick first returns `RUNNING` rows claimed more than
   10 minutes ago to `PENDING`, so a crashed worker cannot strand a job.
5. **The job carries no content, and writes conditionally.** It reads the
   English source when it runs, hashes it, translates, and then writes in a
   transaction at `ReadCommitted` (ADR-056's lesson) holding the target row
   with `SELECT … FOR UPDATE`. It writes only under ADR-161 #2. If the source
   hash changed while Google was working, the result is discarded and the
   job is re-queued. A human edit saved during a job therefore survives.
6. **Retries.** Three attempts: the second waits 1 minute and the third 5,
   then the job is `FAILED` and listed on the dashboard. (Inside each
   attempt the door itself retries a transient Google error twice, after 1
   and 4 seconds.) Quota and budget refusals do not use up an attempt; they
   only move `runAfter` — 30 minutes for Google's quota, the first of next
   month for our own budget.
7. **Two runners.** A save runs its own item's jobs inline in `after()`, so a
   normal edit is translated within seconds. `POST /api/cron/translate`,
   every **5 minutes**, drains everything else. Both use #3, so they cannot
   collide.
8. **Cache.** One `revalidateTag("content", { expire: 0 })` per batch, not
   per item, so a backfill does not keep emptying the public cache.
9. **Backfill expands in pages.** A `BACKFILL_LOCALE` job enqueues `ITEM`
   jobs a page at a time and completes when every entity type has been
   walked. The dashboard shows its progress from the `ITEM` counts.
10. **Housekeeping.** `/api/cron/housekeeping` deletes `DONE` jobs older than
    7 days and `TranslateUsage` rows past 90 days, the `AiUsage` retention.

## Consequences

- One crontab line (`*/5 * * * * /srv/mbx/cron.sh translate`), a row in
  `docs/ops/cron.md`, and the README's deploy section. Like the other cron
  routes it answers 503 until `CRON_SECRET` is set.
- The "not yet translated" notice (ADR-007, ADR-159 #7) lasts seconds for an
  edit and up to a backfill's length for a new language. The progress bar is
  where that is visible.
- Integration tests (Testcontainers MariaDB) must cover: two concurrent
  claims never share a job; a human save during a job survives it; a stale
  lease is recovered.

## Alternatives rejected

- **An external queue (Redis, BullMQ, a cloud queue).** New infrastructure
  to run and secure for one workload that a table handles.
- **A long-running worker process.** The deploy runs one PM2 app; the cron
  pattern is already there and already secured.
- **`after()` alone.** Fine for one item; a backfill of thousands would run
  inside a request tail with no retry and no progress.
