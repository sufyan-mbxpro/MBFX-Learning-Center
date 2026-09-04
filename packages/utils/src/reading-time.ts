// Reading time for sanitized-HTML article bodies (Module 15).

const WORDS_PER_MINUTE = 200;

/**
 * Minutes to read an HTML fragment, tags stripped, floor of 1 for any
 * non-empty content. Pure text math — locale-agnostic word splitting on
 * whitespace, which is deliberately rough (good enough for a byline hint).
 */
export function readingTimeMinutes(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim();
  if (text === "") return 0;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
