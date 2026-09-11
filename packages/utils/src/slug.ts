// URL slugs — a pure helper, so it lives here rather than in `@repo/core`.
//
// It was defined in `core/src/content.ts` and exported from there, which meant
// the ONE place that knows how a slug is spelled could only be reached by
// server code: `@repo/core` imports Prisma, so a client component that wanted
// to preview the slug it was about to save had to reimplement the rule. The
// admin's `SlugField` autofills as you type, which is exactly that case.
//
// The rule itself is unchanged, character for character. `@repo/core`
// re-exports this name, so every existing import keeps working.

/**
 * Lowercase, strip diacritics, collapse everything that is not a Latin
 * alphanumeric or an Arabic letter into a single hyphen, trim hyphens, cap at
 * the 150-character column width.
 *
 * The Arabic range is deliberate and load-bearing (ADR-007: `ar` and `ur` are
 * seeded locales). Dropping it would slug every Arabic title to the empty
 * string, and the callers that fall back to "term" or "topic" would then give
 * every Arabic row the SAME slug — a unique-constraint collision that looks
 * like a database fault rather than a transliteration one.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}
