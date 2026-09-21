// The query-shaping half of the public article listings' `q` search
// (changes-45): which words a query is matched by, and how a hit is ranked.
// Pure functions — the `where` they feed is covered against MariaDB in
// `articles.integration.test.ts`.
//
// A sibling of `public-search.ts`'s `searchTerms`/`scoreMatch` rather than an
// import of them: `public-search.ts` imports `public-articles.ts` for its
// visibility rule, so the listing importing back would be a cycle.

/** Above this the input is not a search, it is a paste (the contract's own cap). */
const MAX_QUERY_LENGTH = 100;

/** A query is a phrase, not a program: past this many words the rest are noise. */
export const MAX_ARTICLE_SEARCH_TERMS = 8;

/**
 * The words an article search matches ANY of (changes-45).
 *
 * The listing used to match the query as ONE substring, so "gold dollar"
 * found only an article containing those two words side by side, in that
 * order — usually nothing, although "gold" and "dollar" each found several.
 *
 * - LIKE wildcards (`%`, `_`) and the escape character (`\`) become spaces,
 *   exactly as the site-wide search does: Prisma parameterises the value, but
 *   `%` inside a `contains` is still a wildcard to MariaDB.
 * - Split on whitespace only, so "EUR/USD" stays one thing to look for.
 * - A one-character word is always dropped — it matches nearly every row.
 *   A two-character word is dropped too once the query has a longer one
 *   ("is" in "what is a pip" would match "this", "crisis", …), and kept when
 *   it is all the query has ("FX").
 * - Case-folded and de-duplicated, then capped at `MAX_ARTICLE_SEARCH_TERMS`.
 */
export function articleSearchTerms(query: string): string[] {
  const words = [
    ...new Set(
      query
        .slice(0, MAX_QUERY_LENGTH)
        .replaceAll(/[%_\\]/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length >= 2),
    ),
  ];
  const long = words.filter((word) => word.length >= 3);
  return (long.length > 0 ? long : words).slice(0, MAX_ARTICLE_SEARCH_TERMS);
}

/**
 * How well an article answers the query. Higher is better; a caller keeps
 * the listing's own newest-first order between equal scores (a stable sort).
 *
 * The whole phrase outranks any single word, a word in the title outranks one
 * in the excerpt, and every additional matched word adds — so an article that
 * mentions both "gold" and "dollar" sits above one that mentions only one.
 */
export function articleSearchScore(
  query: string,
  terms: readonly string[],
  title: string,
  excerpt: string | null | undefined,
): number {
  const phrase = query.trim().toLowerCase();
  const head = title.toLowerCase();
  const rest = (excerpt ?? "").toLowerCase();
  let score = 0;
  if (terms.length > 1 && phrase) {
    if (head.includes(phrase)) score += 100;
    else if (rest.includes(phrase)) score += 40;
  }
  for (const term of terms) {
    if (head.includes(term)) score += 10;
    else if (rest.includes(term)) score += 3;
  }
  return score;
}
