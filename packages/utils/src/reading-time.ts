// Reading time for sanitized-HTML article bodies (Module 15).

import { countWords, htmlToText } from "./html-text.ts";

export const WORDS_PER_MINUTE = 200;

/**
 * Minutes to read an HTML fragment, tags stripped, floor of 1 for any
 * non-empty content. Pure text math — locale-agnostic word splitting on
 * whitespace, which is deliberately rough (good enough for a byline hint).
 *
 * changes-07 PR 1: markup stripping moved to the shared `htmlToText` so the
 * editor's word-count tile and this figure can never disagree. Behaviour is
 * unchanged — `reading-time.test.ts` pins it.
 */
export function readingTimeMinutes(html: string): number {
  return minutesForWords(countWords(htmlToText(html)));
}

/** The same 200-wpm rounding, for callers that already counted the words. */
export function minutesForWords(words: number): number {
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
