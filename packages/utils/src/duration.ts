// Human durations for the admin's interval pickers (changes-25 follow-up).
//
// A refresh interval is stored in SECONDS because that is what the code does
// arithmetic on, but "86400" is not a thing anyone recognises as a day. This
// turns the stored number into the words for it.
//
// `Intl.NumberFormat`'s `unit` style does the pluralisation and the wording,
// so this is not a hardcoded user-facing string (code-style.md #2): "1 minute"
// and "2 minutes" come from the same call, and a locale that needs a third
// plural form gets it without a catalog entry per value.

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `formatDurationSeconds(300)` → "5 minutes", `(86_400)` → "24 hours".
 *
 * The unit is the largest one the value divides into EXACTLY, so 90 minutes
 * stays "90 minutes" rather than becoming "1.5 hours" — a picker option has
 * to read back as the same quantity the admin chose. A day is deliberately
 * NOT preferred over hours at 86400: "24 hours" is how a refresh interval is
 * said, while "7 days" is how a retention window is, and both fall out of the
 * exact-division rule once 86400 is left to hours and 604800 to days.
 */
export function formatDurationSeconds(seconds: number, locale = "en"): string {
  const value = Math.max(0, Math.round(seconds));

  const [amount, unit]: [number, "second" | "minute" | "hour" | "day"] =
    value >= DAY && value % DAY === 0 && value > DAY
      ? [value / DAY, "day"]
      : value >= HOUR && value % HOUR === 0
        ? [value / HOUR, "hour"]
        : value >= MINUTE && value % MINUTE === 0
          ? [value / MINUTE, "minute"]
          : [value, "second"];

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(amount);
}
