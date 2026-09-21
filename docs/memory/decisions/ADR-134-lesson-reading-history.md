# ADR-134: A signed-in learner's lesson reading history

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 11 (content: progress), 12 (public site), 01 (`@repo/db`)
**Plan:** `docs/changes/changes-39-fixeing.md`
**Supersedes:** —. Extends ADR-123 §2 (read tracking) from articles to lessons,
and ADR-125's `/account/progress`.
**Superseded by:** —

## Context

The owner: "mark this lesson is complete is always showing mute.. also store the
reading history on user progress when login."

**The muted button was a bug, and it also blocked the history.**
`ProgressProvider` guarded its one request with a `started` ref and aborted
that request in the effect's cleanup. Under React Strict Mode (development)
the cleanup runs between the effect's two invocations. The first request was
aborted and the ref stopped the second, so `status` stayed `loading` for the
life of the page. The button renders disabled while loading. The same request
is the `touch` that records a visit, so nothing a signed-in reader opened ever
reached the server.

With the bug fixed, a visit still left no usable history. `touchLesson`'s
upsert has an empty `update` on purpose, so a reread never downgrades a
completed lesson. That also means neither `updatedAt` nor anything else on the
row records when a lesson was last opened. `/account/progress` could list
courses and article reads but not lessons.

## Decision

1. **The provider no longer aborts.** A touch is a write that should land even
   if the reader navigates away, and a state update after unmount is a no-op
   in React 19, so there was nothing for the abort to protect. The ref stays,
   so Strict Mode still sends one touch, not two.
2. **`LessonProgress.lastViewedAt DateTime @default(now())`**, indexed with
   `userId`. `touchLesson` writes only this column on an existing row and
   never the status. It is a last-read marker like `ArticleRead.readAt`
   (ADR-123 §2), not a view log: a reread moves it forward and the table does
   not grow.
3. **`/account/progress` gains "Lessons you've read"**:
   `loadLearnerActivity().lessonReads`, the 20 most recent
   (`ACCOUNT_RECENT_LESSON_READS`). Each row shows the lesson, its course, the
   date and a Completed badge. Rows are resolved through the curriculum's
   public rule (`publicLessonWhere` AND a published section, inside
   `publicCourseWhere`), so an unpublished lesson leaves the list as it leaves
   the site (ADR-123's rule 3). The band renders only when non-empty, because
   "Continue learning" above it already carries the empty state.

## Consequences

- One migration: `20260917234000_lesson_last_viewed_adr134`. It backfills
  `lastViewedAt` from `updatedAt`, so existing rows do not all claim today.
- The data is per-learner and read only inside the page's session-reading
  `<Suspense>`, as ADR-123 §1 requires. Nothing new is cached.
