// The registry of machine-translatable types (ADR-163 #6).
//
// One entry per entity type, holding everything the queue and the dashboard
// need to know about it: the job handler, the backfill's walk, the coverage
// counts, the pre-flight estimate and the rows a person should review. The
// ARRAY ORDER is the backfill's order. Phase 5 adds a type by adding an entry,
// and cannot add one half-way: a type the dashboard cannot count is a type the
// backfill cannot walk.
import { TranslationStatus, db, type Prisma } from "@repo/db";
import type { JobHandler } from "@repo/translate";

import { hashArticleSource, takeawaysOf, type ArticleSource } from "./article-source.ts";
import { articleSourceCharacters, translateArticleJob } from "./article-translation.ts";
import { toCoverage, type CoverageCounts } from "./translation-coverage.ts";
import {
  courseTranslatable,
  lessonTranslatable,
  sectionTranslatable,
} from "./learn-translation.ts";
import { glossaryTermTranslatable, glossaryTopicTranslatable } from "./glossary-translation.ts";
import { videoCategoryTranslatable, videoTopicTranslatable } from "./video-translation.ts";
import { toolTranslatable } from "./tool-translation.ts";
import {
  articleCategoryTranslatable,
  articleTagTranslatable,
  menuItemTranslatable,
} from "./label-translation.ts";
import { quizQuestionTranslatable, quizTranslatable } from "./quiz-translation.ts";
import { settingTranslatable } from "./setting-translation.ts";
import { promotionTranslatable } from "./promotion-translation.ts";

export type { CoverageBucket, CoverageCounts } from "./translation-coverage.ts";

/** The states the review queue lists (ADR-159 #5, ADR-160 #8). */
export type ReviewStatus = "MACHINE_TRANSLATED" | "OUTDATED" | "NEEDS_REVIEW";

/**
 * A translation a person should look at: machine-written and not yet saved by
 * a person (ADR-159 #5), a person's whose English moved on (OUTDATED), or one
 * the number check flagged (NEEDS_REVIEW, ADR-160 #8).
 */
export interface ReviewRow {
  entityType: string;
  entityId: string;
  locale: string;
  status: ReviewStatus;
  /** The translated title, and the English one it came from. */
  title: string;
  sourceTitle: string | null;
  /** Null for the few translation tables with no `updatedAt` (menu items, sections). */
  updatedAt: Date | null;
}

export interface TranslatableType {
  entityType: string;
  handler: JobHandler;
  /** Ids a backfill enqueues: strictly after `after`, ascending. */
  page: (after: string | null, take: number, defaultLocale: string) => Promise<string[]>;
  coverage: (locale: string, defaultLocale: string) => Promise<CoverageCounts>;
  /** Characters a backfill would send, per locale (ADR-163 #3). */
  estimate: (locales: readonly string[], defaultLocale: string) => Promise<Map<string, number>>;
  review: (options: {
    locale?: string;
    defaultLocale: string;
    take: number;
  }) => Promise<ReviewRow[]>;
}

/** An article counts as a source when it is not deleted and has English text. */
function articleSourceWhere(defaultLocale: string) {
  return { deletedAt: null, translations: { some: { locale: defaultLocale } } };
}

/** One English article row with everything its source hash covers. */
interface ArticleSourceRow {
  id: string;
  articleId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  keyTakeaways: Prisma.JsonValue | null;
  faqItems: Array<{ question: string; answer: string }>;
}

/** The batch estimate reads sources a page at a time. */
const ESTIMATE_PAGE = 100;

const articleType: TranslatableType = {
  entityType: "article",
  handler: translateArticleJob,

  async page(after, take, defaultLocale) {
    const rows = await db.article.findMany({
      where: { ...articleSourceWhere(defaultLocale), ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  },

  async coverage(locale, defaultLocale) {
    const where = articleSourceWhere(defaultLocale);
    const [total, groups] = await Promise.all([
      db.article.count({ where }),
      db.articleTranslation.groupBy({
        by: ["translationStatus"],
        where: { locale, article: where },
        _count: { _all: true },
      }),
    ]);
    return toCoverage(
      total,
      groups.map((g) => ({ status: g.translationStatus, count: g._count._all })),
    );
  },

  async estimate(locales, defaultLocale) {
    const totals = new Map(locales.map((locale) => [locale, 0]));
    if (locales.length === 0) return totals;
    let after: string | null = null;
    for (;;) {
      const rows: ArticleSourceRow[] = await db.articleTranslation.findMany({
        where: {
          locale: defaultLocale,
          article: { deletedAt: null },
          ...(after ? { articleId: { gt: after } } : {}),
        },
        orderBy: { articleId: "asc" },
        take: ESTIMATE_PAGE,
        select: {
          id: true,
          articleId: true,
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
      if (rows.length === 0) break;
      after = rows[rows.length - 1]!.articleId;

      const targets = await db.articleTranslation.findMany({
        where: { articleId: { in: rows.map((r) => r.articleId) }, locale: { in: [...locales] } },
        select: { articleId: true, locale: true, translationStatus: true, sourceHash: true },
      });
      const targetOf = new Map(targets.map((t) => [`${t.articleId}:${t.locale}`, t]));

      for (const row of rows) {
        const source: ArticleSource = {
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
        const characters = articleSourceCharacters(source);
        const hash = hashArticleSource(source);
        for (const locale of locales) {
          const target = targetOf.get(`${row.articleId}:${locale}`);
          // The job writes only an absent row or a stale machine one (ADR-161 #2).
          const wouldTranslate =
            !target ||
            (target.translationStatus === TranslationStatus.MACHINE_TRANSLATED &&
              target.sourceHash !== hash);
          if (wouldTranslate) totals.set(locale, (totals.get(locale) ?? 0) + characters);
        }
      }
      if (rows.length < ESTIMATE_PAGE) break;
    }
    return totals;
  },

  async review({ locale, defaultLocale, take }) {
    const rows = await db.articleTranslation.findMany({
      where: {
        translationStatus: {
          in: [
            TranslationStatus.MACHINE_TRANSLATED,
            TranslationStatus.OUTDATED,
            TranslationStatus.NEEDS_REVIEW,
          ],
        },
        locale: locale ?? { not: defaultLocale },
        article: { deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        articleId: true,
        locale: true,
        title: true,
        translationStatus: true,
        updatedAt: true,
        article: {
          select: { translations: { where: { locale: defaultLocale }, select: { title: true } } },
        },
      },
    });
    return rows.map((row) => ({
      entityType: "article",
      entityId: row.articleId,
      locale: row.locale,
      status: row.translationStatus as ReviewStatus,
      title: row.title,
      sourceTitle: row.article.translations[0]?.title ?? null,
      updatedAt: row.updatedAt,
    }));
  },
};

/** Every machine-translatable type, in backfill order. */
export const TRANSLATABLE_TYPES: readonly TranslatableType[] = [
  // The site's own chrome first (ADR-165): six rows, on every page.
  settingTranslatable,
  articleType,
  // Promotions next (changes-52 P6): short-lived, so a new language's
  // backfill reaches them while they are still running.
  promotionTranslatable,
  glossaryTopicTranslatable,
  glossaryTermTranslatable,
  courseTranslatable,
  sectionTranslatable,
  lessonTranslatable,
  videoCategoryTranslatable,
  videoTopicTranslatable,
  toolTranslatable,
  articleCategoryTranslatable,
  articleTagTranslatable,
  menuItemTranslatable,
  // Quizzes last (plan §6 Phase 5), behind `quiz-source.test.ts`.
  quizTranslatable,
  quizQuestionTranslatable,
];
