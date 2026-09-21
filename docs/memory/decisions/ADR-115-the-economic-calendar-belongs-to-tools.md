# ADR-115: The economic calendar is a tool in the menu and a page of its own

**Status:** Accepted
**Date:** 2026-09-16
**Module:** 08 (navigation), 13 (market layer), 12 (public site)
**Supersedes:** the flat `economic-calendar` header row seeded in Module 13.
ADR-050 — our chrome, the vendor's data, at `/economic-calendar` — stands
unchanged.
**Superseded by:** —

## Context

> economic calendar should also be placed in the tools menu

The calendar has been a top-level header row since Module 13 and a
`footer_markets` row since ADR-076. `/tools` arrived later (changes-25) and
took the eight calculators with it, leaving the header with two entries that
are both "a thing you open to look something up": **Tools** and **Calendar**.

## Decision

**1. It moves INTO the Tools panel, and the flat header row goes.** Not "also"
in the sense of a second copy: the same destination twice in one header is
noise, and at 1440px the header is the surface with the least room to spend on
it. It is seeded as a ninth child of the Tools tree, in the **Timing** column
beside market hours and pivot points — the column's heading is what makes that
right, since all three answer "when".

The `footer_markets` row is untouched. A footer is a sitemap and repetition is
its job.

**2. It does NOT become a ninth entry in `TOOLS`.** `/economic-calendar`
keeps its URL, its flag, its own route and ADR-050's embedded widget.
`TOOLS` decides what a tool page IS: a registry key that owns a URL segment
under `/tools`, a `config` schema, an island, admin-editable prose and a
related strip. The calendar has none of those — it is a vendor iframe with our
chrome around it, and giving it a `Tool` row would mean a config schema for a
thing with no configuration and an editor screen whose every field is blank.

A menu is a list of destinations. Nothing about appearing in the Tools panel
requires being a `TOOLS` member, and conflating the two would make the
registry's own guard (`contracts/tools.test.ts`, which fails on a `tool-*`
route key with no registered tool) start lying about what a tool is.

**3. The `/tools` index lists it as a ninth card, marked as its own page.**
The index is built from `getEnabledTools()`, which reads the `Tool` table, so
the calendar is appended in code by the page rather than injected into the
service's result. Keeping it out of `getEnabledTools` is what stops every
other consumer of that reader — the admin list, the drift guard — from having
to learn about a row that does not exist.

## Consequences

- The header loses an item: eight top-level entries become seven.
- The seed deletes the flat row, scoped to `[mainMenu, "economic-calendar",
parentId: null]`. Unlike ADR-109's deletions this row's `routeKey` still
  resolves in `ROUTE_PATHS`, so the narrow scope is doing real work — the
  footer row and the new Tools child share that key and must survive.
- `tools-area.test.ts` grows a guard for the panel's ninth row and for the
  flat row's absence, and `mega-menu.ts` gains a `Calendar` glyph. The guard
  that asserts the panel names every `TOOL_KEYS` member is unchanged and still
  correct: the calendar is not one.
- A reader who had bookmarked the header row loses a click, not a page.
