# ADR-086: The set of tools is code, everything a tool says is data

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 13 (market layer), 12 (public site), 09 (admin shell), 11 (content),
03/10 (rbac, roles), 01 (db)
**Supersedes:** the `ComingSoon` render at `/tools` (ADR-081 #1).
**Superseded by:** —

## Context

The owner asked for the reference's eight trading tools
(`docs/changes/changes-25-tools.md`), with "maximum possible control from the
admin side" and one explicit instruction: things like currency pairs must be
admin-controlled, and API keys belong in settings.

"Maximum control" has a failure mode this repo has already paid for. Module 16
tried to make site composition admin-editable and was cancelled in full
(ADR-042) because the surface it produced could express far more than anyone
would ever want, and each expressible thing was a state nobody had designed.
A calculator is worse: a pivot-point formula assembled out of admin fields is
a programming language with no type checker, and the first wrong result looks
exactly like a right one.

So the question is not *whether* to make tools admin-controlled but *where the
line runs*, and the answer has to be the same line ADR-042 drew for the site
and ADR-078 #5 drew for email templates, one level down.

## Decision

**1. The set of tools is code; everything a tool SAYS is data.** `TOOLS` in
`@repo/contracts` decides which eight tools exist, what each one's URL segment
is, what inputs it takes and what maths it runs. A `Tool` row decides its
title, tagline, intro, explainer prose, FAQ, SEO, defaults, related items and
whether it is live. Adding a ninth tool is a code change with a seed row beside
it; changing every word on a tool page is a form.

This is exactly ADR-078 #5's shape: a code registry with data content. Code
decides *when* an email is sent and *what* a calculator computes, because both
are behaviour; admins own the copy, because copy is content.

**2. One `Tool` table, not eight.** `Tool` + `ToolTranslation`, plus a `config`
JSON column validated by the registry's per-tool Zod schema
(`TOOL_CONFIG_SCHEMAS[key]`). Eight tables for eight tools would make adding the
ninth a migration, and the fields they would not share are exactly the ones the
`config` schema already types.

The `config` column is validated in three places against **one** schema — the
admin form (`useFieldErrors`), the server action, and the service — so an
invalid configuration fails identically wherever it is entered (ADR-068's rule
for videos, applied again).

**3. The URL segment is the registry key, not an editable slug.** `/tools/pip-
value` is `TOOL_KEYS`' `"pip-value"`. There is no slug column and no redirect
machinery — the same call ADR-065 made for a track, for the same reason: a
segment nobody can rename needs no rename bookkeeping. Renaming a tool is a
code change with a redirect written beside it.

**4. Related items are curated in admin and topped up automatically, and they
are mixed-type.** The editor picks an ordered list; if it is shorter than the
tool's `relatedCount`, the rest is filled by track and tag; the strip never
renders empty. This is `resolveRecommendations`'s pattern (ADR-055) with one
difference: unlike a course's, a tool's list mixes lessons, articles, glossary
terms and videos. `ContentRelation` already stores that — each row carries its
own `targetType` — so only the helper is per-type, and T5 adds
`replaceMixedRelations` / `loadMixedRelationTargets` beside the existing pair.
No new table.

The reference's own "More About" list is visibly automatic, and lands a Canada
jobs headline under a gain/loss calculator. Curated-first is the difference.

**5. A disabled tool 404s, and its strip entry is absent.** The learn area's
rule (changes-11 D25) verbatim: a tab that leads nowhere is worse than no tab.
`Tool.isEnabled` and the `calculators` / `currency_converter` flags both gate,
and both gate the same way — the page `notFound()`s and the section bar simply
does not list it.

**6. `tools` is the fourteenth permission group**, and it is the first use of
ADR-083's escape hatch. `/admin/tools` is its own screen, so its keys are its
own: `tools.view`, `tools.update`, `tools.publish`. It is inserted after
`market` in `PERMISSION_GROUPS`, whose array order is sidebar order.

**7. Instruments get no new keys.** `market.view`,
`market.instruments.manage` and `market.providers.manage` have been seeded
since Module 01 and have governed nothing. This is the fourth time this repo
declines to add permission keys for a new surface (after quizzes reusing
`lessons.*`, glossary topics, and videos), and the rule behind all four is the
same: a key exists to answer "may this person change this kind of thing", not
"which screen are they on".

**8. A tool has no status, no `scheduledFor` and no seven-state machine.** It
is on or off. ADR-071 gave `scheduledFor` to the five entities a reader browses
as a feed, where "publish this on Tuesday" is a real editorial act; scheduling a
calculator solves nothing and would add a fourth switch to a surface that
already has three (the flag, `isEnabled`, and the translation's own status).

**9. The page flow is code, and it is the same six bands on all eight pages.**
Masthead → widget → explainer → FAQ → related → read-next, then the risk
disclaimer. `tool-shell.tsx` holds the order in one place so eight pages cannot
drift into eight layouts. The band ORDER is code; every word inside every band
is data.

## Consequences

- Adding a tool touches five places and no migration: a `TOOL_KEYS` entry, a
  config schema, a `ROUTE_PATHS` entry, a seed row and an island. The drift
  guard (`contracts/tools.test.ts`) names whichever one is forgotten, in
  `learn.test.ts`'s shape.
- An admin cannot add a sixth pivot method, a ninth correlation window or a
  new input field. That is the point; they can change every label, default,
  limit and instrument list around all of them.
- The mixed-relation helpers are general. Anything that later wants a
  cross-type related strip gets it without a table.
- `admin.tools` must be an OBJECT in the catalog, not a string. The
  `admin.glossary` collision (ADR-069) is the precedent and nothing static
  catches it.
