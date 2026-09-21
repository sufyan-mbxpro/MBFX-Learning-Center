# ADR-106: One row of controls per table, and a tab strip that survives the tab

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 09 (admin shell), 15 (articles), 07 (`@repo/ui`)
**Supersedes:** nothing. It EXTENDS ADR-044 #9 ("table filters live in the
table's toolbar") to the screen's primary action, and adds two conventions
ADR-044 did not cover.
**Superseded by:** —

## Context

The owner sent one screenshot of `/admin/articles/tags` and three sentences
about it. The screenshot showed four stacked rows above the table:

```
Tags
The tags used to cross-link articles

[ News & Analysis | Categories | Tags | Media | Settings ]

                                              [+ New tag]

[ Search articles…                 ]           [ Columns ]

<table>
```

Row three exists to carry one button. Row four is the table's own toolbar,
built in changes-08 to hold exactly that kind of control, and it already had an
end cluster with room in it.

The three sentences:

> also the new button should be placed in the same row of columns… every button
> & filter should be in the same row for the whole site.
>
> if we need to use the external page button then it will appear on the top
> right seprately rather then using with tabs.
>
> the page tabs will not reload the page..it will only load the data.

The third is worth unpacking, because there was no page reload: `SubNav` is
`next/link`, so a tab click is already a soft navigation. What the owner was
watching was the CHROME being rebuilt. Each of the three screens rendered its
own `AdminPage` heading and its own copy of the strip, so a soft navigation
unmounted both and constructed them again, under a `loading.tsx` scoped to the
whole screen. Everything above the table blinked. "The page reloads" is a
correct description of what that looks like.

Two of the five tabs also left the section. **Media** pointed at `/admin/media`,
the standalone Content → Media library — a real destination, already in the
sidebar, but not a News & Analysis screen, so clicking it produced a strip with
nothing active in it. **Settings** pointed at `/admin/settings/articles`, which
draws its own settings frame, strip and all.

## Decision

**1. A table's primary action goes in the table's toolbar.** `DataTable` gains
an `actions` slot rendered at the START of the toolbar's end cluster, before
export and the column picker, wrapped in the same `ControlSizeProvider size="sm"`
the search and filters already use. It is first in that cluster so the one
action a screen exists to offer does not move when a row selection appears and
bulk actions push in beside it.

This is ADR-044 #9's reasoning applied one control over: the things that act on
a table belong to the table. A screen rendering its own `flex justify-end` row
above the table is the layout the prop exists to replace, and
`admin-toolbar-conventions.test.ts` fails on that shape — anchored on the
`</div>` immediately preceding `<DataTable`, so the row-action cells inside
column definitions (also `flex justify-end`) are untouched.

Applied to every live list screen: articles, categories, tags, glossary,
glossary topics, courses, quizzes, videos, video categories, roles, market
instruments and social links. The Website Builder and the paused surfaces
(ADR-042/038) are out of scope, as they are for every ADR-044 convention.

**2. A section's tab strip belongs to the section's LAYOUT.** Next layouts
survive a soft navigation: only `{children}` and the segment's own
`loading.tsx` change. So the strip stops flashing not because anything was made
faster but because it stops being re-created.

News & Analysis is the worked example. `app/(admin)/admin/articles/(browse)/`
is a route GROUP — no URL moves — holding `layout.tsx`, the index, categories
and tags. The layout renders the heading, the strip and the Settings button;
each page renders its table and nothing else.

The heading it renders is the **section's**, not the tab's. Three screens each
repeating a title that the active tab already states is three chances to
disagree about what the section is called, and the tab strip is a better answer
to "where am I" than an `h1` that changes under a strip that does not.

**The editor sits OUTSIDE the group,** which is the reason for the group. An
editor is not a fourth tab: it used to render the strip with "Articles"
highlighted while showing something that is not the article list. It gets a
back link instead.

**3. A destination that leaves the section is a button in the header, never a
tab.** A tab strip makes a claim — these are the screens of this section, and
one of them is the one you are on. An entry that navigates away breaks the
claim the moment it is used.

So Media is gone (it is in the sidebar, where a standalone library belongs) and
Settings came back as an outline button in the section heading's `actions`,
top-right, above the strip — which is exactly where the owner asked for it.
Same rule split the two mixed screens: `/admin/learn/videos` keeps its "Manage
categories" link in the header and moves "New topic" to the toolbar;
`/admin/market` keeps the provider link and moves "New instrument".

## Consequences

- Two fewer rows of vertical space above every admin list, which is the visible
  half of this. The invisible half is that a list screen now has one place a
  control can be, so the next one is not a design decision.
- `/admin/articles` is served by `(browse)/page.tsx`, so the folder has no
  `page.tsx` of its own. `admin-page-conventions.test.ts` read that as a
  breadcrumb linking to a dead route and failed — correctly, for its own rule.
  It now looks inside route groups, which is the general fix: a `(group)` adds
  no URL segment, so a page inside one answers the parent's URL.
- The three browse screens no longer render `AdminPage`, so ADR-044 #8's guard
  checks three fewer files. The requirement is unchanged and still met — the
  layout renders `AdminPageHeading` with a title and a description, and the
  guard checks that instead.
- A section with a single screen gains nothing here and should not grow a
  layout for the sake of it. `SubNav` already hides a strip of one (the AI area
  and the public `GlossaryTabs` both do), and that rule is untouched.
