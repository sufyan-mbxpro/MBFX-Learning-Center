# ADR-139 — Learning content carries the article's three flags, and the shelves filter on them

- **Status:** Accepted
- **Date:** 2026-09-18
- **Module:** 11 (content system), 12 (public site), 09 (admin shell)
- **Plan:** owner request, `docs/changes/changes-42-fixeing.md` items 5, 6 and 9
- **Extends:** ADR-015 #4 (an article's `isActive` hides it without touching
  its status), ADR-071 (visibility is decided in the query). Supersedes nothing.

## Context

The owner, pointing at the article editor's "Featured Post / Active / Premium"
switches:

> each modules, courses, videos, topics, glossary should have all 3 option
> available like in the news showing

and, separately:

> there should be top level filters available on the public site to show the
> specific categories like featured/popular courses, news etc.

Only `Article` carries all three. `GlossaryTopic` has `isActive` and nothing
else. `Course`, `Lesson` ("modules" in the owner's words — the unit a course is
built from), `Quiz`, `VideoTopic` and `GlossaryTerm` have none. Their only
public switch is the seven-state status machine, so taking a course off the
site meant moving it out of PUBLISHED and losing its place in the workflow —
exactly the problem ADR-015 #4 solved for articles.

## Decision

### 1. Three columns, same names, same defaults, on six models

`isFeatured Boolean @default(false)`, `isActive Boolean @default(true)` and
`isPremium Boolean @default(false)` on `Course`, `Lesson`, `Quiz`,
`VideoTopic` and `GlossaryTerm`; `isFeatured` and `isPremium` on
`GlossaryTopic`, which already has `isActive`. The defaults are the article's,
so every existing row keeps its current public state: active, not featured,
not premium. The migration adds columns and writes nothing else.

### 2. `isActive` is part of each type's ONE public rule

`publicCourseWhere`, `publicLessonWhere`, `publicQuizWhere`,
`publicGlossaryTermWhere` and the video topic's rule each gain
`isActive: true`. Because ADR-071 and ADR-084 #1 already route every public
read — pages, search, sitemap, recommendations, lesson counts, completion — through
those predicates, an inactive row disappears everywhere at once and cannot be
reached by a surface that forgot. An inactive lesson therefore also stops
counting toward `Course.lessonCount` and stops blocking completion, which is
the same thing unpublishing it does. The status and the schedule are untouched.

The switch is saved through each editor's existing save action, schema and
permission key. No key is added: activating a course is an edit to the course
(`courses.update`), as it is for an article.

### 3. `isFeatured` drives placement, and only placement

A featured course, quiz or video topic sorts first on its shelf, carries a
"Featured" marker on its card (`CardMarkers`, the `marker` badge variant) and
is what the shelves' new "Featured" view shows (#5). A featured glossary term
leads the "Popular terms" rail, and a featured glossary topic leads the topic
index. A featured LESSON is stored and shown nowhere yet: a lesson has no card
of its own on the site, and the editor says exactly that rather than promising
a placement. None of this changes visibility.

### 4. `isPremium` is stored and labelled, not enforced

Like the article's, the switch carries "Not enforced yet" in the editor. On the
three types that have a public card (course, quiz, video topic) the card shows
a "Premium" marker; on the other three the editor says the flag is not shown
yet. The switch's hint is chosen per editor so it never claims more than the
site does. There is no paywall: gating content
needs a session read on pages that are cached by design (ADR-056 #1), and that
is its own decision. code-style.md #28 is satisfied because the value reaches a
screen: the marker is what it does today.

### 5. The shelves gain a VIEW row: All · Featured · Popular · Newest

On `/learn`, `/learn/<track>`, the quiz shelf and the video shelf. Client
state, for D26's reason: every card is already in the cached payload, and
`searchParams` would make the route dynamic (architecture.md #6).

- **Featured** is `isFeatured`. The chip is ABSENT when nothing on the shelf is
  featured: a filter whose only result is an empty state is a broken promise.
- **Popular** orders by a count the payload already carries: enrollments for a
  course, finished attempts for a quiz. The counts are aggregate and public
  (no learner is identifiable from a total), and they are cached with the
  shelf, so "popular" is as fresh as the `content` tag, not live. The video
  shelf has no such count and offers no Popular chip.
- **Newest** orders by `publishedAt`.

News keeps what it already has: the spotlight is featured-driven (changes-07)
and the archive filters by navigating to a category (ADR-015). No second
mechanism is added there.

### 6. The cover picture and the three switches share one card on the right

Every learning editor draws its cover image in a card in the RIGHT column, with
the three switches in that card's footer, the article editor's "Post settings"
shape. The quiz cover and the lesson's hero image were in the left column and
move; the course, video topic, glossary term and glossary topic editors already
had theirs on the right and gain the switches beside it.

## Consequences

- One migration, additive only. Nothing to backfill.
- Every place that bypassed the predicates would now disagree with the site.
  None was found; the predicates exist precisely so there is one.
- `isPremium` on seven models is a promise of a feature. When gating is built
  it reads these columns; until then the editor says so.

## Alternatives considered

- **A status value ("HIDDEN") instead of `isActive`.** Rejected for the reason
  ADR-015 #4 gave: status is a workflow position with its own permission key
  and history, and hiding is not a step in it.
- **Popular by page views.** No view is counted for courses, quizzes or videos,
  and adding a write per page view to a cached page is a dynamic path. The
  enrollment and attempt counts already exist.
- **Server-side filter URLs (`/learn?view=featured`).** Makes the route dynamic
  for a view nobody bookmarks (D26).
