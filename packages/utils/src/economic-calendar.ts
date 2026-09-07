// Economic calendar widget URL builder (Module 13, ADR-050).
//
// The public calendar is an embedded Tradays widget rather than our own
// synced models — an interim answer, and one that only stays safe if the
// framed URL can never be influenced by input. So the origin is a constant
// here, the caller passes a LOCALE, and the only thing that varies is a
// language segment drawn from a closed allowlist. There is no code path
// that frames a URL we did not build (security.md #9).
//
// The language list and query parameters are the vendor loader's own
// (c.mql5.com/js/widgets/calendar/widget.js), read rather than guessed.
// Note what is NOT in it: Urdu. Our fourth locale falls back to English.

const WIDGET_ORIGIN = "https://www.tradays.com";

/** Languages the vendor widget serves. `ur` is deliberately absent — the vendor 404s on it. */
export const ECONOMIC_CALENDAR_LANGS = [
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "it",
  "ja",
  "pt",
  "ru",
  "tr",
  "zh",
] as const;

export type EconomicCalendarLang = (typeof ECONOMIC_CALENDAR_LANGS)[number];

const SUPPORTED = new Set<string>(ECONOMIC_CALENDAR_LANGS);

/**
 * Our locale → the vendor's language segment. Accepts region-tagged tags
 * (`es-MX` → `es`) and falls back to English for anything unsupported, so
 * an unknown locale renders an English calendar rather than a 404 frame.
 */
export function economicCalendarLang(locale: string): EconomicCalendarLang {
  const base = locale.trim().slice(0, 2).toLowerCase();
  return (SUPPORTED.has(base) ? base : "en") as EconomicCalendarLang;
}

export interface EconomicCalendarWidgetOptions {
  locale: string;
  /** Vendor display mode; 2 is the loader's own default (the full week table). */
  mode?: number;
}

/** The embeddable widget URL — what goes in the iframe `src`. */
export function economicCalendarWidgetUrl({
  locale,
  mode = 2,
}: EconomicCalendarWidgetOptions): string {
  const lang = economicCalendarLang(locale);
  return `${WIDGET_ORIGIN}/${lang}/economic-calendar/widget?mode=${mode}`;
}

/**
 * Where the attribution credit points. Deliberately the vendor's brand page
 * and deliberately English: `tradays.com/{lang}/economic-calendar` redirects
 * to this MQL5 page, which 404s for several of the languages the WIDGET
 * itself serves (Arabic among them). A credit link is a destination for a
 * brand, so one working URL beats a per-locale one that breaks — the
 * language-correct escape hatch is the widget URL above, opened in a tab.
 */
export const ECONOMIC_CALENDAR_ATTRIBUTION_URL = "https://www.mql5.com/en/economic-calendar";
