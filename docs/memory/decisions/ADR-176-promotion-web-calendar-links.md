# ADR-176 — "Add to calendar" opens the reader's web calendar

- **Status:** Accepted
- **Date:** 2026-10-01
- **Module:** 12 (public site)
- **Extends:** ADR-167 #8 ("an 'Add to calendar' file is generated
  read-only"). The `.ics` route and everything else in ADR-167 stand.
- **Change set:** `docs/changes/changes-57-promomotion-updates.md`

## Context

A webinar or event promotion offered "Add to calendar" as one link that
downloaded an `.ics` file. That works for Apple Calendar and desktop Outlook,
which open the file. Most readers use Google Calendar or Outlook on the web,
and for them the link put a file in the downloads folder and added nothing to
their calendar. The owner's report: "it should go real with calendar … right
now it's downloading something".

## Decision

1. **"Add to calendar" is a menu with four choices:** Google Calendar,
   Outlook.com, Outlook (work or school), and "Apple Calendar or other
   (.ics)". The first three open the service's own new-event screen in a new
   tab, with the title, the time in UTC, the description and the join link
   filled in. The reader still presses Save there. The fourth is the existing
   `.ics` download, unchanged.
2. **The links are pure functions in `@repo/utils`** (`googleCalendarUrl`,
   `outlookCalendarUrl`), beside `buildICalendar`. They are tested by parsing
   the link back the way the service reads it.
3. **The client builds the links from the promotion it already holds.** No
   new route, and no new request. The join link is absolute and in the
   reader's language, which is the rule the `.ics` route follows.
4. **Nothing is sent to Google or Microsoft until the reader picks one.**
   These are plain links: there is no script and no prefetch, so the CSP is
   unchanged. The event's words reach the service only through the reader's
   own navigation.
5. **The description is capped at 600 characters**, counted in code points,
   so the link stays well under the length browsers and the two services
   accept. The join link is always kept.

## Consequences

- Choosing any of the four still counts as an engagement (ADR-170 #2).
- Yahoo and other web calendars are not listed. Readers of those calendars
  use the `.ics` choice, which every calendar application imports.
- The two services' URL formats are not documented APIs. If either one
  changes, the fix is in one function and its test.
