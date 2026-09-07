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

/** Whitespace-delimited word count of already-extracted text. */
export function countWords(text: string): number {
  if (text === "") return 0;
  return text.split(/\s+/).filter((w) => w !== "").length;
}
