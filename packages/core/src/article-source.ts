// An article's translatable SOURCE, and its hash (ADR-161).
//
// One definition shared by the three places that must agree: a human saving
// the English row, a human saving another locale (which records the hash it
// was translated from), and the translation job (which decides whether a
// machine row is current and refuses to write over a source that moved).
//
// The hash covers every field the editor treats as translatable — title,
// excerpt, body, the SEO and social text, the key takeaways and the FAQ.
// It used to cover title + body only, so an edited excerpt or FAQ answer never
// marked a translation stale. Widening it makes existing rows mismatch once:
// a human row becomes OUTDATED on the next English save and a machine row is
// re-translated, which is the honest answer for text nobody compared.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface ArticleSourceParts {
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  keyTakeaways: string[] | null;
  faq: Array<{ question: string; answer: string }>;
}

export interface ArticleSource extends ArticleSourceParts {
  id: string;
  slug: string;
}

/** A stored `keyTakeaways` Json value as the string list it holds, or null. */
export function takeawaysOf(value: Prisma.JsonValue | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((v): v is string => typeof v === "string");
  return items.length > 0 ? items : null;
}

/** The hash of an article's translatable source. Order and absence both count. */
export function hashArticleSource(parts: ArticleSourceParts): string {
  return computeSourceHash(
    JSON.stringify([
      parts.title,
      parts.excerpt ?? "",
      parts.body ?? "",
      parts.seoTitle ?? "",
      parts.seoDescription ?? "",
      parts.ogTitle ?? "",
      parts.ogDescription ?? "",
      parts.keyTakeaways ?? [],
      parts.faq.map((item) => [item.question, item.answer]),
    ]),
  );
}

/** The default-locale row and its FAQ, through any client (db or a transaction). */
export async function loadArticleSource(
  client: Pick<Prisma.TransactionClient, "articleTranslation">,
  articleId: string,
  defaultLocale: string,
): Promise<ArticleSource | null> {
  const row = await client.articleTranslation.findUnique({
    where: { articleId_locale: { articleId, locale: defaultLocale } },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      seoTitle: true,
      seoDescription: true,
      ogTitle: true,
      ogDescription: true,
      keyTakeaways: true,
      faqItems: { orderBy: { sortOrder: "asc" }, select: { question: true, answer: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    keyTakeaways: takeawaysOf(row.keyTakeaways),
    faq: row.faqItems,
  };
}
