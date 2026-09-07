// Turning an identifier into something a human reads (changes-08 #2).
//
// The admin surface is full of identifiers that were never meant for
// display: role keys (`super_admin`), setting keys
// (`legal.copyrightNotice`), permission keys (`articles.publish`), enum
// members (`PENDING_VERIFICATION`), section keys (`latest-articles`).
// Every one of them used to render raw — underscores, dots and all.
//
// This is DISPLAY-ONLY. The identifier itself is still the identifier:
// nothing here is ever parsed back, used as a lookup key, or written to
// the database. A catalog string always wins where one exists (code-style
// #2); `humanizeKey` is the fallback for values that are code-defined and
// therefore have no catalog entry of their own.

/**
 * Tokens that must not be title-cased letter-by-letter. Matched
 * case-insensitively against a whole word, so `seo.titleTemplate` reads
 * "SEO Title Template" rather than "Seo Title Template".
 */
const ACRONYMS = new Set([
  "api",
  "cms",
  "cta",
  "csv",
  "faq",
  "html",
  "id",
  "ip",
  "json",
  "og",
  "pdf",
  "rss",
  "rtl",
  "seo",
  "sms",
  "url",
  "ui",
  "ux",
]);

function titleCaseWord(word: string): string {
  if (word === "") return word;
  if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
  return (word[0] ?? "").toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * `super_admin` → `Super Admin`, `legal.copyrightNotice` → `Legal
 * Copyright Notice`, `PENDING_VERIFICATION` → `Pending Verification`,
 * `latest-articles` → `Latest Articles`, `seo.robotsIndex` → `SEO Robots
 * Index`.
 *
 * camelCase/PascalCase boundaries split into words, and every run of
 * non-alphanumeric characters is a separator — one rule instead of an
 * enumerated punctuation set, so a key shape nobody anticipated still
 * comes out clean rather than leaking a `_` into the UI. Digits stay
 * attached to the word they follow (`h2Heading` → `H2 Heading`). Returns
 * `""` for empty input so a caller can fall back with `||`.
 */
export function humanizeKey(key: string): string {
  if (!key) return "";
  return (
    key
      // camelCase / PascalCase boundaries, including acronym runs
      // ("OGImage" → "OG Image", not "O G Image").
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      // Structural separators: anything that is not a letter or a digit.
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(titleCaseWord)
      .join(" ")
  );
}

/**
 * Same transformation, but returns the ORIGINAL string when it already
 * reads as prose — i.e. it has a space and no key-shaped punctuation. Use
 * it where the value may already be a human label (`"Head of Content"`
 * must not become `"Head Of Content"`).
 */
export function humanizeIfKey(value: string): string {
  if (!value) return "";
  const looksLikeKey = /[._/-]/.test(value) || /^[A-Z0-9_]+$/.test(value) || !/\s/.test(value);
  return looksLikeKey ? humanizeKey(value) : value;
}
