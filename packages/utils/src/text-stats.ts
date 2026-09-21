// Counts for plain text the writing studio shows live (ADR-129 §3).
//
// Separate from `html-text.ts`'s `countWords`, which is deliberately rough
// whitespace splitting for HTML bodies. Here the counts ARE the feature: the
// admin sets a character or word target and reads the result against it, so
// "characters" means what a person sees (an emoji is one, not two UTF-16
// units) and "words" must not fall apart on a script without spaces between
// every word. `Intl.Segmenter` answers both; the fallbacks exist for a runtime
// without it and are only as good as whitespace.

import { minutesForWords } from "./reading-time.ts";

export interface TextStats {
  /** Graphemes, spaces and line breaks included. */
  characters: number;
  /** Graphemes that are not whitespace. */
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  /** Runs of text separated by a blank line. */
  paragraphs: number;
  readingMinutes: number;
}

export type TextLengthUnit = "characters" | "words";

const hasSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl;

function graphemes(text: string): string[] {
  if (!hasSegmenter) return Array.from(text);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

function wordCount(text: string): number {
  if (!hasSegmenter) return text.split(/\s+/).filter((w) => w !== "").length;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  let count = 0;
  for (const segment of segmenter.segment(text)) if (segment.isWordLike) count++;
  return count;
}

function sentenceCount(text: string): number {
  if (!hasSegmenter) return text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim() !== "").length;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  let count = 0;
  // A trailing newline segments as its own "sentence"; only text counts.
  for (const segment of segmenter.segment(text)) if (/[\p{L}\p{N}]/u.test(segment.segment)) count++;
  return count;
}

export function textStats(text: string): TextStats {
  const chars = graphemes(text);
  const words = wordCount(text);
  return {
    characters: chars.length,
    charactersNoSpaces: chars.filter((c) => !/^\s+$/.test(c)).length,
    words,
    sentences: sentenceCount(text),
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim() !== "").length,
    readingMinutes: minutesForWords(words),
  };
}

export interface LengthFit {
  count: number;
  target: number;
  /** Positive when the text is longer than the target, zero when it fits. */
  over: number;
}

/** How a text measures against a target, in the target's own unit. */
export function measureLength(
  text: string,
  { unit, target }: { unit: TextLengthUnit; target: number },
): LengthFit {
  const stats = textStats(text);
  const count = unit === "words" ? stats.words : stats.characters;
  return { count, target, over: Math.max(0, count - target) };
}
