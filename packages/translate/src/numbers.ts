// The number check (ADR-160 #8). Pure.
//
// On a forex site the failure that matters most is a figure that changed in
// translation: a $10 minimum, 1:100 leverage, a 70% pass mark. After every
// machine translation the numbers in the source are compared with the
// target's; a difference marks the row for a person to read rather than
// publishing it silently.
//
// Compared as a MULTISET of digit runs, because word order changes between
// languages and "1:100" may come back as "100:1" in a right-to-left sentence
// only if the translation is wrong — which is exactly what should be flagged.
// Separators are normalised first so formatting differences are not flagged:
// Arabic-Indic and Persian digits become ASCII, and a thousands separator
// ("1,000", "1٬000", "1 000") is removed.

const DIGIT_BLOCKS = [
  0x0660, // Arabic-Indic ٠-٩
  0x06f0, // Extended Arabic-Indic (Urdu, Persian) ۰-۹
  0x0966, // Devanagari
];

/** ASCII digits for every digit block a target locale is likely to use. */
// Built from code points so the source holds no invisible characters.
const ARABIC_DECIMAL = String.fromCharCode(0x066b);
const ARABIC_THOUSANDS = String.fromCharCode(0x066c);
const NO_BREAK_SPACE = String.fromCharCode(0x00a0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

// A thousands separator: the tail after it is exactly a three-digit group.
const THOUSANDS = new RegExp(
  `(\\d)[,. ${NO_BREAK_SPACE}${NARROW_NO_BREAK_SPACE}${ARABIC_THOUSANDS}](?=\\d{3}(?!\\d))`,
  "g",
);

export function normaliseDigits(text: string): string {
  let out = text;
  for (const zero of DIGIT_BLOCKS) {
    const range = new RegExp(
      `[${String.fromCharCode(zero)}-${String.fromCharCode(zero + 9)}]`,
      "g",
    );
    out = out.replace(range, (d) => String(d.charCodeAt(0) - zero));
  }
  return out.replaceAll(ARABIC_DECIMAL, ".");
}

/** The digit runs in a text, markup and entities ignored, sorted. */
export function extractNumbers(text: string): string[] {
  const plain = normaliseDigits(text.replace(/<[^>]*>/g, " ").replace(/&#?[a-zA-Z0-9]+;/g, " "));
  // "1,000" / "1.000" / "1 000" → "1000"; "1.5" stays two runs, which both
  // sides share.
  const grouped = plain.replace(THOUSANDS, "$1");
  return (grouped.match(/\d+/g) ?? []).sort();
}

/** True when source and target carry the same numbers, in any order. */
export function numbersMatch(source: string, target: string): boolean {
  const a = extractNumbers(source);
  const b = extractNumbers(target);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
