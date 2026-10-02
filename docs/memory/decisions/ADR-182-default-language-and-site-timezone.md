# ADR-182 — The admin's default language lands public visitors; the default timezone is the whole site's

- **Status:** Accepted
- **Date:** 2026-10-02
- **Module:** 05 (settings), 06 (i18n), 09 (admin shell), 12 (public site)
- **Supersedes:** nothing. Wires two settings seeded since Module 01 that no
  code read (code-style.md #28).

## Context

Settings → General → Language & region shows three settings:
`site.defaultLocale`, `site.defaultTimezone` and `site.defaultThemeMode`. A
review on 2026-10-02 found that **none of them is read by anything**: each is
seeded, validated by `@repo/contracts` and rendered by the settings form, and
the site behaves identically whatever is saved. The language default is
`routing.defaultLocale = "en"` (static), the colour mode is
`DEFAULT_THEME_MODE = "system"` (code), and every date was printed in the
runtime's zone (the server's in a server component, the reader's browser in a
client one).

The owner, 2026-10-02:

> if language is changed then it's effect on public site default set language
> only...no need to update the admin side...also mention that..also set the
> default timezone for the whole site(admin site)

## Decision

1. **`site.defaultLocale` decides where a PUBLIC visitor who has not chosen a
   language lands.** The proxy sends an unprefixed page view to the same page
   under the chosen prefix (`/news` → `/ar/news`, 307), when:
   - the request carries no `NEXT_LOCALE` cookie (the language switcher writes
     it, so a visitor's own choice always wins);
   - it is a GET/HEAD and not a Server Action (a form must reach its address);
   - the chosen language is SERVED — `/api/locales` returns it as
     `defaultLocale` only then, and `null` otherwise.

   The admin's choice outranks the browser's `Accept-Language`: otherwise a
   site set to Arabic would still open in English for nearly every visitor,
   and the setting would look broken. When the choice is English the proxy
   does nothing new, so next-intl's browser detection runs exactly as before.

2. **`routing.defaultLocale` stays `en`.** It is static, it is the language
   with no URL prefix, and the default locale's translation row owns every
   shared slug (ADR-181) and is what the translation engine translates from.
   Moving it would change every address on the site and the source language of
   every translation; that is its own ADR, not a settings value. English
   therefore stays reachable at unprefixed addresses for anyone who picks it.

3. **The admin portal ignores the language default** (ADR-043 #2: the admin is
   English by design). The field's description says so in the admin.

4. **`site.defaultTimezone` is the zone every human-read date on BOTH surfaces
   is printed in.** `@repo/utils`' `formatDate`/`formatDateTime` — the one
   date format ~50 call sites already share — read a module-level site zone
   (`setSiteTimeZone`/`getSiteTimeZone`). The three root layouts set it on the
   server (`app/_lib/site-time-zone.ts`) and render `<SiteTimeZone>`
   (`app/_components/site-time-zone.tsx`) before their children so the
   browser's module instance agrees before any client component renders; the
   zone is also given to `NextIntlClientProvider`, and the two server-side
   next-intl formatters (account pages) pass it explicitly. A module value
   rather than a prop is deliberate: it is one value for the whole site, and
   threading it through ~50 call sites would be a change nobody keeps up.
   An unknown zone clears it instead of throwing.

5. **A time typed in the admin means the site's zone too.** The date-time
   picker's wall-clock string is converted with `zonedInputToIso` and read back
   with `toZonedInput` (DST resolved per day, as `market-hours.ts` already
   does) in every scheduling surface: content status panel, article publish
   panel, both email campaign editors and the promotion editor; the "Tomorrow
   9:00" / "Next week" presets use `zonedInputAtHour`. Before this a schedule
   was entered in the editor's browser zone and printed back in the server's.

## Consequences

- With a non-English default, a crawler (no cookie) is redirected from
  unprefixed addresses too, so English pages are crawled less. That is what
  "the site opens in Arabic" means; hreflang alternates are unchanged.
- The proxy asks `/api/locales` for an uncookied unprefixed page view; the
  answer is cached in-process for a minute, and a failed answer changes
  nothing (next-intl decides, as before).
- Machine-read timestamps (ISO in `<time dateTime>`, JSON-LD, CSV, API bodies)
  are untouched. Tool widgets that show the reader's own clock (market hours)
  keep the reader's zone on purpose.
- **Not done:** `site.defaultThemeMode` is still read by nothing. ADR-008 says
  admins control branding and never the mode, so wiring it needs its own
  decision; until then it remains a #28 violation to resolve or remove.
