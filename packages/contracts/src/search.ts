import { z } from "zod";

// Public site search (changes-32, ADR-108).
//
// The query is EXTERNAL INPUT on an anonymous endpoint (security.md #6), so it
// is parsed here rather than read off the URL. Two bounds and a locale:
//
//   * a floor, because a one-character query matches most of the corpus and
//     costs a scan per table to say so;
//   * a ceiling, because past a hundred characters the input is a paste, and a
//     `LIKE '%…%'` over an arbitrarily long needle is a way to spend a
//     database's time from outside;
//   * the locale as a short slug, not a free string, since it reaches a
//     `where` clause.
//
// `MIN_QUERY_LENGTH`/`MAX_QUERY_LENGTH` are also exported from `@repo/core`'s
// search service, which enforces them again — the client must not be the only
// thing that knows.

export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 100;

export const publicSearchQuerySchema = z.object({
  q: z.string().trim().min(SEARCH_QUERY_MIN).max(SEARCH_QUERY_MAX),
  /** A locale CODE, matched against the active list by the caller. */
  locale: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/, "must be a locale code"),
});

export type PublicSearchQuery = z.infer<typeof publicSearchQuerySchema>;
