# ADR-085: The dashboard covers every content type, each block is permission-scoped, and a proportion bar is not a charting library's job

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 09 (admin shell), 11 (content system), 03 (rbac)
**Supersedes:** the article-only status donut on `/admin`
(`DashboardStatusChart` / `DashboardStatusLegend` / `loadAdminArticleStatusBreakdown`),
removed here.
**Superseded by:** —

## Context

The owner asked for "stats & graphs presentations of other features like
courses, glossary, video, analysis etc on the admin dashboard as well".

What `/admin` showed: four platform stat cards (users, new users, published
articles, active employees), a growth area chart of users + articles, a donut
of **article** statuses, a recent-activity feed, and three link tiles for
flags, settings and menu items.

What it did not show: courses, lessons, quizzes, glossary terms or video
topics — five content types that arrived across Modules 11 and 12, each with
its own admin section, its own workflow and its own public surface. The one
screen whose job is to say what the platform looks like described articles
and users, and nothing else. An editor with six draft lessons and a quiz
stuck in review had to open four screens to find that out.

Three decisions came out of building it that are not obvious from the
diff, and will be wrong again the next time somebody adds a content type,
a dashboard block, or a chart.

## Decision

### 1. One registry declares a content type; everything else reads it

`CONTENT_MODELS` in `packages/core/src/admin-reads.ts` is the list. Each
entry carries the entity key, the permission key that gates it, and three
closures — status breakdown, published-in-window count, published dates.
`DASHBOARD_CONTENT_ENTITIES`, `DASHBOARD_CONTENT_PERMISSIONS`,
`loadAdminContentStats` and `loadAdminContentSeries` all derive from it.

Presentation hangs off the same list from one file,
`app/(admin)/admin/_lib/dashboard-content.ts`: an icon, a destination, a
label key, and the pipeline buckets. Adding a seventh content type is one
core entry plus four map entries, and `admin-dashboard-registries.test.ts`
names whichever half is missing.

Explicit closures rather than a delegate lookup, because Prisma's model
delegates are differently generic and a `Record<string, delegate>` collapses
to a union that neither `groupBy` nor `count` survives. A second, smaller
trap is recorded in the code: Prisma infers `groupBy`'s generic from its
**argument**, so a contextual return type (the interface field's) hijacks
that inference and reports the argument as the error. Assigning the call to
an un-annotated local first is what makes it type.

**`DASHBOARD_CONTENT_STATUSES` is `Object.values(ContentStatus)`, not a
hand-written copy of it.** The schema's declaration order already is pipeline
order (DRAFT → IN_REVIEW → SEO_REVIEW → APPROVED → SCHEDULED → PUBLISHED →
ARCHIVED), and deriving it means an eighth workflow state added to the schema
arrives here on its own and fails the bucket guard until somebody says which
bar it belongs in. A retyped list would have silently dropped it, and the
bars would have stopped summing to their row's total with nothing to say so.

### 2. A dashboard block is permission-scoped, and an unscoped block is not queried

`/admin` has no page-level permission — the layout's STAFF gate covers it,
and that was fine when every number on it was a platform total. It is not
fine for content: draft and in-review counts belong to the people who can
open those screens, and learner activity is `analytics.view`'s, which is why
`/admin/learn/progress` has gated it since changes-11 Phase 9.

So the page resolves its subject (`getSubject`, the request-cached read) and:

- narrows the content reads through `visibleContentEntities()`, which filters
  `CONTENT_MODELS` by `can(subject, model.permission)`;
- loads the learning block only behind `can(subject, "analytics.view")`.

**The narrowing happens in the read, not in the render.** A block the subject
may not see is never queried, so it costs no round trip and leaks nothing
into the RSC payload. This is security.md #7's instinct — load scoped to the
subject rather than load-then-hide — applied to an aggregate.

**No permission key was added.** Content types gate on the keys they already
publish under, which means quizzes and videos gate on `lessons.view`
(ADR-058 #6 and ADR-068 refused a key group each; this is the third refusal,
and the fourth if the glossary counts). The consequence is visible and
intended: a subject with only `lessons.view` sees three cards.

### 3. The pipeline replaces the donut, and colour belongs to the entity

The article status donut asked "what state is our content in" of one content
type. The pipeline asks it of all six, as one labelled row each. Keeping both
would have shown articles twice with different geometry, so the donut, its
legend and `loadAdminArticleStatusBreakdown` are deleted rather than left
unresolved.

The seven states fold into **five buckets** — draft · in review · scheduled ·
published · archived — which is `CONTENT_STATUS_TONE`'s own grouping
(`status-badge.tsx` already decided IN_REVIEW, SEO_REVIEW and APPROVED are
one tone), so a bar here cannot tell an editor a different story from a badge
on the courses table. SCHEDULED is pulled out of the badge map's shared
`info` only because on a bar it has to separate from the review family.

**Colour is assigned to the bucket, never to a segment's position.** The
donut it replaces indexed a colour array (`STATUS_COLORS[i % n]`), so a
status changed colour whenever a zero-count one dropped out — colour
following rank instead of entity. Every fill is a `var(--color-*)` reference,
so an admin's palette reaches the chart (ADR-072: a redesign changes
`@repo/theme` defaults; colour stays admin-dynamic).

### 4. A proportion bar is a `<div>` with a width, not a chart component

`dashboard-charts.tsx` stays Recharts and stays `"use client"` — a growth
curve over a continuous axis is what a charting library is for. The three new
graphics are server components drawn in CSS:

- **The pipeline** is six labelled rows of proportional segments. In a
  one-third column Recharts' category axis gives each type ~70px and
  truncates it, and the counts can then only be read by hovering.
- **Publishing output** is six small multiples. Six `ResponsiveContainer`s is
  six resize observers and six more client trees on a page that already ships
  one.
- **Top courses** is started-vs-completed on one scale.

Small multiples rather than one six-series stacked bar, and the reason is the
palette rather than taste: this theme has six saturated hues and three of
them (warning, destructive, info) are the status colours the pipeline uses
two cards away. Painting "videos" in the warning hue beside a card where that
hue means "archived" is the reserved-status-colour mistake. Six panels in one
hue say the same thing and need no legend at all.

**Each output panel is scaled to its own peak**, and the card's description
says so. A shared scale is the usual rule for small multiples and it is wrong
here: lessons outnumber courses by an order of magnitude, so a shared axis
would flatten five panels to answer a question the stat cards directly above
already answer.

## Consequences

- `/admin` now reads up to 18 more aggregate queries per render, all counts
  and `groupBy`s against indexed `(status, publishedAt)` columns, and fewer
  than that for a subject who cannot see every type. The admin surface is
  uncached by design (`instant = false`), so this is per page view.
- A staff member with no content view key sees the dashboard they saw before,
  minus the article donut. That is a tightening: the donut was ungated.
- The `dashboardPublishedArticles` stat card in the top row stays ungated and
  unchanged. It predates this ADR and narrowing it is a separate decision.
- No new permission key, no new table, no counter column, no event log. Every
  number is an aggregate over columns Modules 11 and 15 already write — the
  discipline `learn-analytics.ts` states for learner activity, applied to the
  library.
- Covered by `admin-dashboard.test.ts` (the status fold, the permission
  narrowing, the window arithmetic), `admin-dashboard-registries.test.ts`
  (the four presentation maps) and `admin-dashboard.integration.test.ts`
  (the six read closures against real MariaDB — a closure that reads its
  neighbour's table, or drops `deletedAt: null`, fails there and nowhere
  else).
