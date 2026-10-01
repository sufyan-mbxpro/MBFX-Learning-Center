import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildICalendar,
  CALENDAR_DETAILS_MAX,
  googleCalendarUrl,
  outlookCalendarUrl,
  icalDateTime,
  icalEscapeText,
  icalFoldLine,
  type ICalendarEvent,
} from "./icalendar.ts";

// A minimal RFC 5545 reader, so the file is checked by PARSING it the way a
// calendar application does — unfold, split name from value, unescape — not
// by comparing strings the builder itself produced.
function parseICalendar(file: string): { name: string; value: string }[] {
  expect(file.endsWith("\r\n")).toBe(true);
  // Every line break is CRLF: a bare LF is where Outlook gives up.
  expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  const unfolded = file.replace(/\r\n[ \t]/g, "");
  return unfolded
    .split("\r\n")
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      expect(colon, `no name:value in "${line}"`).toBeGreaterThan(0);
      return { name: line.slice(0, colon), value: line.slice(colon + 1) };
    });
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

// UTF-8 length the long way, independent of the builder (no DOM or Node lib here).
const octets = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, "x").length;

const base: ICalendarEvent = {
  uid: "promo-p1@example.com",
  sequence: 4,
  start: new Date("2026-10-05T15:00:00.000Z"),
  end: new Date("2026-10-05T16:30:00.000Z"),
  summary: "Risk management, live; with Q&A",
  description: "Bring questions.\nWe start on time.",
  url: "https://zoom.us/j/123?pwd=a,b",
  stamp: new Date("2026-09-29T10:00:00.000Z"),
  productId: "-//MBX//Learning Center//EN",
};

describe("buildICalendar", () => {
  it("produces one parseable VEVENT with every required property", () => {
    const props = parseICalendar(buildICalendar(base));
    const get = (name: string) => props.filter((p) => p.name === name).map((p) => p.value);

    expect(props[0]).toEqual({ name: "BEGIN", value: "VCALENDAR" });
    expect(props.at(-1)).toEqual({ name: "END", value: "VCALENDAR" });
    expect(get("BEGIN")).toEqual(["VCALENDAR", "VEVENT"]);
    expect(get("END")).toEqual(["VEVENT", "VCALENDAR"]);
    expect(get("VERSION")).toEqual(["2.0"]);
    expect(get("PRODID")).toEqual([base.productId]);
    expect(get("UID")).toEqual([base.uid]);
    expect(get("SEQUENCE")).toEqual(["4"]);
    expect(get("DTSTAMP")).toEqual(["20260929T100000Z"]);
    expect(get("DTSTART")).toEqual(["20261005T150000Z"]);
    expect(get("DTEND")).toEqual(["20261005T163000Z"]);
  });

  it("round-trips the words through escaping", () => {
    const props = parseICalendar(buildICalendar(base));
    const value = (name: string) => props.find((p) => p.name === name)?.value ?? "";
    expect(unescapeText(value("SUMMARY"))).toBe(base.summary);
    expect(unescapeText(value("DESCRIPTION"))).toBe(base.description);
  });

  it("leaves the URL unescaped, because a URI is not TEXT", () => {
    const props = parseICalendar(buildICalendar(base));
    expect(props.find((p) => p.name === "URL")?.value).toBe(base.url);
  });

  it("drops a line break from the URL rather than let it start a property", () => {
    const file = buildICalendar({ ...base, url: "https://x.example/a\r\nATTENDEE:evil" });
    expect(parseICalendar(file).some((p) => p.name === "ATTENDEE")).toBe(false);
  });

  it("omits DTEND, DESCRIPTION and URL when there are none", () => {
    const names = parseICalendar(
      buildICalendar({ ...base, end: null, description: null, url: null }),
    ).map((p) => p.name);
    expect(names).not.toContain("DTEND");
    expect(names).not.toContain("DESCRIPTION");
    expect(names).not.toContain("URL");
  });

  it("cannot be made to inject a property through its words", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (summary, description) => {
        const props = parseICalendar(buildICalendar({ ...base, summary, description }));
        expect(props.filter((p) => p.name === "BEGIN")).toHaveLength(2);
        const value = (name: string) => props.find((p) => p.name === name)?.value;
        expect(unescapeText(value("SUMMARY") ?? "")).toBe(summary.replace(/\r\n|\r/g, "\n"));
        if (description) {
          expect(unescapeText(value("DESCRIPTION") ?? "")).toBe(
            description.replace(/\r\n|\r/g, "\n"),
          );
        }
      }),
    );
  });
});

describe("icalFoldLine", () => {
  it("keeps every physical line within 75 octets and unfolds to the original", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 400 }), (text) => {
        const line = `SUMMARY:${text}`;
        const folded = icalFoldLine(line);
        for (const physical of folded.split("\r\n"))
          expect(octets(physical)).toBeLessThanOrEqual(75);
        expect(folded.replace(/\r\n /g, "")).toBe(line);
      }),
    );
  });

  it("never splits a character, emoji included", () => {
    const arabic = `SUMMARY:${"ندوة عبر الإنترنت 📈 ".repeat(10)}`;
    const folded = icalFoldLine(arabic);
    // encodeURIComponent throws on a lone surrogate: a split pair would fail here.
    for (const physical of folded.split("\r\n")) {
      expect(() => encodeURIComponent(physical)).not.toThrow();
    }
    expect(folded.replace(/\r\n /g, "")).toBe(arabic);
  });

  it("leaves a short line alone", () => {
    expect(icalFoldLine("VERSION:2.0")).toBe("VERSION:2.0");
  });
});

describe("icalDateTime / icalEscapeText", () => {
  it("formats UTC with no separators or milliseconds", () => {
    expect(icalDateTime(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102T030405Z");
  });

  it("escapes the four TEXT specials", () => {
    expect(icalEscapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("web calendar links", () => {
  const event = {
    title: "Live webinar: trading the US jobs report (NFP)",
    start: new Date("2026-10-10T14:00:00Z"),
    end: new Date("2026-10-10T15:00:00Z"),
    details: "What moves EUR/USD & gold.",
    url: "https://example.com/economic-calendar",
  };

  // The package has no DOM lib, so links are read back by hand — decoded the
  // way the receiving service decodes them.
  function parseLink(link: string): { base: string; params: Map<string, string> } {
    const [base = "", query = ""] = link.split("?");
    const params = new Map<string, string>();
    for (const pair of query.split("&").filter(Boolean)) {
      const [key = "", value = ""] = pair.split("=");
      params.set(decodeURIComponent(key), decodeURIComponent(value));
    }
    return { base, params };
  }

  it("opens Google Calendar's new-event screen with the event in UTC", () => {
    const { base, params } = parseLink(googleCalendarUrl(event));
    expect(base).toBe("https://calendar.google.com/calendar/render");
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe(event.title);
    expect(params.get("dates")).toBe("20261010T140000Z/20261010T150000Z");
    expect(params.get("details")).toBe(
      "What moves EUR/USD & gold.\n\nhttps://example.com/economic-calendar",
    );
  });

  it("opens Outlook's compose screen, personal by default and work on request", () => {
    const live = parseLink(outlookCalendarUrl(event));
    expect(live.base).toBe("https://outlook.live.com/calendar/0/action/compose");
    expect(live.params.get("rru")).toBe("addevent");
    expect(live.params.get("subject")).toBe(event.title);
    expect(live.params.get("startdt")).toBe("2026-10-10T14:00:00.000Z");
    expect(live.params.get("enddt")).toBe("2026-10-10T15:00:00.000Z");
    expect(parseLink(outlookCalendarUrl(event, "office")).base).toBe(
      "https://outlook.office.com/calendar/0/action/compose",
    );
  });

  it("gives an event with no end one hour, and omits empty details", () => {
    const { params } = parseLink(googleCalendarUrl({ title: "x", start: event.start }));
    expect(params.get("dates")).toBe("20261010T140000Z/20261010T150000Z");
    expect(params.has("details")).toBe(false);
  });

  it("counts details in characters, so short non-Latin text is never cut", () => {
    const details = "😀".repeat(CALENDAR_DETAILS_MAX - 100);
    const body = parseLink(googleCalendarUrl({ title: "x", start: event.start, details }));
    expect(body.params.get("details")).toBe(details);
  });

  it("trims long details on a code point and keeps the link", () => {
    const details = "😀".repeat(CALENDAR_DETAILS_MAX + 50);
    const body = parseLink(googleCalendarUrl({ ...event, details })).params.get("details")!;
    const [words, link] = body.split("\n\n");
    expect(Array.from(words!)).toHaveLength(CALENDAR_DETAILS_MAX);
    expect(words!.endsWith("…")).toBe(true);
    expect(words!.includes("�")).toBe(false);
    expect(link).toBe(event.url);
  });
});
