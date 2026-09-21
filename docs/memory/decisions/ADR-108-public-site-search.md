# ADR-108: The public site gets a real search, and it sees exactly what the pages see

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 12 (public site), 11 (content), 05 (settings), 07 (`@repo/ui`)
**Supersedes:** the placeholder in `header.tsx` — a magnifying glass linking
to `/news`, with a comment saying no site-wide search backend existed. It was
honest and it is now wrong.
**Superseded by:** —

## Context

> add the searchbar for the public site as well that can we access on any
> page,content,can be use by ctrl+k

The admin has had a ⌘K palette since changes-01. The public site had a button
that navigated to the article listing and relied on its `q` filter, gated
behind `header.showSearch`, which was seeded **false** — correctly, because
shipping a global-looking search that only finds articles is worse than
shipping none.

So there were three things to decide, not one: where the results come from,
what "public" means to a search, and what happens to the switch.

## Decision

**1. `searchPublicContent` in `@repo/core`, over six translation tables plus
the tool registry.** Articles (both public surfaces), glossary terms, courses,
lessons, quizzes, video topics, tools. A route handler at `GET /api/search`
calls it; the header mounts a client palette that fetches it.

A route handler rather than a server action: a search is a read, it is called
from pages that may be statically cached, and it answers with a JSON body a
future non-React client can call. A server action would tie it to one renderer
for nothing.

**2. Visibility composes the page's own rule, never a fresh one.** Every query
uses the module's published-visibility helper — `publicArticleWhere`,
`publicGlossaryTermWhere`, `publicCourseWhere`, `publicLessonWhere`,
`publicQuizWhere`, `scheduledVisibilityOr` for video topics — rather than a
`status: PUBLISHED` typed here.

This is the whole security argument and it is structural rather than careful:
a search with its own definition of "public" is a way to discover drafts by
typing, and it would have drifted the next time a schedule rule changed —
ADR-071 changed five of them in one PR. The integration suite is the proof,
and it is an integration suite for exactly that reason: the claim is made of
`where` clauses, and a mocked Prisma would confirm the shape of an object we
wrote.

A lesson additionally requires a published SECTION and a visible course, the
same rule `Course.lessonCount` counts by (ADR-081 #2), so search cannot offer a
link the curriculum does not.

**3. Rich text is SHOWN, never MATCHED.** The query hits plain columns only —
`term`, `title`, `excerpt`, `summary`, `description`. `simpleExplanation` is
rich text (ADR-069) and supplies a stripped excerpt but is not searched.

A `LIKE` over stored markup is wrong in both directions, which the test suite
found rather than the design: it misses "bid and ask" when the source is
`<em>bid</em> and ask`, and it matches a reader searching for "strong" against
every term that happens to embolden a word. Both cases are now guarded.

**4. It is a `LIKE` search, and that ceiling is stated rather than hidden.**
Full-text indexing over six translation tables is a schema change, a relevance
model and a per-locale tokenisation decision. What was asked for is a
keyboard-reachable way to find a page, and a substring match over titles
answers that at a corpus of thousands. The seam is the function: every caller
takes `SearchHit[]` and knows nothing about how a hit was found.

Two bounds keep it from being a way to spend the database's time from outside:
a two-character floor (below it a query matches most of the corpus and costs a
scan per table to say so) and a hundred-character ceiling. `%`, `_` and `\` are
stripped, because `%` inside a `contains` IS a wildcard to MariaDB and one
typed character should not return everything.

**5. Flags gate at the route, not in the service.** A section whose feature
flag is off is ABSENT from the results — not present and unreachable. The
route resolves the flags against an ANONYMOUS subject, which is the right
argument and not a shortcut: this endpoint reads no session, so a flag scoped
to AUTHENTICATED correctly hides its section, and a signed-in reader sees the
same public corpus. That is what a public search is.

**6. Anonymous, therefore bounded.** 40 requests per IP per minute
(security.md #13's shape, applied to a read). A debounced palette makes about
one request per typed phrase; a script makes many. The response is
`private, no-store`: the corpus is public, but a shared cache keyed on strings
readers typed is a log of what readers type, held somewhere nobody is looking
after it.

**7. `header.showSearch` now seeds TRUE, and a migration flips it.** The
switch stays — an admin may want the header clean — but the default inverts,
because the reason for `false` was the placeholder. `20260915180000_enable_
header_search_changes32` reaches existing databases, bounded to rows still
holding the seeded `false`, for the reason the two data migrations before it
record: the settings upsert never touches `value`, so a seed change reaches a
fresh install only.

**The keyboard shortcut is not gated by the button.** The header hides the
trigger's labelled form below `md`, and a reader who has never seen it still
gets ⌘K. The listener is on `window`.

## Consequences

- `href` comes back locale-less (`/glossary/x`, not `/en/glossary/x`) and
  `@repo/i18n`'s router adds the prefix, so a hit cannot navigate a reader out
  of their locale. Each query filters ONE locale and does not walk the fallback
  chain: a hit whose title is in a language the reader did not ask for is a
  worse answer than no hit (ADR-007), and a lesson whose course has no
  translation in that locale is dropped rather than linked through a slug that
  would 404.
- The palette shares `@repo/ui`'s `Command` with the admin's and no code.
  `admin-search.tsx` still may not be imported from a public route
  (architecture.md #5), and its results are permission-filtered admin records,
  which is a different thing wearing the same shape.
- `@repo/core` gains a public read that is deliberately NOT `"use cache"`:
  results depend on a query string with unbounded cardinality, and a cache over
  that is a memory leak with a nice name.
- Owed to Module 14: axe over the open palette, and an E2E that types into it —
  the visibility rules are covered by integration tests, the keyboard path is
  not.
