# ADR-050: The economic calendar ships as an embedded Tradays widget

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 13 (market layer), 12 (public site), 06 (`@repo/i18n`)
**Supersedes:** —
**Superseded by:** —

## Context

`/economic-calendar` has been reserved since Module 08 without a route behind
it: the route key is in `ROUTE_PATHS`, the main-menu row is seeded
(`requiresFeature: "economic_calendar"`, sortOrder 6), the feature flag is
seeded enabled and PUBLIC, the `market.calendar.manage` permission exists, and
two About-section cards already link to it behind the same flag. Everything
points at a page that does not exist.

Module 13's spec (plan.md Part D, `.claude/skills/market/SKILL.md`) describes
how to fill it: "economic calendar sync (new models), idempotent", behind the
provider abstraction that `MARKET_DATA_PROVIDER` selects. That is a
multi-week slice — Prisma models plus per-locale event translations, a
provider adapter, a sync scheduler, an admin management screen, and the
integration tests each of those owes.

The owner asked (2026-09-07) for the BabyPips economic calendar's
presentation, and chose the MQL5/Tradays widget as the data source **for
now** — an explicitly interim answer to "where do the events come from",
given that BabyPips publishes no API and no calendar feed is configured.

The vendor loader at `c.mql5.com/js/widgets/calendar/widget.js` was read
rather than assumed. It does exactly one thing: build an `<iframe>` pointing
at `https://www.tradays.com/{lang}/economic-calendar/widget`, with `mode`,
`theme`, `dateFormat`, `fw` and `utm_source` on the query string, and a
hardcoded language allowlist. Response headers on that URL carry no
`X-Frame-Options` and no `frame-ancestors`, so it is embeddable directly.

## Decision

### 1. The route is real, coded, and static; the data is borrowed

`apps/web/app/(public)/[locale]/economic-calendar/page.tsx` is an ordinary
server component behind the existing `economic_calendar` flag. It renders our
own page chrome — heading, intro, impact legend, timezone and attribution
notes, risk disclaimer — around one iframe. **No Prisma models, no sync, no
admin screen, and no `@repo/core` service land in this pass.** Module 13's
calendar slice is deferred, not cancelled or replaced.

### 2. The iframe is embedded directly, not via the vendor script

We construct the same URL the vendor loader would and render the `<iframe>`
ourselves. Loading `widget.js` would put a third-party script in our document
and force a `script-src` hole in a nonce-based CSP (security.md #14) to buy
nothing: the script's entire output is the iframe we can write in one line.
This also keeps the third party inside a cross-origin frame, where it cannot
read our DOM, our cookies, or a session.

### 3. URL construction is a pure function in `@repo/utils`

`economicCalendarWidgetUrl()` in `packages/utils/src/economic-calendar.ts`
owns the language allowlist (copied from the vendor loader — `ur` is absent,
so Urdu falls back to `en`), the fixed vendor origin, and the query string.
Pure and table-tested, per the 90% floor on `@repo/utils`, and reusable by a
future `apps/mobile` WebView. The app passes a locale, never a URL: the origin
is a constant in that module, which is what keeps security.md #9's
"never fetch or frame an arbitrary URL" true by construction.

### 4. CSP gains a `frame-src` for exactly this origin

`frame-src 'self' https://www.tradays.com` is added to `baseCsp()` in
`apps/web/proxy.ts`. Note that the policy is still report-only.

### 5. Presentation is ours; interaction is the widget's

BabyPips' reading of a calendar — day grouping, currency and impact filters,
per-event detail, a timezone control, week stepping — is what the Tradays
widget already implements internally. We do not reimplement it in a client
island we cannot synchronise across an origin boundary. What we add is the
part the widget lacks: a page that explains what the reader is looking at,
in our type, our tokens, and our locale.

## Consequences

**Accepted, and each one is a reason the DB-backed slice still matters:**

1. **The widget has no dark skin.** Its stylesheet contains no
   `prefers-color-scheme` rule and no custom properties; `theme=1` only
   reaches the event-detail chart. In our dark mode it renders as a light
   panel. We frame it as a deliberate bordered surface rather than pretend
   otherwise.
2. **The events are not in our HTML.** They arrive in a cross-origin frame
   marked `noindex`, so they carry no SEO value for us and cannot feed a
   homepage widget, an RSS feed, or the seeded `economic_events` homepage
   section. That section stays unimplemented.
3. **No degraded mode.** If Tradays is down or blocked, the frame is empty;
   there is no stale copy to serve, which is the opposite of the failure
   posture `getRate()` was built for. The page renders its own chrome and a
   direct link out regardless.
4. **Locale coverage is the vendor's**, not ours: `en`/`es`/`ar` are
   supported, `ur` falls back to English. The surrounding chrome is fully
   translated through the catalogs, so the page is never mixed-language
   except inside the frame.
5. **A third-party origin is now framed on a public route** and can see the
   referring hostname. It sets no cookies in our document and shares no
   storage with it.

**Not in conflict with ADR-042.** An economic calendar is content _data_, not
admin-composable layout: nothing here adds a surface where staff arrange a
page. The composition of this route is code, exactly as ADR-042 requires.

**Exit.** Replacing the embed with Module 13's own models is a swap of one
component behind the same URL, feature flag, menu row and permission. This
ADR is superseded by that work, not amended by it.
