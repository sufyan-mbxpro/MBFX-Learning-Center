// Authoring-time content analysis for the article editor (changes-07 PR 1,
// plan §4.4). Pure, locale-agnostic, no DOM — the editor computes these
// client-side on every keystroke and the SEO panel renders them.
//
// Everything here is ADVISORY. Nothing in the save path may block on a score
// or a density figure (changes-07-plan.md §9 risk 5); the reference screen
// presents these as if authoritative, and they are not.

import { countWords, htmlToText } from "./html-text.ts";
import { minutesForWords } from "./reading-time.ts";

export interface ContentStats {
  words: number;
  /** Visible characters after markup is stripped and whitespace collapsed. */
  characters: number;
  readingMinutes: number;
}

/**
 * The editor's stats strip. Reading time is derived from THIS word count
 * rather than recomputed, so "1014 words · 6 min" is always self-consistent.
 */
export function analyzeContent(html: string): ContentStats {
  const text = htmlToText(html);
  const words = countWords(text);
  return { words, characters: text.length, readingMinutes: minutesForWords(words) };
}

/**
 * Comma-separated focus keywords → trimmed, de-duplicated, case-insensitively
 * unique list. Empty entries are dropped, so "a,,b," yields ["a","b"].
 */
export function parseKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const keyword = part.trim().replace(/\s+/g, " ");
    if (keyword === "") continue;
    const fold = keyword.toLowerCase();
    if (seen.has(fold)) continue;
    seen.add(fold);
    out.push(keyword);
  }
  return out;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Non-overlapping, case-insensitive occurrences of `phrase` in `text`.
 *
 * Boundaries use Unicode letter/number lookarounds rather than `\b`, which is
 * ASCII-only in JavaScript and would mis-handle Arabic and Urdu keywords —
 * `\b` would report a match inside a longer Arabic word. Internal whitespace
 * in the phrase matches any run of whitespace, so a keyword typed with two
 * spaces still matches body text with one.
 */
export function countOccurrences(text: string, phrase: string): number {
  const needle = phrase.trim();
  if (needle === "") return 0;
  const pattern = escapeRegex(needle).replace(/\s+/g, "\\s+");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu");
  return (text.match(re) ?? []).length;
}

export interface KeywordDensity {
  keyword: string;
  count: number;
  /** Percentage, 0–100. Occurrences ÷ total words, the Yoast/RankMath convention. */
  density: number;
}

/** Recommended density band the editor renders as a hint, in percent. */
export const OPTIMAL_DENSITY = { min: 2, max: 3 } as const;

/**
 * Density per keyword. A phrase counts as ONE occurrence regardless of how
 * many words it contains — the convention the reference tool follows, and the
 * reason a three-word keyword reads low.
 */
export function keywordDensity(html: string, keywords: string[]): KeywordDensity[] {
  const text = htmlToText(html);
  const totalWords = countWords(text);
  return keywords.map((keyword) => {
    const count = countOccurrences(text, keyword);
    return { keyword, count, density: totalWords === 0 ? 0 : (count / totalWords) * 100 };
  });
}

// ─── SEO checks ──────────────────────────────────────────────

export type SeoCheckId =
  | "titleLength"
  | "descriptionLength"
  | "focusKeywordInTitle"
  | "focusKeywordInDescription"
  | "focusKeywordInFirstParagraph"
  | "contentLength"
  | "hasSubheadings"
  | "hasImages"
  | "hasInternalLink";

export interface SeoCheck {
  id: SeoCheckId;
  passed: boolean;
}

/** Thresholds the UI shows alongside each check — one source, not two. */
export const SEO_THRESHOLDS = {
  titleLength: { min: 50, max: 60 },
  descriptionLength: { min: 120, max: 160 },
  contentWords: { min: 300 },
  /** Words of body text scanned for the "early keyword" check. */
  firstParagraphWords: 100,
} as const;

export interface SeoCheckInput {
  title: string;
  description: string;
  body: string;
  keywords: string[];
}

/**
 * Nine rule-based checks. Each returns an ID, never a sentence — the wording
 * lives in the message catalogs (code-style.md #2), so this stays pure and
 * translatable.
 *
 * The keyword checks use the FIRST focus keyword only: that is what "focus"
 * means, and scoring against every keyword would make adding a secondary one
 * lower the score.
 */
export function seoChecks({ title, description, body, keywords }: SeoCheckInput): SeoCheck[] {
  const text = htmlToText(body);
  const words = countWords(text);
  const focus = keywords[0] ?? "";
  const opening = text.split(/\s+/).slice(0, SEO_THRESHOLDS.firstParagraphWords).join(" ");

  const inRange = (value: number, { min, max }: { min: number; max: number }) =>
    value >= min && value <= max;
  // An absent focus keyword fails its three checks rather than passing
  // vacuously — "no keyword set" is a real SEO gap, not a clean bill.
  const hasFocus = focus !== "";

  return [
    { id: "titleLength", passed: inRange(title.trim().length, SEO_THRESHOLDS.titleLength) },
    {
      id: "descriptionLength",
      passed: inRange(description.trim().length, SEO_THRESHOLDS.descriptionLength),
    },
    { id: "focusKeywordInTitle", passed: hasFocus && countOccurrences(title, focus) > 0 },
    {
      id: "focusKeywordInDescription",
      passed: hasFocus && countOccurrences(description, focus) > 0,
    },
    {
      id: "focusKeywordInFirstParagraph",
      passed: hasFocus && countOccurrences(opening, focus) > 0,
    },
    { id: "contentLength", passed: words >= SEO_THRESHOLDS.contentWords.min },
    { id: "hasSubheadings", passed: /<h[2-6]\b/i.test(body) },
    { id: "hasImages", passed: /<img\b/i.test(body) },
    // Internal = root-relative. An absolute link to our own domain is not
    // detectable here without knowing the domain, which this pure helper
    // deliberately does not.
    { id: "hasInternalLink", passed: /<a\b[^>]*\shref\s*=\s*["']\/(?!\/)/i.test(body) },
  ];
}

/** 0–100, rounded. Every check weighs the same — a weighted score would imply a precision these rules don't have. */
export function seoScore(checks: SeoCheck[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
}
