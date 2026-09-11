# ADR-058: The quiz is a standalone entity; consumers point at it, and every score is the server's

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 11 (content system), 12 (public site), 09 (admin shell), 03 (RBAC)
**Supersedes:** —
**Superseded by:** —

## Context

`changes-11-plan.md` D24 settled the shape of quizzes and deferred the rest to
"ADR-058 at kickoff". This is that ADR. Phase 5 shipped progress; quizzes are
the half of completion ADR-056 #5 and #7 left unreachable — `CompletionRule`
already has a `QUIZ_PASS` member with nothing able to satisfy it, and
`recomputeCourseCompletion` already carries a `finalQuizPassed` conjunct
hardcoded to `true`.

Three existing constraints bound this, and one of them turned out to be wrong
in a way worth recording rather than working around:

1. `plan.md` Part F #12 / ADR-042: composition is code, content is data. A quiz
   is content; how a quiz is presented is not.
2. `security.md` #6: parse, don't spread — and its read-path corollary, which
   the plan states plainly: correct answers must be **stripped in the view
   type, not hidden in the UI**.
3. The `quizzes` feature flag is seeded `enabled: false` with **`AUTHENTICATED`
   visibility**. That third one has a consequence the plan's own UI sketch did
   not account for; see decision 7.

## Decision

### 1. The quiz is standalone; consumers hold the FK (D24)

```
Quiz                     the entity
Lesson.quizId       → Quiz?    the lesson quiz, satisfying CompletionRule.QUIZ_PASS
Course.finalQuizId  → Quiz?    the final quiz, the second conjunct of ADR-056 #7
Quiz.isStandalone              listed at /learn/quizzes
```

Nullable `courseId`/`lessonId` on `Quiz` was the alternative and it makes
illegal states representable — both set, or a quiz attached to a lesson in
another course — while making reuse impossible. Inverting the direction gives
one model, three uses, no illegal states, and the same quiz reusable in more
than one place.

`isStandalone` controls **public listing only**. A lesson quiz is not listed at
`/learn/quizzes` even though it remains reachable by slug; the flag is an
editorial choice about the index, not an access control.

### 2. The correct answer never leaves the server, and never enters a translation

`QuizQuestion.correctAnswer` is JSON on the **untranslated** row.
`QuizQuestionTranslation` carries the prompt, the option labels and the
per-option explanations. A correct-answer index is not language, and putting it
in a translation row lets a translator desync it from every other locale — a
bug that would present as "the quiz is wrong in Spanish".

`QuizView`, the type `getQuizBySlug` returns, **has no field for it.** This is
the read-path form of `security.md` #6: the answer is absent from the type, so
no page, no route handler and no future refactor can leak it by forgetting to
omit a property. A test asserts the serialized payload contains no
`correctAnswer` key.

### 3. Scoring is server-side, always, and an attempt is a server-owned row

The client never computes correctness and never submits a score. An attempt is
created server-side, each answer is graded server-side against the stored
`correctAnswer`, and the final score is computed from **what the server
recorded**, not from anything the browser sends at the end.

The submit call therefore carries only an attempt id. There is no field for a
score, so a forged one is not "ignored" — it is unrepresentable.

### 4. Correctness feedback during an attempt is gated by `showAnswersAfter`

The reference layout shows a live "✓ 3 ✗ 1" counter, which requires the server
to tell the learner whether each answer was right as they go. That is a
correctness oracle, and it directly contradicts `showAnswersAfter: NEVER`.

**Decision:** the per-answer response returns `correct` only when
`showAnswersAfter` is `AFTER_SUBMIT` or `AFTER_PASS`. Under `NEVER` it returns
that the answer was recorded and nothing else, and the runner's counter shows
**progress** rather than score. One setting, honoured everywhere, rather than a
setting that governs the review screen and is quietly bypassed by the runner.

Note what this does not gate: `showAnswersAfter` governs revealing **the
correct answer and its explanation**. `AFTER_PASS` still shows per-answer
correctness during the attempt — the learner learns they were wrong, not what
the right answer was — which is the distinction the three values are for.

### 5. Per-answer rows are not created, with one named cost (D24)

Answers live in `QuizAttempt.answers` as JSON. They are only ever read as a
whole set, for one attempt, by one user; no query filters on them, so
`QuizAttemptAnswer` would be rows-per-question-per-attempt for zero query
benefit, and the review screen is served exactly as well by the JSON.

**The one thing this forecloses cheaply is "most frequently missed questions"**,
which needs SQL aggregation across attempts. That analytic — and only that one
— is the trigger for adding `QuizAttemptAnswer`. Everything else (attempts,
average score, pass rate) aggregates from `QuizAttempt` columns.

### 6. Passing a quiz writes `LessonProgress` rows; it does not create a second completion mechanism

A `QUIZ_PASS` lesson is completed by **writing the same `COMPLETED`
`LessonProgress` row a manual completion writes**, from the server, when its
quiz is passed. It is not computed dynamically at read time.

This matters more than it looks. ADR-056 #2 made `LessonProgress` the source of
truth and `lessonsCompleted` a recount over it; a lesson whose completion was
derived at read time would be true in the curriculum and invisible to the
counter, and the two would disagree forever. One writer, one truth.

`Course.finalQuizId` is the exception and stays a live check, because it is a
course-level rule with no lesson to hang a row on — which is exactly the shape
`recomputeCourseCompletion` was written for in Phase 5. Adding it replaced one
hardcoded `true` with one query, as ADR-056 #7 promised.

### 7. Guests read quizzes; taking one requires an account

The `quizzes` flag was seeded `AUTHENTICATED` in Module 01, long before there
was a quiz. **This ADR changes it to `enabled: true, visibility: PUBLIC`**, and
the reason is a constraint the seeded value could not have anticipated.

`AUTHENTICATED` does not mean "signed-in learners see the tab". The learn
layout is cached and reads no session (ADR-056 #1), so it evaluates every
section flag with a `null` subject — and `evaluateVisibility` answers false for
`AUTHENTICATED` against a null subject. The Quizzes tab would therefore be
absent for **everyone, signed in or not**, and the only way to reach a quiz
would be a URL nobody is given. The flag as seeded does not gate the feature;
it hides it.

The coherent split is the one the rest of the site already uses (ADR-056 #3):
**guests read everything, saving requires an account.** A quiz is learning
content, like a lesson. So:

- The index and the runner are **public reads**. A guest can open a quiz and
  read every question.
- **Starting an attempt requires a session.** The attempt endpoints check it
  first, before the flag, and answer 401 — which is what puts the plan's "save
  your scores" prompt on screen rather than making it unreachable.
- No anonymous attempts, no throwaway attempt row, no guest identity. ADR-056 #3
  refused a guest-progress mechanism and this does not smuggle one in: a guest
  can read the questions and gets no score, no grading and no stored row.

**What this does not do** is make quiz _answers_ public. The correct answer is
absent from the read path entirely (decision 2), so a guest reading the page
sees exactly what a signed-in learner sees before they answer.

### 8. Quizzes are gated by the `lessons.*` permission keys

There are no `quizzes.*` keys in the seed registry, and this ADR does not add
any. `changes-11-plan.md` §18 rule #3 forbids new permission keys, and the
reuse is coherent rather than merely convenient: a quiz is authored beside the
lessons it belongs to, from the same screens, by the same people, and
`lessons.publish` already represents "may make learning content live".

**The named cost:** quiz authorship cannot be granted independently of lesson
authorship. If an editor ever needs one without the other, that is the trigger
for a `quizzes.*` group — a seed change plus role wiring, additive, and cheap
because every call site names its key in one place.

### 9. Presentation is code (ADR-042)

The runner's one-question-at-a-time layout, the pill options, the progress
counter, the result card and the review list are code. What is data: the
questions, their options, the correct answers, the explanations, the passing
score, the attempt limit and `showAnswersAfter`. There is no admin-configurable
quiz layout and no per-quiz theming.

## Consequences

- **A quiz can be deleted out from under a lesson.** `Lesson.quizId` is
  `onDelete: SetNull`, so the lesson reverts to having no quiz rather than
  cascading a lesson away with its quiz. A `QUIZ_PASS` lesson whose quiz has
  gone is unsatisfiable, so `recomputeCourseCompletion` treats a `QUIZ_PASS`
  lesson with no quiz as **not completable and therefore not blocking** — the
  alternative is a course no learner can ever finish because of an editor's
  delete.
- **Attempts survive the quiz being edited.** An attempt records the answers
  given, not the questions asked; rewriting a question does not invalidate past
  attempts, and it does mean an old attempt's review can show a prompt that has
  since changed. This is the same trade ADR-056 #6 took for lessons, for the
  same reason: telling a learner they have un-passed something is worse.
- **`maxAttempts` is null by default — unlimited.** Right for a learning site;
  a limit is available for anyone who wants one.
- **`answers Json` is schemaless at the database level.** It is parsed through
  a Zod schema on the way in and on the way out, so a malformed row is a
  handled error rather than a crash, but the database will not stop a bad
  write from another codepath. There is exactly one writer.
- **The runner needs a session and therefore cannot be statically cached.** The
  quiz CONTENT is cached (`"use cache"` + `cacheTag("content")`, questions and
  options, no answers); the attempt is entirely client-driven against the API,
  exactly like progress (ADR-056 #1). No quiz page reads a session server-side.

## Alternatives considered

- **Nullable `courseId`/`lessonId` on `Quiz`.** Rejected: illegal states become
  representable and reuse becomes impossible (D24).
- **Correct answers on the translation row.** Rejected: a translator can desync
  them, and a correct-answer index is not language.
- **Grading in the browser with a server re-check on submit.** Rejected: it
  ships the answers to the client, which is the one thing that must not happen.
  "Re-checked on submit" would make it a correctness leak with extra steps.
- **A live ✓/✗ counter regardless of `showAnswersAfter`.** Rejected: it makes
  `NEVER` a lie (decision 4).
- **`QuizAttemptAnswer` rows now.** Rejected with a named trigger (decision 5).
- **Computing `QUIZ_PASS` completion at read time.** Rejected: it would make
  the curriculum and the counter disagree permanently (decision 6).
- **A `quizzes.*` permission group.** Rejected for now against plan rule #3,
  with the trigger for revisiting named (decision 8).

## Compliance

- Integration test: `getQuizBySlug`'s payload, serialized, contains no
  `correctAnswer` key for any question type.
- Integration test: a submitted attempt is scored from the server's stored
  grades; the submit payload has no score field to forge.
- Integration test: `showAnswersAfter: NEVER` never returns `correct` from the
  answer endpoint, and never returns the correct answer or explanation from the
  result.
- Integration test: `AFTER_PASS` withholds the review from a failed attempt and
  returns it on a passed one.
- Integration test: `maxAttempts` is enforced server-side; the n+1th start is
  refused.
- Route test: an anonymous caller can read a quiz page and is refused an
  attempt with 401 (decision 7).
- Integration test: passing a lesson's quiz writes a `COMPLETED`
  `LessonProgress` row and moves `lessonsCompleted` — the same counter a manual
  completion moves.
- Integration test: a course with all lessons complete and an unpassed
  `finalQuizId` is NOT complete; passing the final quiz completes it without
  any lesson write.
- Integration test: a `QUIZ_PASS` lesson whose quiz was deleted does not block
  course completion.
- Integration test: MULTIPLE_CHOICE grading is set equality — a subset and a
  superset both score zero.
- Unit test: every admin write parses through `@repo/contracts` and every
  option index in `correctAnswer` is within the question's option count.
