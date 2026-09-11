# ADR-056: Learner progress is a client island over two tables, with explicit completion

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 11 (content system), 12 (public site), 04 (auth)
**Supersedes:** —
**Superseded by:** —

## Context

ADR-055 builds the Learn area. Progress tracking is the half of it that cannot
be answered by "cache the page and render the content", because progress is
per-learner data on a page every anonymous visitor must also be able to read.

Three existing constraints bound the design, and they pull against each other:

1. **`architecture.md` #6**: public routes are ISR plus cache tags, and "do not
   fix a caching problem by making public routes dynamic."
2. **`security.md` #12**: non-public data must never serialize into the RSC
   payload of a public page.
3. The `progress_tracking` feature flag is already seeded as enabled with
   `AUTHENTICATED` visibility — progress is for account holders, content is
   for everyone.

There is a live precedent for the failure mode. `auth-slot.tsx` originally did
a server-side `auth()` read on the public header; it was removed **precisely
because** a session read on a shared surface made every public navigation
uncacheable. Repeating that on the course and lesson pages would uncache the
entire learning area — the highest-traffic content the site will have.

`plan.md` Module 11 did not specify progress at all, so every decision here is
a gap being filled rather than a plan deviation, but each is architecture-level
and needs recording before code.

## Decision

### 1. Progress is a client island; no public learning page reads a session (D6)

Course and lesson pages are `"use cache"` with `cacheTag("content")` and
contain **no session read whatsoever**. Progress renders in a client component
that hydrates from `GET /api/learn/progress?course=<id>` after paint. Writes go
to `POST /api/learn/progress`.

**The API route is the authorization boundary** — it reads the session, applies
`Lesson.visibility` / `Course.visibility` per ADR-012, scopes every read and
write to the session user, and is rate-limited. The page is not a boundary
because the page never sees user data.

This satisfies `security.md` #12 **by construction rather than by review**: no
progress data can leak into a cached RSC payload, because none is read during
render. That is a stronger guarantee than a leak test, and the leak test still
runs.

The island renders the full curriculum server-side with every lesson in its
"not started" state and the client swaps in real state on hydrate, so the
markers occupy their space from first paint and there is no layout shift.

### 2. Two tables, not eight (D7)

- **`LessonProgress`** — one row per (user, lesson). Carries lesson state and
  completion timestamps. Section progress and drop-off analytics are
  aggregations over it, not separate tables.
- **`CourseEnrollment`** — one row per (user, course). Carries `lastLessonId`
  for "Continue Learning", started/completed timestamps, and a **denormalised
  `lessonsCompleted` counter** so the index page and learner dashboard cost one
  indexed read rather than N.

`courseId` is denormalised onto `LessonProgress`. Without it, "which of this
course's lessons has this user completed" is
`progress → lesson → section → course` on every course-page load; with it, one
index seek on `@@index([userId, courseId])`. The write path sets it inside the
same transaction that resolves the lesson, so it cannot drift.

An event log, a separate section-progress table and a video-position table are
all either derivable or deferred. Adding an event log later is additive and
cheap; carrying one now is not.

### 3. Guests read everything; progress requires an account (D8)

No localStorage progress and **no guest-to-account merge**. Merge is a
conflict-resolution problem — which side wins for a lesson completed in both? —
that costs more than it returns before there are users to have the conflict. A
guest sees the entire curriculum plus one inline "Sign in to save your
progress" card. The already-seeded `AUTHENTICATED` visibility on
`progress_tracking` is exactly this policy.

### 4. No video resume position in Phase 1 (D9)

Resuming at 13:42 requires the YouTube IFrame API, which requires widening
`script-src` to `youtube.com` in `proxy.ts`. Our sanitizer deliberately emits
bare `youtube-nocookie` iframes with no JavaScript bridge. Widening the CSP for
a convenience feature — in a programme whose CSP is still report-only and
heading for enforcement in Module 14 — is a bad trade. **No `positionSeconds`
column until a player integration is specified.**

**Named expiry condition.** This rationale is contingent, not permanent. It
rests entirely on the player being a third-party embed we do not control. When
`changes-12-plan.md` M5.4 ships our own hls.js player, we own the player events
and no third-party script is involved, and this reasoning is void. Resume
position then becomes an ordinary small feature — a `positionSeconds` column
and a throttled write. **It should be reconsidered when M5.4 lands, not left
standing on an expired argument.**

### 5. Completion is explicit, with a per-lesson rule (D10)

`Lesson.completionRule`, two values in Phase 1:

- **`MANUAL`** (default) — the learner presses "Mark complete". This works
  identically for text, video, PDF and external lessons, which is what makes
  external resources cheap to support at all: we cannot observe what a learner
  does on someone else's site, and with a manual rule we do not need to.
- **`QUIZ_PASS`** — satisfied when the lesson's attached quiz is passed; the
  manual control is hidden. Unreachable until Phase 6.

Scroll-depth and video-percentage auto-completion are **rejected**: both are
unreliable, neither is testable at the database level, and both write
completion rows the learner did not intend.

`Lesson.isRequired` (default true) lets a course carry optional material
without blocking completion.

### 6. Editing a lesson does not un-complete it (D11)

There is no lesson content versioning and no completion invalidation. `Lesson`
already has `lastReviewedAt` for the editorial question. Versioning completions
against a content hash means telling a learner they have un-finished something
they finished, which is a worse outcome than a learner having completed a
slightly older revision.

### 7. A course final quiz is a course-level rule, not a phantom lesson (D18)

`Course.finalQuizId` → `Quiz` (Phase 6). Course completion is:

```
courseComplete = every published isRequired lesson complete
                 AND (finalQuizId is null OR that quiz has a passed attempt)
```

One rule, evaluated in one place (`recomputeCourseCompletion`). The final quiz
is deliberately **not** a `Lesson` row: making it one would give it a slug, a
URL, a position in `LessonProgress` and a `completionRule` that duplicates the
course-level question — two mechanisms answering "is this course done".

Until Phase 6, `finalQuizId` does not exist and the second clause is vacuously
true. **`recomputeCourseCompletion` is written in this shape from Phase 5**, so
Phase 6 adds a conjunct rather than rewriting completion logic.

### 8. "Was this lesson helpful?" is a row per vote, not a counter pair (D28)

Two integer counters on `Lesson` would be cheaper and would answer only "what
is the ratio right now". A row per vote answers "which lessons got worse after
the March rewrite", which is the question an editor actually asks.

`LessonFeedback` with `@@unique([lessonId, userId])` and
`@@index([lessonId, helpful])`.

Anonymous votes are accepted — gating the prompt behind sign-in would collect
almost nothing — and deduped per browser via `localStorage`, **which is UX, not
security, and is stated as such**. The endpoint is rate-limited per IP like
every other public write.

MariaDB treats `NULL`s as distinct in a unique index, so
`@@unique([lessonId, userId])` binds signed-in learners only and anonymous rows
accumulate freely. That is the intended behaviour and is commented in the
schema so nobody "fixes" it to a filtered index later.

## Consequences

- **Every progress marker appears a beat after paint.** This is a real,
  permanent UX cost on the most-used surface in the product, and it is the
  price of the whole learning area staying cached. Mitigated by reserved space
  and skeletons so nothing shifts; the alternative is forbidden by
  `architecture.md` #6.
- **"Continue Learning" cannot be server-rendered**, so a returning learner
  sees a generic CTA for one frame. Same mitigation, same reason.
- **The denormalised `lessonsCompleted` counter can drift** if a write path
  forgets it. Mitigated by it being maintained only inside the same transaction
  as the `LessonProgress` write, and by a concurrency test asserting N parallel
  completions leave the counter equal to the distinct completed-lesson count.
- **`courseId` on `LessonProgress` is duplicated data.** Accepted deliberately
  for the query it removes; correctness is guaranteed by it being set in the
  transaction that resolves the lesson, never by a separate write.
- **No guest progress means a visitor who reads five lessons and then signs up
  starts from zero.** Accepted for Phase 1; it is a real cost and the merge
  that fixes it is a genuine feature, not an oversight.
- **Manual completion can be gamed** — a learner can mark everything complete
  without reading. Accepted: this is a learning site, not a certification
  authority, and the alternative auto-detection is unreliable enough that it
  would produce _wrong_ data rather than merely optimistic data.
- **`LessonFeedback` grows unbounded from anonymous traffic.** Bounded in
  practice by the per-IP rate limit; if it ever matters, the rollup is an
  aggregate and old rows can be compacted without losing the editorial signal.

## Alternatives considered

- **Server-render progress and make the pages dynamic.** Rejected: it uncaches
  the highest-traffic content on the site, and `auth-slot.tsx` is the standing
  in-repo precedent for exactly this regression.
- **Server-render progress inside a `<Suspense>` boundary with PPR.** Rejected
  for Phase 1: the static shell would still be produced per-request for the
  dynamic hole, and the island reaches the same user-visible result with a
  mechanism the repository already uses and can test. Worth revisiting only
  with a measured reason.
- **A `ProgressEvent` append-only log as the source of truth.** Rejected: every
  read becomes a fold, and none of the questions we currently ask need event
  history. Additive later.
- **localStorage progress for guests, merged on sign-up.** Rejected: the merge
  conflict rules cost more than the feature returns pre-launch.
- **Auto-complete on scroll depth or video percentage.** Rejected: unreliable,
  untestable at the DB level, and it writes completions the learner did not
  intend.
- **A final quiz modelled as a `Lesson` with a flag.** Rejected: it creates a
  second completion mechanism and a URL for something that is not a page.
- **`helpfulYes` / `helpfulNo` counters on `Lesson`.** Rejected: cheaper, but
  it cannot answer the only question worth asking (change over time).

## Compliance

- Integration test: the cached RSC payload of a course and a lesson page
  contains no user field, and the page stays cached across two requests — the
  direct guard on decision 1.
- Integration test: user A can neither read nor write user B's progress.
- Integration test: two "mark complete" writes produce one row and a counter of
  1 (idempotency).
- Concurrency test: N parallel completions leave `lessonsCompleted` equal to
  the number of distinct completed lessons.
- Integration test: a course with an incomplete `isRequired: false` lesson
  still completes; one with an incomplete required lesson does not.
- Integration test (Phase 6): all lessons complete with the final quiz unpassed
  leaves the course incomplete.
- Integration test: editing a lesson does not clear its completions.
- E2E: a guest sees the full curriculum plus the sign-in card and no progress.
- E2E: "Continue Learning" returns to the last lesson.
- Integration test: two feedback votes from one signed-in learner produce one
  row with the value updated; an anonymous burst is rate-limited and the first
  vote is stored.
- `requirePermission()` is not the mechanism here — these are learner-scoped
  endpoints, not admin mutations — but every one of them re-reads the session
  server-side and never trusts a client-supplied user id.
