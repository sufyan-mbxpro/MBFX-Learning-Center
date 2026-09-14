// The homepage's closing quotations (changes-28 PR 3, ADR-093).
//
// Composition is code (ADR-042), and this is the composition: which quotes the
// band carries and in what order. What it deliberately does NOT hold is the
// TEXT — that is a catalog key derived from `key`, so the band translates like
// everything else under `app/(public)/**` (ADR-043 #1, code-style.md #2).
//
// ─── What a quote asserts, and what this file is allowed to claim ─────────
//
// A quotation is a factual claim about a person: it says "this named human
// said these words". ADR-047 §3's rule therefore applies to it exactly as it
// applies to a video URL — so every entry here is a widely documented
// attribution, not a plausible-sounding one, and none of them is attributed to
// anyone connected with this site. A "what our traders say" testimonial band
// would be the other thing entirely, and is not this: it would need real
// people who really said it, which is content, not composition.
//
// The ATTRIBUTION is not a catalog key. A person's name is not translated
// (`Albert Einstein` is `Albert Einstein` in every locale this site serves),
// and routing it through a catalog would invite a translator to render it
// phonetically in Arabic or Urdu, which is a different claim about a different
// person. The words are translated; the name is data.

import { cacheLife } from "next/cache";

export interface HomeQuote {
  /** Catalog key stem: `discipline` → `home.quoteDisciplineText`. */
  key: string;
  /** The speaker, verbatim. Not translated — see the note above. */
  author: string;
}

export const HOME_QUOTES = [
  { key: "awareness", author: "Albert Einstein" },
  { key: "winners", author: "Vince Lombardi" },
  { key: "risk", author: "Warren Buffett" },
  { key: "preparation", author: "Benjamin Franklin" },
  { key: "patience", author: "Charlie Munger" },
] as const satisfies readonly HomeQuote[];

/**
 * The quote for a given day, chosen deterministically.
 *
 * The `term-of-the-day` precedent (D29): no cron, no column, no random. A
 * random pick would differ between the server render and any later
 * revalidation of the same cached page, which is how a "quote of the day"
 * becomes a quote of the request. The day number since the epoch, modulo the
 * list, gives every visitor the same quote on the same date and walks the
 * whole list before repeating.
 *
 * UTC deliberately: the page is CACHED and shared across time zones, so there
 * is no "the visitor's today" to read — a local-time pick would just be the
 * build machine's today wearing a disguise.
 */
export function quoteOfTheDay(now: Date = new Date()): HomeQuote {
  const dayNumber = Math.floor(now.getTime() / 86_400_000);
  // `%` on a negative day number (a date before 1970) would index out of the
  // array and return undefined. Not reachable in production, and cheaper to
  // make impossible than to reason about.
  const index = ((dayNumber % HOME_QUOTES.length) + HOME_QUOTES.length) % HOME_QUOTES.length;
  return HOME_QUOTES[index] as HomeQuote;
}

/**
 * `quoteOfTheDay`'s own read of the clock, isolated behind a daily
 * `"use cache"` boundary (the same shape as `@repo/core`'s
 * `getTermOfTheDay`). `new Date()` is an unstable value during prerendering —
 * Cache Components refuses to bake "whatever time the build happened to run"
 * into a static page — so the read has to happen inside a cache scope that is
 * explicitly allowed to fix it for the cache's lifetime, not at the call site
 * in the (uncached) `Quotes` section.
 */
export async function loadQuoteOfTheDay(): Promise<HomeQuote> {
  "use cache";
  cacheLife({ revalidate: 86_400 });

  return quoteOfTheDay();
}
