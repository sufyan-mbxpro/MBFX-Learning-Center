# changes-25 (learning journey) — the assessment, the next step, and the resume

**Owner ask:** 2026-09-12, this session (verbatim in §1).
**ADR:** ADR-084 (written first, PR L0).
**Modules:** 11 (content system), 12 (public site).
**Branch:** off `changes-20-phase-5-6`'s successor; PRs L0 → L6 in order.
**Schema:** no migration. Nothing in the write path changes except one
completion clause (L1, ADR-084 #8).

---

## 1. The brief, line by line

| #   | The ask (owner's words)                                                                                                                                                                          | Verdict against the tree                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | "on the courses completion, there is a settings attachements of quiz attachements … on the public site … there should be show the attached quize with that course & user can attempt that quize" | **Not built, and a dead end.** `Course.finalQuizId` blocks completion but reaches no view. A course with a final quiz cannot be completed through the UI at all. → L1, L2 |
| B2  | "there should be clear suggestions of new course recommendations"                                                                                                                                | **Built thinly, twice.** A 48px list in the right rail plus a text list in the completion banner. → L4                                                                    |
| B3  | "there should also show the last read course progress … when user login that site then it should record the last opened course & last selected lessons"                                          | **Already built end to end.** `touchLesson` writes `lastLessonId`/`lastActiveAt`; `ContinueBand` + `CourseStartCta` read them. Gap is presentation only. → L5             |
| B4  | "there should be dislay the login button to show the last opened course progress session"                                                                                                        | **Not built in that slot.** `ContinueBand` returns `null` for a guest. → L5                                                                                               |

Two defects fall out of B1 and are fixed with it, both named in ADR-084:

| #   | Defect                                                                                                                                                              | Where  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D1  | A `QUIZ_PASS` lesson renders nothing where its completion control would be (`lesson-progress-actions.tsx:33`), so it can never be completed from its own page.      | L1, L3 |
| D2  | Un-publishing a final quiz makes every enrolled learner's course permanently incompletable — the requirement survives, the way to satisfy it does not (ADR-084 #8). | L1     |

---

## 2. Decisions

### 2.1 Taken by the owner (2026-09-12)

1. **Plan + ADR first, then build.**
2. **The assessment card is visible always and locked until the lessons are
   done** — it unlocks in place, no reload.

### 2.2 Taken in this plan (from ADR-084; reversible, flagged)

3. The lock needs **positive evidence**: `loading`/`guest`/`off`/`error` all
   render the card UNLOCKED (ADR-084 #2). A guest never sees a padlock that
   could not lift.
4. The lock is **UX only** — no server-side refusal (ADR-084 #3).
5. **One `AssessmentCard`, split the way this repo splits every card.** The
   presentation lives in `@repo/ui` and takes a finished `state`; the lock
   DECISION is a pure function in the app's `_lib`; the island is the thin
   thing between them. That is not ceremony — `apps/web`'s vitest has **no
   DOM** (stated in `_lib/quiz-presentation.test.ts:12`), so a rule that only
   exists inside an app component cannot be tested at all, while a pure
   derivation and a `@repo/ui` component both can. Two gates
   (`"required-lessons"` for a course final, `"none"` for a lesson quiz)
   rather than two near-copies.
6. **Recommendations move out of the rail** into one band of cards below the
   curriculum, and the completion banner stops repeating them (ADR-084 #6).
7. **No resume surface outside the learning area.** The homepage and the site
   header stay untouched: a session read in the shell would uncache it.

---

## 3. What exists today (verified against the tree, 2026-09-12)

| Thing                                                                      | Where                                                     | State                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| `CourseEnrollment.lastLessonId` / `lastActiveAt`                           | `packages/db/prisma/schema.prisma:981,985`                | exists, written on every lesson open         |
| `touchLesson`, `markLessonComplete`, `recomputeCourseCompletion`           | `packages/core/src/progress.ts`                           | complete; locked + `ReadCommitted`           |
| `applyQuizPass` credits a `QUIZ_PASS` lesson, recounts a final-quiz course | `packages/core/src/quizzes.ts:1126`                       | complete, and previously unreachable from UI |
| `getLearnerDashboard` / `GET /api/learn/progress`                          | `progress.ts`, `apps/web/app/api/learn/progress/route.ts` | complete                                     |
| `getQuizProgressForUser` / `GET /api/learn/quiz/results`                   | `quizzes.ts:1257`, `.../quiz/results/route.ts`            | complete                                     |
| `ContinueBand` ("pick up where you left off")                              | `.../learn/_components/course-shelf.tsx:388`              | renders for signed-in learners only          |
| `CourseStartCta` (start / continue / review)                               | `.../learn/_components/course-progress.tsx:66`            | complete                                     |
| `ProgressSignInCard`, `QuizSignInPrompt`                                   | `course-progress.tsx:97`, `quiz-sign-in-prompt.tsx`       | the guest-card pattern to copy               |
| `resolveRecommendations`                                                   | `packages/core/src/public-courses.ts:752`                 | cached, `content`-tagged                     |
| `publicQuizWhere`                                                          | `packages/core/src/quizzes.ts:179`                        | to be **moved** (L1)                         |
| `QuizCard` (index card)                                                    | `packages/ui/src/components/quiz-card.tsx`                | stays as is; not reused for the assessment   |
| `LessonNav` (`next` + `labels.next`)                                       | `packages/ui/src/components/lesson-nav.tsx:45`            | needs **no change** for L3                   |
| `CourseView.finalQuiz`, `LessonView.quiz`                                  | —                                                         | **absent** — the whole of B1                 |

Test homes that already exist: `packages/core/src/learn.integration.test.ts`,
`progress.integration.test.ts`, `quizzes.integration.test.ts` (all
Testcontainers/MariaDB), and `apps/web/app/(public)/[locale]/learn/_lib/quiz-presentation.test.ts`.
There is still no Playwright config, so every acceptance criterion below is
proved by a Vitest test or an integration test, never by an E2E.

---

## 4. PR order and dependencies

```
L0 (docs)  →  L1 (contracts + core)  →  L2 (course assessment)  →  L3 (lesson)
                                    ↘  L4 (recommendations band)
                                    ↘  L5 (resume + guest)        →  L6 (gate, DEVLOG)
```

L2–L5 are independent of one another once L1 lands.

---

### PR L0 — ADR-084, rules, module index (docs only)

- [x] `docs/memory/decisions/ADR-084-the-assessment-is-part-of-the-course.md`
- [ ] `docs/changes/changes-25-plan.md` (this file)
- [ ] `claude.md` — Module 11 and 12 rows gain the ADR-084 sentence: the
      assessment reaches the page through the content loader, the lock is
      advisory, an unreachable final quiz stops blocking, and the quiz href
      comes from the quiz's own track.
- [ ] `.claude/skills/content/SKILL.md` and `.claude/skills/public-site/SKILL.md`
      — the same, one paragraph each.

**Exit:** `pnpm governance:check` passes with the ADR present and no code diff.

---

### PR L1 — the quiz reaches the view, and completion stops lying

**`packages/contracts/src/learn.ts`**

- [ ] `export interface QuizLinkView { id; slug; track: LearnTrackKey; title; questionCount; passingScore; maxAttempts: number | null }`
- [ ] `export function quizLinkPath(track: LearnTrackKey, slug: string): string`
      — beside `learnTrackPath` (`learn.ts:86`), returns
      `${learnTrackPath(track)}/quizzes/${slug}`. **The one way** any surface
      outside the quiz index builds a quiz href (ADR-084 #1's third rule).
- [ ] `CourseProgressView` gains: - `requiredOutstanding: number` - `finalQuiz: { passed: boolean; bestPercentage: number; attempts: number } | null`

**NEW `packages/core/src/quiz-links.ts`** — a leaf module, because
`quizzes.ts` already imports `public-courses.ts` and `import-x/no-cycle` is
lint-enforced.

- [ ] `export function publicQuizWhere(now = new Date())` — **moved verbatim**
      from `quizzes.ts:179`, comment and all.
- [ ] `export async function loadQuizLinks(ids: (string | null)[], locale: string): Promise<Map<string, QuizLinkView>>`
      — one query for the page's quizzes. Drops a row that is not
      `publicQuizWhere()`, has no questions, has no usable translation, or
      whose `track` is not a `LearnTrackKey` — the four rules
      `loadStandaloneQuizzes` (`quizzes.ts:783`) already applies.
- [ ] `export async function isQuizReachable(tx: Prisma.TransactionClient, quizId: string): Promise<boolean>`
      — the same predicate + `questions > 0`, for the completion clause below.

**`packages/core/src/quizzes.ts`**

- [ ] Delete the local `publicQuizWhere`; import it from `./quiz-links.ts`.
      Do **not** re-export it — `index.ts` uses `export *` and two stars
      exporting one name is ambiguous.

**`packages/core/src/index.ts`**

- [ ] `export * from "./quiz-links.ts";`

**`packages/core/src/public-courses.ts`**

- [ ] `CourseView` gains `finalQuiz: QuizLinkView | null`.
- [ ] `LessonView` gains `quiz: QuizLinkView | null` **and**
      `courseFinalQuiz: QuizLinkView | null` — the lesson pager needs the
      course's final quiz on the last lesson (L3), and both come out of one
      `loadQuizLinks` call.
- [ ] `loadCourseBySlug` (`:365`) selects `finalQuizId`; resolves through
      `loadQuizLinks`.
- [ ] `loadLessonBySlug` (`:452`) selects `quizId` and
      `section: { course: { select: { finalQuizId: true } } }`; one
      `loadQuizLinks([quizId, finalQuizId], locale)`.

**`packages/core/src/progress.ts`**

- [ ] Extract the existing inline `blockingLesson` predicate
      (`progress.ts:210`) to `blockingLessonWhere(courseId)`, exported, and
      use it in both `recomputeCourseCompletion` and `getCourseProgress`.
- [ ] `recomputeCourseCompletion`: the `finalQuizPassed` clause
      (`progress.ts:241`) becomes
      `finalQuizId == null || !(await isQuizReachable(tx, finalQuizId)) || passedAttemptExists`
      (**D2**, ADR-084 #8).
- [ ] `getCourseProgress`: count `requiredOutstanding` with
      `blockingLessonWhere`, and read the final quiz's best attempt for
      `finalQuiz`. Both inside the existing `Promise.all`.

**Tests**

- [ ] `learn.integration.test.ts` — a published final quiz with questions
      reaches `CourseView.finalQuiz`; a DRAFT one, a soft-deleted one, one
      with zero questions and one with no translation each resolve to `null`;
      `finalQuiz.track` is the QUIZ's track even when it differs from the
      course's; a `QUIZ_PASS` lesson's `LessonView.quiz` is populated.
- [ ] `progress.integration.test.ts` — `requiredOutstanding` ignores optional
      lessons (a course with 2 required + 1 optional, both required done →
      `0`, while `lessonsCompleted < lessonsTotal`); un-publishing a final
      quiz completes a course whose lessons are all done (**D2**), and
      re-publishing it drops the course back out of completion;
      `finalQuiz.bestPercentage` reports the best of two attempts.
- [ ] `packages/contracts/src/learn.test.ts` — `quizLinkPath` for both tracks.

---

### PR L2 — the final assessment on the course page

**NEW `packages/ui/src/components/assessment-card.tsx`** — presentational,
catalog-free, takes a finished `state`.

```tsx
export type AssessmentState = "locked" | "open" | "passed";

export function AssessmentCard({
  href,
  state,
  questionCount,
  passingScore,
  maxAttempts, // null = unlimited (D24)
  bestPercentage, // only read in "passed"
  labels, // AssessmentCardLabels — finished strings
  className,
}: AssessmentCardProps);
```

- [ ] Three states in one shell, one height: **locked** (disabled CTA +
      "finish the remaining lessons"), **open** ("Start the final
      assessment"), **passed** (score + "Retake"). The CTA swaps in place, so
      hydrate shifts nothing.
- [ ] `locked` uses `Button` `disabled` — never `opacity-*` on text-bearing
      ink (ADR-082 #3's lesson: axe cannot compute contrast through an
      ancestor opacity).
- [ ] Exactly one link to the quiz, and it is not stretched — like
      `VideoCard` and unlike `QuizCard` (ADR-068 §7): this card sits inside a
      column of other controls.

**NEW `.../learn/_lib/assessment-state.ts`** — the lock decision, pure.

```ts
export function resolveAssessmentState(input: {
  status: ProgressStatus;
  gate: "required-lessons" | "none";
  requiredOutstanding: number | undefined;
  passed: boolean | undefined;
}): AssessmentState;
```

- [ ] `"locked"` **only** when
      `status === "ready" && gate === "required-lessons" && requiredOutstanding > 0`
      (ADR-084 #2). `loading`, `guest`, `off`, `error` → `"open"`.
- [ ] `"passed"` wins over everything: a learner who has passed sees their
      score even if a newly-published lesson has put them back in progress.

**NEW `.../learn/_components/final-assessment.tsx`** (`"use client"`) — the
island: `useProgress()` → `resolveAssessmentState` → `AssessmentCard`, plus
`aria-live="polite"` on the state line, for the reason
`CourseCompletionBanner` carries it.

**`.../learn/[track]/[course]/page.tsx`**

- [ ] `isFeatureVisible("quizzes", null)` beside the existing `courses` check;
      the card is absent when the feature is off, never disabled.
- [ ] Render `AssessmentCard` as the terminal step of the curriculum column,
      below `CurriculumWithProgress` — where a learner who has finished the
      timeline actually is.
- [ ] Href via `quizLinkPath(view.finalQuiz.track, view.finalQuiz.slug)`.

**i18n** — `packages/i18n/messages/en.json`, `learn.assessment.*`:
`title`, `intro`, `questions`, `passMark`, `attemptsUnlimited`, `attempts`,
`start`, `retake`, `lockedTitle`, `lockedBody` (`{count}` remaining),
`passedLabel`, `bestLabel`. `en` only — `ENFORCED_LOCALES` is `{en}`.

**Tests**

- [ ] `packages/ui/src/components/assessment-card.test.tsx` (jsdom + RTL, as
      every other `@repo/ui` card has) — `locked` renders a disabled control
      and no navigable link; `open` and `passed` render exactly one link to
      `href`; no `opacity-` class anywhere in the rendered markup; the
      unlimited-attempts label is used when `maxAttempts` is null.
- [ ] `.../learn/_lib/assessment-state.test.ts` — the full status × gate
      matrix (5 × 2), plus "passed wins".
- [ ] `apps/web/app/(public)/[locale]/learn/quiz-links.test.ts` — a source
      guard in the app's own style (`explore-destinations.test.ts`,
      `public-chrome.test.ts`): no file under `learn/**` builds a `/quizzes/`
      href by template literal; `quizLinkPath` is the only constructor.

---

### PR L3 — the lesson page: the quiz that completes it, and the forward step

**`.../learn/[track]/[course]/[lesson]/page.tsx`**

- [ ] Where `LessonProgressActions` renders nothing (`completionRule === "QUIZ_PASS"`),
      render `FinalAssessment` with `gate="none"` and `view.quiz` (**D1**). A
      `QUIZ_PASS` lesson whose quiz is unreachable renders neither — and
      `recomputeCourseCompletion` already refuses to let that lesson block.
- [ ] When `view.next === null` and `view.courseFinalQuiz !== null`, pass the
      quiz as `LessonNav`'s `next` with `labels.next = t("assessment.navLabel")`.
      No `@repo/ui` change (ADR-084 #5).

**i18n** — `learn.assessment.navLabel`, `learn.assessment.lessonQuizTitle`,
`learn.assessment.lessonQuizIntro`.

**Tests** (no DOM in `apps/web` — the forward-step choice is extracted so it
can be tested)

- [ ] NEW `.../learn/_lib/lesson-forward.ts` +`.test.ts` —
      `resolveForwardStep({ next, courseFinalQuiz, coursePathname })` returns
      the next lesson when there is one, the final quiz when there is not,
      and `null` when there is neither. The page renders what it returns.
- [ ] `learn.integration.test.ts` (extends L1's cases) — a `QUIZ_PASS`
      lesson's `LessonView.quiz` carries the quiz's own track, so the href the
      page builds is the reachable one.

---

### PR L4 — recommendations become a band of cards

**NEW `.../learn/_components/next-courses.tsx`** (server component)

- [ ] `NextCoursesBand({ courses, labels })` — a `Section` + `Container` +
      `SectionHeading` over **`@repo/ui`'s existing `CourseCard`**, one per
      recommendation, `sections: []` so no curriculum disclosure appears. No
      new UI component: a recommendation is a course, and a second card for
      it would drift from the shelf's.
- [ ] `grid grid-cols-1 lg:grid-cols-2` (code-style.md #23 — the base is
      stated; `grid-base.test.ts` enforces it repo-wide). Two across, not
      three: `CourseCard` is landscape (cover beside a copy column), so three
      in a `container-page` leaves the copy column too narrow to read.
- [ ] Covers through `courseCoverUrl` + `isGeneratedCover`, difficulty tone
      through `_lib/learn-labels.ts` — the one cover rule and the one tone
      map, unchanged.

**`.../learn/[track]/[course]/page.tsx`**

- [ ] Render the band below the curriculum column's `Section`.
- [ ] **Delete** the right rail's recommendation list (`page.tsx:381–420`).
- [ ] `CourseCompletionBanner` loses its `recommendations` prop and its inner
      list; it keeps the celebration, the `aria-live`, and gains an anchor
      link to the band.

**i18n** — `learn.course.nextTitle`, `learn.course.nextIntro`. `course.recommendations`
/ `.recommendationsIntro` are re-used or retired (retire only if unreferenced).

**Tests**

- [ ] `apps/web/app/grid-base.test.ts` — already repo-wide; the new band is
      covered by it the moment it exists (this is the check, not a new test).
- [ ] `.../learn/_lib/learn-labels.test.ts` (NEW, pure) — `difficultyTone`
      returns a registered tone for every `Difficulty` member, so a
      recommendation card can never render an unknown Badge variant.
- [ ] A source guard in `quiz-links.test.ts`'s file: `course-completion.tsx`
      contains no `.map(` over courses — the banner's list is gone and does
      not come back.

---

### PR L5 — the resume band answers a guest, and names the lesson

**`.../learn/_components/course-shelf.tsx`** (`ContinueBand`, `:388`)

- [ ] `status === "guest"` → a sign-in card in the same slot: title, one line,
      `Button` → `ROUTE_PATHS["sign-in"]` (**B4**). `off`, `loading` and
      `error` still render nothing.
- [ ] Each resume card names the lesson: resolve `lastLessonId` against the
      shelf's own payload and render "Continue · {lesson}" under the progress
      bar. The per-learner response is unchanged — the titles are already in
      the cached page (ADR-056 #2).
- [ ] The band owns its `Section` in every branch it renders, and renders no
      `Section` when it says nothing (the `QuizSignInPrompt` lesson).

**i18n** — `learn.progress.guestResumeTitle`, `.guestResumeBody`,
`.resumeLesson`.

**Tests** (pure, for the same no-DOM reason)

- [ ] NEW `.../learn/_lib/resume.ts` + `.test.ts` —
      `resolveResumeRows(tracks, enrollments, limit)` returns
      `{ course, enrollment, resumeHref, resumeLessonTitle }[]`: drops an
      enrollment whose course is not on the shelf, falls back to the course
      href when `lastLessonId` names a lesson that is no longer published,
      names the lesson when it is, and respects `CONTINUE_LIMIT`.
- [ ] `.../learn/_components/course-shelf.test.ts` (NEW source guard) — the
      `guest` branch links `ROUTE_PATHS["sign-in"]`, and every `return null`
      in `ContinueBand` precedes its `Section` (nothing renders an empty
      band).

---

### PR L6 — the gate

- [ ] `pnpm lint`, `pnpm typecheck`, then per-package `pnpm test` for
      `@repo/contracts`, `@repo/core`, `@repo/ui`, `apps/web` (root `pnpm test`
      and `pnpm build` are known to exhaust resources on this machine — the
      gate is lint → typecheck → per-package tests → dev server).
- [ ] `pnpm check:catalog-completeness`, `pnpm check:phantom-deps`,
      `pnpm governance:check`.
- [ ] Manual pass on the dev server: a course with a final quiz, signed out
      (card unlocked) → signed in mid-course (card locks) → all lessons done
      (card unlocks) → pass the quiz (banner + "Passed") → `/learn` resume
      band names the lesson.
- [ ] `docs/logs/DEVLOG.md` entry: date, module, what shipped, ADR-084, test
      results.

---

## 5. Criterion → test

| #   | Acceptance criterion                                                          | Proof                                                                            |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| C1  | A course's published final quiz appears on its public page and is attemptable | `learn.integration.test.ts` (the view) + `assessment-card.test.tsx` (the link)   |
| C2  | An unpublished / empty / deleted / untranslated final quiz shows no card      | `learn.integration.test.ts`                                                      |
| C3  | The card is locked only for a signed-in learner with required lessons left    | `assessment-state.test.ts` (5 × 2 matrix)                                        |
| C4  | A guest is never shown a padlock                                              | `assessment-state.test.ts`                                                       |
| C5  | `requiredOutstanding` ignores optional lessons                                | `progress.integration.test.ts`                                                   |
| C6  | Passing the final quiz completes the course and the card says so              | `progress.integration.test.ts` + `assessment-card.test.tsx` (`passed`)           |
| C7  | An unreachable final quiz stops blocking completion (D2)                      | `progress.integration.test.ts`                                                   |
| C8  | A `QUIZ_PASS` lesson offers its quiz (D1)                                     | `learn.integration.test.ts` (`LessonView.quiz`) + the L3 page diff               |
| C9  | The last lesson's forward step is the assessment                              | `lesson-forward.test.ts`                                                         |
| C10 | Every quiz href in the learn area is built from the quiz's own track          | `quiz-links.test.ts` (source guard) + `contracts/learn.test.ts` (`quizLinkPath`) |
| C11 | Recommendations render as cards, in one place, for guests too                 | `grid-base.test.ts` + the `course-completion.tsx` source guard                   |
| C12 | A signed-in learner sees the resumed lesson by name                           | `resume.test.ts`                                                                 |
| C13 | A guest sees a sign-in button in the resume slot (B4)                         | `course-shelf.test.ts` (source guard)                                            |
| C14 | Nothing renders an empty band when it has nothing to say                      | `course-shelf.test.ts`                                                           |
| C15 | The locked CTA carries no ancestor opacity (axe cannot see through one)       | `assessment-card.test.tsx`                                                       |

---

## 6. Not in scope

- **Any resume surface outside `/learn`** — homepage, header, footer
  (decision 7). A session read in the shell uncaches it.
- **Server-side gating of a final quiz** (ADR-084 #3).
- **A certificate, a badge, or anything else at completion.** D18's
  completion criteria are honoured; its rewards are not this change.
- **`/learn/**` axe + Lighthouse budgets and the RTL smoke pass** — Module 14
  still owes them, and this change adds two surfaces to that debt.
- **Quiz attachments** in the "downloadable file" sense. The owner's phrase
  "quiz attachements" is `Course.finalQuizId` and `Lesson.quizId`; lesson file
  attachments already render (`lesson/page.tsx:307`).

## 7. Risks

| Risk                                                                                    | Mitigation                                                                                               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Moving `publicQuizWhere` touches seven call sites in `quizzes.ts`                       | Verbatim move, no behaviour change; `quizzes.integration.test.ts` already covers the visibility rule.    |
| D2 changes a completion rule, so a course that was stuck may complete on the next write | That is the fix. Called out in the DEVLOG; `completedAt` is preserved once set, so nothing is restamped. |
| The card's three states after hydrate could shift layout                                | One card, one height, the CTA swaps in place — the same discipline `course-progress.tsx` documents.      |
| `LessonView` grows two nested views on every lesson payload                             | Both are one row each, resolved in one batched query; the payload test asserts no questions ride along.  |
