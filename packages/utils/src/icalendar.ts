// One event as an iCalendar file (RFC 5545) — the "Add to calendar" download
// a webinar or event promotion offers (changes-52 P5, ADR-167 #8).
//
// Hand-written rather than a dependency: a single VEVENT is four rules
// (CRLF line ends, TEXT escaping, 75-octet folding, UTC stamps), and every one
// of them is tested here. What the file says is the caller's business; this
// only makes sure a calendar application can read it.

export interface ICalendarEvent {
  /** Globally unique and STABLE for this event, so a re-download updates the entry instead of adding a second. */
  uid: string;
  /** Bumped when the event changes; calendars keep the higher one. */
  sequence?: number;
  start: Date;
  /** Omitted when unknown: RFC 5545 §3.6.1 reads a start alone as a point in time. */
  end?: Date | null;
  summary: string;
  description?: string | null;
  /** The join link — absolute. */
  url?: string | null;
  /** When the file was generated. */
  stamp: Date;
  /** `-//Org//Product//EN` — who produced the file. */
  productId: string;
}

/** `20261005T150000Z` — always UTC, so no VTIMEZONE block is needed. */
export function icalDateTime(value: Date): string {
  return value
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/** RFC 5545 §3.3.11 TEXT: backslash, semicolon, comma and newline are escaped. */
export function icalEscapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const LINE_OCTETS = 75;

/** UTF-8 length of one code point — this package has no DOM or Node lib, so no TextEncoder. */
function utf8Octets(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

/**
 * RFC 5545 §3.1: a content line longer than 75 OCTETS continues on the next
 * line after CRLF + one space. Octets, not characters — an Arabic title is
 * two bytes a letter — and a fold never splits a character.
 */
export function icalFoldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  // The continuation's leading space counts toward its own 75.
  let limit = LINE_OCTETS;
  for (const char of line) {
    const size = utf8Octets(char);
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = LINE_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The whole file, CRLF-terminated. */
export function buildICalendar(event: ICalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${event.productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `DTSTAMP:${icalDateTime(event.stamp)}`,
    `DTSTART:${icalDateTime(event.start)}`,
    ...(event.end ? [`DTEND:${icalDateTime(event.end)}`] : []),
    `SUMMARY:${icalEscapeText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${icalEscapeText(event.description)}`] : []),
    // URI values are not TEXT: escaping a comma in a query string would break the link.
    // A line break in it would start a new property, so none survives.
    ...(event.url ? [`URL:${event.url.replace(/[\r\n]/g, "")}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icalFoldLine).join("\r\n") + "\r\n";
}

// ─── Web calendar links (ADR-176) ────────────────────────────
//
// The `.ics` file is a DOWNLOAD, which is what Apple Calendar and a desktop
// Outlook want and what a reader on Google Calendar does not: they get a file
// in their downloads folder and no entry. Google and Outlook on the web each
// take the event in the URL of their own "new event" screen, so these links
// open the reader's calendar with the event filled in and wait for them to
// press Save. Nothing is sent until the reader follows the link.

export interface CalendarLinkEvent {
  title: string;
  start: Date;
  /** Missing: an hour, because neither service accepts an event with no end. */
  end?: Date | null;
  /** Plain text. Trimmed to `CALENDAR_DETAILS_MAX` so the URL stays short. */
  details?: string | null;
  /** The join link — absolute. Appended to the details, which both services show. */
  url?: string | null;
}

/** Long enough for a paragraph; short enough that the link stays well under 2,000 characters. */
export const CALENDAR_DETAILS_MAX = 600;

const HOUR_MS = 60 * 60 * 1000;

function eventEnd(event: CalendarLinkEvent): Date {
  return event.end ?? new Date(event.start.getTime() + HOUR_MS);
}

function eventDetails(event: CalendarLinkEvent): string {
  // Counted and cut in code points, never inside a surrogate pair.
  const chars = Array.from(event.details?.trim() ?? "");
  const words =
    chars.length > CALENDAR_DETAILS_MAX
      ? `${chars
          .slice(0, CALENDAR_DETAILS_MAX - 1)
          .join("")
          .trimEnd()}…`
      : chars.join("");
  return [words, event.url?.trim()].filter(Boolean).join("\n\n");
}

/**
 * `a=1&b=2`, percent-encoded, empty values left out. Spelled out rather than
 * `URLSearchParams`: this package has no DOM or Node lib (`url-global.d.ts`).
 * Spaces become `%20`, which both services read.
 */
function queryString(params: [string, string][]): string {
  return params
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/** Google Calendar's "new event" screen, prefilled. Times in UTC. */
export function googleCalendarUrl(event: CalendarLinkEvent): string {
  const query = queryString([
    ["action", "TEMPLATE"],
    ["text", event.title],
    ["dates", `${icalDateTime(event.start)}/${icalDateTime(eventEnd(event))}`],
    ["details", eventDetails(event)],
  ]);
  return `https://calendar.google.com/calendar/render?${query}`;
}

/** Outlook on the web: personal (`live`) or work and school (`office`) accounts. */
export function outlookCalendarUrl(
  event: CalendarLinkEvent,
  account: "live" | "office" = "live",
): string {
  const query = queryString([
    ["path", "/calendar/action/compose"],
    ["rru", "addevent"],
    ["subject", event.title],
    ["startdt", event.start.toISOString()],
    ["enddt", eventEnd(event).toISOString()],
    ["body", eventDetails(event)],
  ]);
  const host = account === "office" ? "outlook.office.com" : "outlook.live.com";
  return `https://${host}/calendar/0/action/compose?${query}`;
}
