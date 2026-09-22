# ADR-150 — changes-51: Email and AI are tabbed settings sections

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 09 (admin shell / settings), 17 (email), 18 (AI)
- **Plan:** `docs/changes/changes-51.md` (owner request)
- **Amends:** ADR-097's placement of the AI area (its own sidebar entry and
  `/admin/ai` sub-nav); ADR-120 (the connection screen carried the usage-limits
  form and links to the AI area); the changes-21 F5 settings-nav layout, where
  email templates and the delivery log were entries beside Email.
- **Does not change:** any permission. ADR-078 #4's transport split, ADR-098's
  super_admin-only Providers, `support`'s one key (`email.log.view`), and every
  action's own `requirePermission()` stand exactly as they were.

## Context

The owner's changes-51 list:

- "all the email should be shift in tabs under one email settings"
- "all the ai settings should also use the tabs in one section & only show in
  the settings page with page content"
- "we will use the anthropic for the ai..check the usage & stats that is listed
  will work in real time"

Email was one settings page (sender, transport, newsletter placement stacked)
plus two more settings-nav entries (templates, log). AI was split between a
settings page (the connection) and `/admin/ai`, a sidebar destination with its
own sub-nav (usage, features, limits, providers).

## Decision

1. **Email is one section with route tabs:** Sender · Delivery · Newsletter ·
   Templates · Delivery log, under `/admin/settings/email`. The heading, the
   description and the strip live in a route-group LAYOUT
   (`settings/email/(tabs)/layout.tsx`), so a tab click swaps only the content
   (ADR-106 #2). The template editor stays outside the group: it is a record
   page with its own heading and back link.
2. **AI is one section with route tabs:** Connection · Usage · Features ·
   Budget & limits · Providers, under `/admin/settings/ai`, laid out the same
   way. The AI sidebar entry is removed. Settings' sidebar entry and the
   settings hub now also open for the three AI keys, so an
   `ai.usage.view`-only role still has a way in. `/admin/ai` and
   `/admin/ai/<tab>/…` redirect to the new addresses.
3. **Tabs are built from the viewer's keys**, never filtered after the fact
   (`emailSectionTabs`, `aiSectionTabs` in `settings-shared.ts`). The section's
   ONE settings-nav entry lands on the first tab the viewer can open and stays
   lit on every tab under it (`SettingsNavEntry.prefix`, `SubNavItem.match`).
   This is what keeps `support` reaching the log alone.
4. **The Connection tab drops its copy of the limits form and its links.**
   Budget & limits is a tab one click away; two copies of one form was a
   second place to save the same values.
5. **The Usage tab refreshes itself.** The data was already live: every call is
   metered in `runAiTask`/`streamAiTask`'s `finally`, in one transaction that
   writes the row, the daily rollup and the period counter, and none of the
   usage reads is cached. What went stale was the open page, and a
   fully-prefetched tab (ADR-140 §4) can be minutes old. `LiveRefresh` calls
   `router.refresh()` on mount, every 30 s while the tab is visible, and on
   becoming visible again, and prints when the figures were read.

## Consequences

- Anything linking to `/admin/ai/*` keeps working through the redirects; the
  budget notification now links straight to the Limits tab.
- A new email or AI screen is a new tab in the registry function, not a new
  nav entry.
- The Anthropic driver was checked, not changed: usage is read from
  `message_start` and merged with `message_delta` on a stream, taken from the
  response on a single call, and yielded in a `finally`, so an aborted stream
  still meters. The seeded prices match Anthropic's published rates for Opus 5,
  Sonnet 5 and Haiku 4.5. One known under-estimate stays: cache-WRITE tokens
  are priced at the input rate (Anthropic bills them at 1.25×). Nothing the
  platform sends today sets `cache_control`, so the count is zero in practice.
