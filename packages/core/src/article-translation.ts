// The article translation job (ADR-161, ADR-162 #5): one article into one
// locale, by Google Cloud Translation, written only where a machine may write.
//
// The order is the point:
//
//   1. Read the English source now — the job carries no content, so an edit
//      made after the job was queued is what gets translated.
//   2. Decide from the target row's STATUS: a person's row (TRANSLATED,
//      OUTDATED, NEEDS_REVIEW, DRAFT) is never overwritten; a TRANSLATED row
//      whose source moved becomes OUTDATED and nothing else happens.
//   3. Translate OUTSIDE any transaction: Google can take seconds, and a row
//      lock held across a network call would block the editor.
//   4. Write inside a short ReadCommitted transaction that locks the source
//      row, re-hashes it and re-reads the target. A source that moved means
//      the result is thrown away and the job asks to run again; a person who
//      saved the target meanwhile wins.
//
// A figure that changed in translation (ADR-160 #8) is still written, but as
// NEEDS_REVIEW — a person's state, so the next run leaves it alone and it
// sits in the review queue until someone reads it.
import { DbNull, TranslationStatus, db, type Prisma } from "@repo/db";
import {
  numbersMatch,
  translateHtmlMany,
  translateTexts,
  type GlossaryPair,
  type JobOutcome,
} from "@repo/translate";

import { hashArticleSource, loadArticleSource, type ArticleSource } from "./article-source.ts";
import { sanitizeRichText } from "./content.ts";

/** Column widths the translated text must fit (schema + contracts). */
const LIMITS = {
  title: 255,
  excerpt: 500,
  seoTitle: 70,
  seoDescription: 180,
  ogTitle: 120,
  ogDescription: 300,
  takeaway: 160,
  question: 300,
} as const;

/**
 * Shortens text that grew in translation to fit its column, at a word
 * boundary where one is close, with an ellipsis. A translation is often
 * longer than its English (Spanish and Arabic commonly run 20–30% longer), and
 * a column overflow would fail the whole write.
 */
export function fitTo(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

async function defaultLocaleCode(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

/**
 * Glossary terms with a HUMAN-saved translation in `locale` (ADR-160 #9), as
 * English → target pairs for substitution before the call. Only published,
 * visible terms: a draft term's wording is not settled yet.
 */
export async function loadGlossaryPairs(
  locale: string,
  defaultLocale: string,
): Promise<GlossaryPair[]> {
  const rows = await db.glossaryTermTranslation.findMany({
    where: {
      locale: { in: [locale, defaultLocale] },
      glossaryTerm: { deletedAt: null, isActive: true, status: "PUBLISHED" },
    },
    select: { termId: true, locale: true, term: true, translationStatus: true },
  });
  const english = new Map<string, string>();
  const target = new Map<string, string>();
  for (const row of rows) {
    if (row.locale === defaultLocale) english.set(row.termId, row.term);
    else if (row.translationStatus === TranslationStatus.TRANSLATED)
      target.set(row.termId, row.term);
  }
  const pairs: GlossaryPair[] = [];
  for (const [termId, source] of english) {
    const translated = target.get(termId);
    if (translated) pairs.push({ source, target: translated });
  }
  return pairs;
}

/** Every piece of text in a source or its translation, for the number check. */
function allText(parts: {
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  keyTakeaways: string[] | null;
  faq: Array<{ question: string; answer: string }>;
}): string {
  return [
    parts.title,
    parts.excerpt,
    parts.body,
    parts.seoTitle,
    parts.seoDescription,
    parts.ogTitle,
    parts.ogDescription,
    ...(parts.keyTakeaways ?? []),
    ...parts.faq.flatMap((f) => [f.question, f.answer]),
  ]
    .filter((t): t is string => typeof t === "string")
    .join("\n");
}

/**
 * The English slug, unless another article already holds it in this locale
 * (ADR-161 #6): then the locale is appended, and failing that a piece of the
 * article's id. Slugs are never transliterated.
 */
async function pickSlug(
  tx: Prisma.TransactionClient,
  articleId: string,
  locale: string,
  slug: string,
): Promise<string> {
  const candidates = [slug, `${slug}-${locale}`, `${slug}-${locale}-${articleId.slice(-6)}`];
  for (const candidate of candidates) {
    const taken = await tx.articleTranslation.findFirst({
      where: { locale, slug: candidate, articleId: { not: articleId } },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${slug}-${articleId}`;
}

interface Translated {
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

/**
 * What the job sends to Google, in order: the plain fields, then the HTML
 * ones. One definition, so the dashboard's pre-flight estimate (ADR-163 #3)
 * counts exactly what a run would.
 */
export function articleSegments(source: ArticleSource): { plain: string[]; html: string[] } {
  return {
    plain: [
      source.title,
      source.excerpt ?? "",
      source.seoTitle ?? "",
      source.seoDescription ?? "",
      source.ogTitle ?? "",
      source.ogDescription ?? "",
      ...(source.keyTakeaways ?? []),
      ...source.faq.map((f) => f.question),
    ],
    html: [source.body ?? "", ...source.faq.map((f) => f.answer)],
  };
}

/** Characters a translation of this source would send (blank segments are skipped). */
export function articleSourceCharacters(source: ArticleSource): number {
  const { plain, html } = articleSegments(source);
  return [...plain, ...html].reduce(
    (sum, segment) => sum + (segment.trim() === "" ? 0 : segment.length),
    0,
  );
}

async function translateArticleSource(
  source: ArticleSource,
  articleId: string,
  sourceLocale: string,
  targetLocale: string,
): Promise<Translated> {
  const options = {
    source: sourceLocale,
    target: targetLocale,
    entity: { type: "article", id: articleId },
  };
  const takeaways = source.keyTakeaways ?? [];
  const { plain, html } = articleSegments(source);
  const glossary = await loadGlossaryPairs(targetLocale, sourceLocale);
  const [texts, htmls] = await Promise.all([
    translateTexts(plain, options),
    translateHtmlMany(html, { ...options, glossary }),
  ]);

  const at = (index: number) => texts[index] ?? "";
  const orNull = (index: number, original: string | null, max: number) =>
    original === null || original.trim() === "" ? null : fitTo(at(index), max);
  const takeawayStart = 6;
  const questionStart = takeawayStart + takeaways.length;

  return {
    title: fitTo(at(0), LIMITS.title),
    excerpt: orNull(1, source.excerpt, LIMITS.excerpt),
    seoTitle: orNull(2, source.seoTitle, LIMITS.seoTitle),
    seoDescription: orNull(3, source.seoDescription, LIMITS.seoDescription),
    ogTitle: orNull(4, source.ogTitle, LIMITS.ogTitle),
    ogDescription: orNull(5, source.ogDescription, LIMITS.ogDescription),
    keyTakeaways:
      takeaways.length > 0
        ? takeaways.map((_, i) => fitTo(at(takeawayStart + i), LIMITS.takeaway))
        : null,
    // Sanitized exactly as an editor's save is (security.md #8): Google's
    // HTML is external input like any other.
    body: source.body ? sanitizeRichText(htmls[0] ?? "") : null,
    faq: source.faq.map((_, i) => ({
      question: fitTo(at(questionStart + i), LIMITS.question),
      answer: sanitizeRichText(htmls[i + 1] ?? ""),
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/** The `article` job handler (ADR-162). */
export async function translateArticleJob(job: {
  entityId: string;
  locale: string;
}): Promise<JobOutcome> {
  const articleId = job.entityId;
  const defaultLocale = await defaultLocaleCode();
  if (job.locale === defaultLocale) return "done";

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { deletedAt: true },
  });
  if (!article || article.deletedAt) return "done";

  const source = await loadArticleSource(db, articleId, defaultLocale);
  if (!source) return "done";
  const hash = hashArticleSource(source);

  const target = await db.articleTranslation.findUnique({
    where: { articleId_locale: { articleId, locale: job.locale } },
    select: { id: true, translationStatus: true, sourceHash: true },
  });

  if (target && target.translationStatus !== TranslationStatus.MACHINE_TRANSLATED) {
    // A person's row. The one thing a job does to it: say it went stale.
    if (target.translationStatus === TranslationStatus.TRANSLATED && target.sourceHash !== hash) {
      await db.articleTranslation.updateMany({
        where: { id: target.id, translationStatus: TranslationStatus.TRANSLATED },
        data: { translationStatus: TranslationStatus.OUTDATED },
      });
    }
    return "done";
  }
  if (target && target.sourceHash === hash) return "done";

  const translated = await translateArticleSource(source, articleId, defaultLocale, job.locale);
  const status = numbersMatch(allText(source), allText(translated))
    ? TranslationStatus.MACHINE_TRANSLATED
    : TranslationStatus.NEEDS_REVIEW;

  try {
    return await db.$transaction(
      async (tx) => {
        // Lock the source so a save of it waits for this write, and its
        // enqueue then finds this job still RUNNING and marks it `rerun`.
        await tx.$queryRaw`
          SELECT id FROM article_translations
           WHERE articleId = ${articleId} AND locale = ${defaultLocale}
           FOR UPDATE`;
        const current = await loadArticleSource(tx, articleId, defaultLocale);
        if (!current) return "done" as const;
        if (hashArticleSource(current) !== hash) return "requeue" as const;

        const [existing] = await tx.$queryRaw<Array<{ translationStatus: string }>>`
          SELECT translationStatus FROM article_translations
           WHERE articleId = ${articleId} AND locale = ${job.locale}
           FOR UPDATE`;
        if (existing && existing.translationStatus !== TranslationStatus.MACHINE_TRANSLATED) {
          return "done" as const; // a person saved it while we translated
        }

        const data = {
          title: translated.title,
          excerpt: translated.excerpt,
          body: translated.body,
          seoTitle: translated.seoTitle,
          seoDescription: translated.seoDescription,
          ogTitle: translated.ogTitle,
          ogDescription: translated.ogDescription,
          keyTakeaways: translated.keyTakeaways ?? DbNull,
          translationStatus: status,
          sourceHash: hash,
          translatedBy: null,
        };
        const saved = existing
          ? await tx.articleTranslation.update({
              where: { articleId_locale: { articleId, locale: job.locale } },
              data,
            })
          : await tx.articleTranslation.create({
              data: {
                articleId,
                locale: job.locale,
                slug: await pickSlug(tx, articleId, job.locale, source.slug),
                ...data,
              },
            });

        await tx.articleFaqItem.deleteMany({ where: { translationId: saved.id } });
        if (translated.faq.length > 0) {
          await tx.articleFaqItem.createMany({
            data: translated.faq.map((item, index) => ({
              translationId: saved.id,
              sortOrder: index,
              question: item.question,
              answer: item.answer,
            })),
          });
        }
        return "done" as const;
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    // A person created the row between our read and our insert: theirs wins.
    if (isUniqueViolation(error)) {
      const now = await db.articleTranslation.findUnique({
        where: { articleId_locale: { articleId, locale: job.locale } },
        select: { id: true },
      });
      if (now) return "done";
    }
    throw error;
  }
}
