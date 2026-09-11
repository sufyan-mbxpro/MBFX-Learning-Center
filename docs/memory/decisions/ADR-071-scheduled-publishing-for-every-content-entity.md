# ADR-071: Scheduled publishing becomes real for every content entity

**Status:** Accepted
**Date:** 2026-09-10
**Module:** 11 (content system), 12 (public site), 15 (articles), 01 (db)
**Supersedes:** —
**Superseded by:** —

## Context

`CONTENT_TRANSITIONS` (`packages/core/src/content.ts:22`) has offered
`APPROVED → SCHEDULED` for every content entity since Module 11 shipped the
seven-state machine. Five entities run that machine — `Course`, `Lesson`,
`Quiz`, `GlossaryTerm`, `VideoTopic` — and **not one of them has a
`scheduledFor` column.** Nothing anywhere reads a schedule for them, and no
sweep publishes them.

The result is a button that parks content. An editor takes a lesson to
SCHEDULED, the row's `status` becomes `SCHEDULED`, and there it stays: the
public where-clause matches `status: PUBLISHED` exactly, so the lesson is
invisible; the only way out is a manual move back through the panel. The
editor is given no field in which to say _when_, which is the tell — the
state was copied from the article machine without the column that gives it
meaning. `changes-18-plan.md` §11 D2 raised this and the owner chose to build
the real thing rather than remove the state.

**Articles already solved this, and solved it well.** ADR-015 #6 decided
scheduling without infrastructure: public visibility is decided _in the query_
— `PUBLISHED`, or `SCHEDULED` with `scheduledFor <= now` — so with
`cacheLife({ revalidate: 300 })` a scheduled article is live within five
minutes of its time and no scheduler need exist. `publishDueArticles()` flips
due rows to a real `PUBLISHED` afterwards, stamping `publishedAt` from
`scheduledFor` so the recorded time is the promised one rather than the
sweep's. That function has been exported and uncalled since Module 15.

So the question is not how to schedule content. It is whether the five other
entities get the article's answer, and whether the sweep finally gets a caller.

## Decision

**1. The five content entities gain `scheduledFor DateTime?` and the article's
visibility rule.** The column is nullable and additive, with
`@@index([status, scheduledFor])` matching `Article`'s. Every public
where-helper — `publicCourseWhere`, `publicLessonWhere`, `publicQuizWhere`,
`publicVideoWhere` and the glossary term clauses, now a named
`publicGlossaryTermWhere` — takes `now: Date = new Date()` and matches
`PUBLISHED OR (SCHEDULED AND scheduledFor <= now)`, exactly as
`publicArticleWhere` does. The shared `OR` itself is `scheduledVisibilityOr`
in `content.ts`, so the rule has one definition rather than six.

This is the load-bearing half. **A scheduled row is live at its minute because
of the query, not because of a job**, so a missed, failed or never-configured
sweep delays nothing. The five-minute `cacheLife` every learn reader already
carries sets the granularity, and it is the same five minutes articles have
shipped with for a month.

**2. `transitionContentStatus` takes an optional `scheduledFor` and validates
it.** SCHEDULED without a future date throws `ScheduleInPastError` — the same
error articles throw, moved to `content.ts` and re-exported from `articles.ts`
so there is one definition. Moving to PUBLISHED or DRAFT clears the column; a
PUBLISHED move stamps `publishedAt` from `scheduledFor` when it is sweeping a
due row and from `now` otherwise.

**3. `publishDueContent(now)` sweeps all five entities, and a route calls it.**
`POST /api/cron/publish-due` runs `publishDueArticles()` and
`publishDueContent()` and returns the counts. It is authenticated by a
`CRON_SECRET` bearer token compared with `timingSafeEqual`, **not** by
`requirePermission()`: there is no subject, and inventing a system user to
satisfy a rule written for human actors would weaken the audit trail rather
than strengthen it. The sweep audits with `userId: null`, which
`publishDueArticles` already established for exactly this case.

The route is the repo's first scheduled-job seam. It adds no dependency — no
`node-cron`, no queue — because the caller is whatever the deployment already
has: a platform cron, a `curl` in a systemd timer, an uptime pinger. **If it
is never configured, the product still behaves correctly** (decision 1); the
sweep only converts a due row into an honestly-stamped `PUBLISHED` one.

**4. The panel gets the field, and the five status actions get the argument.**
`ContentStatusPanel` renders the article panel's `datetime-local` input and
presets when SCHEDULED is a legal move, and `setCourseStatusAction` and its
four siblings take `scheduledForIso?`. The panel keeps ADR-070's split props:
`save` then `transitionTo(to, scheduledForIso)`.

**5. `SCHEDULED` stays in `CONTENT_TRANSITIONS`, unchanged.** The map was never
wrong; the columns behind it were missing. This ADR adds them rather than
narrowing a machine the repo calls frozen.

## Consequences

**What gets better.** The state means what it says on every entity. An editor
can line a course up for Monday. The article and learn machines converge on
one visibility rule instead of two, and `effectivePublishedAt` — which existed
only for articles — becomes the shared answer to "when did this go live".

**What this costs.**

- **Every public where-helper gains `now: Date = new Date()`.** The default is
  deliberate and it is the article precedent verbatim: `loadPublishedArticles`
  computes `const now = new Date()` inside the loader, and the loader runs
  inside a `"use cache"` wrapper, so `now` is frozen for that cache entry's
  life either way. **The freeze is bounded by `cacheLife`, not by the
  argument** — which is why a required parameter would have churned some forty
  call sites to buy nothing. Callers that already hold a `now` still pass it.
- **A five-minute floor on punctuality**, inherited from `cacheLife`. A
  schedule is honoured to the nearest revalidation, not to the second. This is
  the trade ADR-015 #6 already accepted and it is why the granularity of the
  UI presets is hours, not minutes.
- **A secret to configure.** `CRON_SECRET` joins `.env.example`. Absent, the
  route refuses every request (it never falls open) and the sweep simply never
  runs — see decision 3 for why that is survivable.
- **`publishedAt` on a due-but-unswept row is `null`**, so every surface that
  renders a publish time reads it through `effectivePublishedAt`. The
  article readers do this already; the learn readers gain it.

**What is deliberately not built.** No recurring schedules, no unpublish-at,
no timezone picker (the input is the editor's local time, converted to an
instant at the boundary — the article panel's existing behaviour). No queue,
no worker process, no in-process timer: an in-process `setInterval` in a
serverless or multi-instance deployment either never runs or runs N times, and
the query-side rule means we need neither.

**The reversal path** is decision 1 alone: drop the `OR` from the five
where-helpers and scheduled content stops appearing, without a migration.
