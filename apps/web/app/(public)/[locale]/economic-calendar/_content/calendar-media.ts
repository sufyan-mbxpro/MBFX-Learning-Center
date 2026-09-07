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
  /** Beside the masthead headline. Sits on the brand gradient. */
  hero: null,
  /** The "how to use the week ahead" callout, on an ordinary surface. */
  howTo: null,
} satisfies Record<string, CalendarImage>;

export type CalendarMediaKey = keyof typeof CALENDAR_MEDIA;
