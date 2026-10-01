// Plain text out of a sanitized-HTML fragment. Shared by `readingTimeMinutes`
// and the content-analysis helpers so a body is measured ONE way — a word
// count and the reading time derived from it must never disagree because two
// functions stripped markup slightly differently.
//
// Deliberately rough and locale-agnostic: whitespace splitting, no
// segmentation, no stemming. These numbers are an authoring hint, never a gate
// (changes-07-plan.md §9 risk 5).

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  // Decoded to the real NBSP, which `\s` still matches — so it collapses as
  // whitespace rather than gluing two words together.
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntity(body: string): string {
  if (body.startsWith("#")) {
    const codePoint =
      body.startsWith("#x") || body.startsWith("#X")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
    if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return " ";
      }
    }
    return " ";
  }
  // An unrecognized entity becomes a space rather than surviving as literal
  // "&frac12;" text, which would otherwise be counted as a word.
  return NAMED_ENTITIES[body.toLowerCase()] ?? " ";
}

/**
 * Tags removed, entities decoded, whitespace collapsed, trimmed.
 * `<script>`/`<style>` bodies are dropped entirely — our sanitizer strips them
 * on save (ADR-009), but this helper also runs on unsaved editor state.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&([a-z0-9#]+);/gi, (_match, body: string) => decodeEntity(body))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Inline formatting tags. They sit INSIDE a run of words, so a display
 * excerpt removes them without a space — `htmlToText` turns every tag into a
 * space, which reads "Start <strong>here</strong>." as "Start here .".
 * Block tags (p, li, h2, br…) are not listed: they separate words and keep
 * becoming a space.
 */
const INLINE_TAG =
  /<\/?(?:a|abbr|b|cite|code|em|i|kbd|mark|q|s|small|span|strong|sub|sup|u)\b[^>]*>/gi;

/**
 * Inline tags removed with no space left behind. For DISPLAY text only: word
 * counts and reading time keep `htmlToText`'s rule, where an extra space can
 * never merge two words.
 */
export function stripInlineTags(html: string): string {
  return html.replace(INLINE_TAG, "");
}

/**
 * A rich-text value as one line of display text — inline markup glued to its
 * words, entities decoded — cut to `max` characters with an ellipsis. The
 * shared form of a search hit's or a promotion's borrowed excerpt.
 */
export function htmlExcerpt(html: string, max: number): string {
  const text = htmlToText(stripInlineTags(html));
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Whitespace-delimited word count of already-extracted text. */
export function countWords(text: string): number {
  if (text === "") return 0;
  return text.split(/\s+/).filter((w) => w !== "").length;
}

/**
 * The lead of a rich-text body as plain text: its first non-empty paragraph,
 * capped at `max` characters on a word boundary.
 *
 * changes-46 #1 made a glossary term ONE rich body, so the column the A–Z
 * list, the topic pages and the related cards print inline now holds the
 * whole explanation — headings included. Those surfaces want the definition,
 * which is the opening paragraph, not the page. A body with no `<p>` (a
 * one-line legacy value) falls back to all of its text.
 */
export function htmlLead(html: string, max = 320): string {
  let lead = "";
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    lead = htmlToText(match[1] ?? "");
    if (lead !== "") break;
  }
  if (lead === "") lead = htmlToText(html);
  if (lead.length <= max) return lead;
  const cut = lead.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
