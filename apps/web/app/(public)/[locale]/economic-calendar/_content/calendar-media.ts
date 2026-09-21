// Economic-calendar imagery (ADR-050; same pattern as the About section's
// `about-media.ts`, ADR-047 §3).
//
// A `null` entry is not a defect — `CalendarMedia` renders a tinted panel
// with a watermark glyph instead, so the page ships complete with no
// photography committed to the repo and real assets land later without
// touching component code.
//
// To swap one in: drop the file in `apps/web/public/economic-calendar/`
// and point the entry at `/economic-calendar/<file>`. Nothing else changes.
// Alt text is NOT here — it belongs in the message catalog, because it is
// user-facing copy that has to translate (code-style.md #2).

export type CalendarImage = string | null;

export const CALENDAR_MEDIA = {
  /**
   * BEHIND the masthead headline (changes-40). The hero is a `compact`
   * photographic band now, like every tool page's, so this is a full-bleed
   * 3:1 backdrop rather than the 4:3 callout that used to sit beside the
   * words — the clocks-on-a-desk piece the explore carousel already gives the
   * calendar.
   */
  banner: "/banners/calendar.webp",
  /**
   * The "how to use the week ahead" callout, on an ordinary surface. A 4:3
   * crop of its own (changes-36), for the same reason `hero` has one: the
   * slot is `ImageReveal` at 4/3, which stretches rather than crops.
   */
  howTo: "/banners/calendar-how-to.webp",
} satisfies Record<string, CalendarImage>;

export type CalendarMediaKey = keyof typeof CALENDAR_MEDIA;
