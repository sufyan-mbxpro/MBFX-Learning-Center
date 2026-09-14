# ADR-084: The assessment is part of the course, the lock is advisory, and the resume answers a guest

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 11 (content system), 12 (public site)
**Supersedes:** the recommendation list in the course page's right rail and the
one inside `CourseCompletionBanner` (changes-11 PR 4.2 / Phase 7) — one band of
cards replaces both. Extends ADR-056 (#1, #2, #7) and ADR-058 (#1, #6, #7)
rather than reversing any part of either.
**Superseded by:** —

## Context

The owner reviewed the running learning area and reported four things:

1. A course can be given a final quiz in the admin builder, but on the public
   site a learner who finishes the lessons is never shown it and cannot
   attempt it.
2. Course recommendations should be clear suggestions, not a footnote.
3. The last-read course and lesson should be recorded and offered back as a
   resume — the way a crypto-learning site does it.
4. A signed-out reader should be shown a sign-in button in that resume slot.

Read against the tree, (3) is already built and (1) is worse than a missing
design. What exists:

- **The progress subsystem is complete and correct.**
  `CourseEnrollment.lastLessonId`/`lastActiveAt` are written by `touchLesson`
  on every lesson open, `getLearnerDashboard` serves the summaries,
  `ContinueBand` renders "pick up where you left off" on `/learn` and
  `/learn/[track]`, and `CourseStartCta` resumes at the right lesson.
  `applyQuizPass` credits a `QUIZ_PASS` lesson and recounts the course the
  moment an attempt passes. Nothing in the write path needs to change.
- **`Course.finalQuizId` is load-bearing and invisible.**
  `recomputeCourseCompletion` blocks completion on "no final quiz, or that
  quiz has a passed attempt" (ADR-056 #7, filled in by ADR-058 #6), but
  `CourseView` carries no quiz, so no page links to one. Quizzes default to
  `isStandalone: false` and `/learn/<track>/quizzes` indexes standalone rows
  only (ADR-058 #1), so a course's final quiz lives at a URL that **nothing on
  the public site points at**. A course with a final quiz was therefore
  impossible to complete through the interface: the bar stops at 100% of
  lessons and the completion banner never arrives.
- **A `QUIZ_PASS` lesson was mute.** `LessonProgressActions` returns `null`
  for that rule — correct, because completion there is not a button press
  (ADR-056 #5) — and nothing rendered in its place. `LessonView` carries
  `completionRule` and no quiz, so the one lesson whose completion rule says
  "pass the quiz" offered no way to reach the quiz.
- **The resume band is silent for guests.** `ContinueBand` opens with
  `if (status !== "ready") return null`, so the reader with no account — the
  one the offer is aimed at — gets nothing.
- **Recommendations render twice, thinly.** A 48px-thumbnail list in the right
  rail and a text list of the same three titles inside the completion banner.

None of this could fail CI. Every file types, lints and passes; the defect is
a view shape that omits a column, and no test asserts that a stored id reaches
a screen.

## Decision

### 1. A quiz reaches a public page through the CONTENT loader, never through the progress island

`CourseView` gains `finalQuiz: QuizLinkView | null` and `LessonView` gains
`quiz: QuizLinkView | null`, both resolved inside the existing `"use cache"` +
`cacheTag("content")` loaders.

```ts
export interface QuizLinkView {
  id: string;
  slug: string;
  /** The QUIZ's own track — see below. Not the course's. */
  track: LearnTrackKey;
  title: string;
  questionCount: number;
  passingScore: number;
  /** Null means unlimited (D24). */
  maxAttempts: number | null;
}
```

The alternative was to let the progress island report the quiz along with the
learner's score. ADR-056 #2 forbids it: a per-learner response carries
counters and ids and no content, so a title, a slug and a pass mark in that
payload would be content in an uncacheable response — and the island would
need slugs it is deliberately never given (`CourseStartCta` already takes an
id→href map from the page for exactly this reason).

Three rules govern the resolution, and all three are the existing ones:

- **The quiz is filtered through `publicQuizWhere()` and must have
  questions** — the same two rules `loadStandaloneQuizzes` applies, so a
  course cannot advertise an assessment whose page would 404 or that has
  nothing to answer. A quiz failing either resolves to `null`: the card is
  absent rather than broken.
- **The URL is built from the QUIZ's own track.** `Quiz.track` is required and
  independent of the course's (ADR-065 §3). A forex course may legitimately
  point at a quiz filed under crypto, and `${learnTrackPath(course.track)}/quizzes/${slug}`
  would 404 on it — the course page 404s a course loaded under the wrong
  track, and the same rule applies to the quiz.
- **`publicQuizWhere()` moves to a new leaf module, `core/src/quiz-links.ts`.**
  `quizzes.ts` already imports `publicLessonWhere` from `public-courses.ts`, so
  the obvious import — the content loader reaching into `quizzes.ts` — would
  close a cycle, and `import-x/no-cycle` is lint-enforced (architecture.md #8).
  Three modules need the rule (`quizzes.ts`, `public-courses.ts`,
  `progress.ts`), so it belongs below all three: the leaf holds the predicate,
  `loadQuizLinks()` (the batched resolver both loaders call) and
  `isQuizReachable()` (decision 8's question), and imports nothing but
  `content.ts`'s `scheduledVisibilityOr`.

The view carries a question COUNT and never the questions. What a learner may
see of a question is `guardQuizRequest`'s business and the runner's
(ADR-058 #4: the correct answer is absent from `QuizView`, not omitted).

### 2. The card is content; the LOCK is an island decision, and it needs positive evidence

The course page renders the assessment card at first paint, for everyone,
unlocked. It locks **only** when the progress API has reported, for a
signed-in learner, that required lessons remain:

| `useProgress()` status                | card         |
| ------------------------------------- | ------------ |
| `ready`, `requiredOutstanding > 0`    | locked       |
| `ready`, `requiredOutstanding === 0`  | unlocked     |
| `ready`, final quiz passed            | passed state |
| `loading` / `guest` / `off` / `error` | unlocked     |

A lock drawn on a page that cannot read a session is a lock drawn on a guess,
and for a guest it would never lift — the status stays `guest` forever, so
"finish the lessons first" would be a permanent, false statement to precisely
the reader ADR-058 #7 invites to read every question. Unlocked is also the
honest default paint: the quiz page itself tells a guest what taking one
requires.

Two fields are added to `CourseProgressView` to support it:

- **`requiredOutstanding: number`** — how many blocking lessons are left,
  computed from the SAME predicate `recomputeCourseCompletion` blocks on. The
  predicate is extracted to `blockingLessonWhere()` so the read and the
  recompute cannot disagree. `lessonsCompleted >= lessonsTotal` was the
  tempting substitute and it is wrong: both counters include optional lessons,
  so a course with one optional lesson would never unlock.
- **`finalQuiz: { passed, bestPercentage, attempts } | null`** — `null` when
  the course has none. It means the card can say "Passed · 85%" out of the
  request the page already makes, instead of a second one against
  `/api/learn/quiz/results`.

The card itself is split the way every other card on this site is: the
presentation is a `@repo/ui` component taking a finished `state`, the lock
decision is a pure function in the app's `_lib`, and the island is the thin
thing between them (architecture.md #1). This is also the only way the rule
can be tested — `apps/web`'s vitest has no DOM, deliberately, so a decision
that lives inside an app component is a decision no test can reach.

### 3. The lock is UX, and nothing about it is enforced server-side

No refusal is added to `startQuizAttempt`, and `guardQuizRequest` remains the
only boundary. A final quiz is published content; the same row can be
`isStandalone` and legitimately takeable from the index by a reader who has
opened no course at all, and D24 leaves attempts unlimited by default.

This is stated because the next reader will see a padlock and reach for
security.md #1. That rule says a hidden button is not security — it does not
say every disabled button must become a server check. Nothing is protected
here: a learner who takes the final quiz early has done nothing they were not
entitled to do, and `applyQuizPass` already declines to enrol them in a course
they never opened.

### 4. A `QUIZ_PASS` lesson shows its quiz where the manual control would be

`LessonProgressActions` still returns `null` for that rule, and the lesson page
now renders the quiz card in its place. The quiz IS the completion control for
that lesson, so the space the "Mark complete" button would occupy is the right
place for it, and passing it credits the lesson through `applyQuizPass` —
already built, previously unreachable from the lesson.

### 5. The last lesson's forward step is the assessment

No component change. `LessonNav` takes a `next` target and its own `labels`,
so the page passes the final quiz as the forward step with its own eyebrow
when there is no next lesson. The forward cell stays the filled one: the
emphasis ADR-082 #3 gives to "the way the reader is going" is exactly right
when the way is the final exam.

### 6. Recommendations are one band of cards, not a list in two places

A server-rendered "What to learn next" band of cards sits below the
curriculum. The right rail's thumbnail list and the completion banner's text
list are both deleted; the banner keeps the celebration and the
`aria-live` announcement and stops repeating three titles that are already on
screen.

The band is NOT part of the island. A recommendation is cached public content
(`resolveRecommendations` is `content`-tagged), so it renders for guests, at
first paint, and inside ISR — a completion-only band would hide the answer to
"what next" from every reader who has not finished, which is most of them.

### 7. The resume band answers a guest, and names the lesson

`ContinueBand` gains a `guest` branch: a sign-in card in the same slot, with
the same three-part shape `ProgressSignInCard` and `QuizSignInPrompt` use —
offered only to a reader the API actually answered 401 for, never while the
request is in flight, and never on `off`, because inviting someone to sign in
for a switched-off feature is a promise we cannot keep.

Its cards name the lesson being resumed ("Continue · Position sizing"),
resolved from the shelf's own cached payload against `lastLessonId` — the
titles are already there, so this costs no bytes in the per-learner response.

**It owns its band's spacing.** A component whose answer is usually "nothing"
cannot leave its `Section` to a caller that has already committed to the
padding — the lesson `QuizSignInPrompt` records.

### 8. A final quiz nobody can reach stops blocking completion

`recomputeCourseCompletion`'s second clause becomes:

> no final quiz, **or** the final quiz is not publicly reachable, **or** it has
> a passed attempt

resolved with the same `publicQuizWhere()` + has-questions rule decision 1
uses. This is a bug fix, and the carve-out beside it is its precedent: a
`QUIZ_PASS` lesson whose quiz was deleted already stops blocking, because an
unsatisfiable requirement makes a course permanently incompletable through an
editor's action. Un-publishing a final quiz was the same failure by a
different route, and it was worse — it applied to every enrolled learner at
once and left no trace on any screen.

It also keeps one rule where there were about to be two: **what the course page
shows as the assessment is exactly what completion requires.**

## Consequences

- A course with a final quiz is completable through the interface for the
  first time. The completion banner, `progress.courseCompleted`, and the
  `completedAt` stamp were all unreachable for such a course before this.
- `CourseView` and `LessonView` grew a nested view. The payload test that
  asserts the learn index carries no lesson bodies must learn about it — and
  the same rule applies: a count, never the questions.
- An editor who un-publishes a final quiz now makes the assessment card
  disappear AND stops it blocking completion, in one consistent step. A
  learner who had already passed it keeps their completion, because
  `completedAt` is preserved once set.
- The padlock is the first disabled control on the public site that reflects
  per-learner state. It renders after hydrate, in place, with no layout shift,
  because the unlocked card is the same card.
- Three surfaces now link a quiz from outside the quiz index (course
  assessment, `QUIZ_PASS` lesson, lesson pager), and all three build the href
  from the quiz's own track through one helper. A fourth adds a call, not a
  rule.
- Not done here: `/learn/**` axe and Lighthouse budgets, still owed to
  Module 14; the RTL pass over the new band and the padlock; and any resume
  surface outside the learning area (the homepage and the site header are
  deliberately untouched — a session read in either would uncache the shell,
  ADR-029's reason for `part-data:` tagging).
