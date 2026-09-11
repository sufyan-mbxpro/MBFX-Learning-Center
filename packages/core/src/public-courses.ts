// Public-surface learn reads (Module 12, ADR-055 + ADR-056).
//
// Two rules govern every function in this file, and both are structural
// rather than conventional:
//
//   1. NO SESSION IS READ HERE. Ever. These loaders run inside `"use cache"`
//      pages, so a session read would uncache the entire learning area
//      (architecture.md #6) and could serialize learner data into a shared RSC
//      payload (security.md #12). Progress arrives client-side through
//      /api/learn/progress instead — ADR-056 #1. If you find yourself wanting
//      `auth()` in this file, the feature belongs in the island.
//
//   2. Visibility is enforced in the Prisma `where`, not in a filter after the
//      fact — drafts and gated content structurally cannot leak.
import { cacheLife, cacheTag } from "next/cache";
import { FeatureVisibility, db, type Difficulty } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { LEARN_TRACK_KEYS, type LearnTrackKey } from "@repo/contracts";
import { COURSE, RECOMMENDED, loadRelationTargets } from "./content-relations.ts";
import { scheduledVisibilityOr } from "./content.ts";

interface LocaleContext {
  locales: LocaleFallbackInfo[];
  defaultLocale: string;
}

async function localeContext(): Promise<LocaleContext> {
  const locales = await db.locale.findMany({
    select: { code: true, fallbackCode: true, isDefault: true },
  });
  return {
    locales: locales.map((l) => ({ code: l.code, fallbackCode: l.fallbackCode })),
    defaultLocale: locales.find((l) => l.isDefault)?.code ?? "en",
  };
}

/**
 * The public visibility rule for courses, as one expression.
 *
 * `visibility: PUBLIC` only — and that is deliberate, not an oversight.
 * ADR-012 makes `PREMIUM` staff-only until an entitlement model exists, and
 * deciding "is this viewer staff" requires a session, which rule 1 above
 * forbids in a cached loader. Serving AUTHENTICATED or PREMIUM rows from a
 * cached page would put gated content in a payload shared with anonymous
 * visitors. So gated courses are absent from the public learn area entirely,
 * which is the conservative direction ADR-012 explicitly chose: a missing
 * model is not consent to grant the broader tier.
 *
 * Surfacing gated content to entitled learners needs its own dynamic path and
 * is not part of this programme.
 */
export function publicCourseWhere(now: Date = new Date()) {
  return {
    deletedAt: null,
    // ADR-071 — PUBLISHED, or SCHEDULED and due. Not a bare status equality
    // since courses gained a schedule.
    OR: scheduledVisibilityOr(now),
    visibility: FeatureVisibility.PUBLIC,
  };
}

/** Same rule, one level down. A gated lesson is invisible even in a public course. */
export function publicLessonWhere(now: Date = new Date()) {
  return {
    deletedAt: null,
    OR: scheduledVisibilityOr(now),
    visibility: FeatureVisibility.PUBLIC,
  };
}

// ─── View types ──────────────────────────────────────────────

export interface LessonCardView {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  estimatedMinutes: number | null;
  isRequired: boolean;
  hasVideo: boolean;
  hasExternal: boolean;
  externalUrl: string | null;
}

export interface SectionView {
  id: string;
  title: string;
  description: string | null;
  lessons: LessonCardView[];
}

export interface CourseCardView {
  id: string;
  track: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: Difficulty;
  estimatedHours: number | null;
  lessonCount: number;
  coverAssetId: string | null;
  /**
   * Resolved from `coverAssetId` inside the cached loader. ADR-055 #6 dropped
   * the `*ImageUrl` columns, so the URL is a property of the asset — and
   * `syncReferences` makes a media write on a COURSE reference invalidate the
   * `content` tag, which is the tag this loader carries. A replace-in-place
   * therefore re-renders the page rather than leaving a stale copy behind.
   */
  coverUrl: string | null;
  externalUrl: string | null;
  /** Titles and slugs only — see `getLearnIndex`. */
  sections: SectionView[];
}

export interface TrackGroup {
  track: LearnTrackKey;
  courses: CourseCardView[];
}

/**
 * One locale this content is published in, and its slug there. Feeds the
 * hreflang pairs (plan §11) — the shape `ArticleView.alternates` already uses,
 * so the two detail pages build `alternates.languages` identically.
 */
export interface LocaleAlternate {
  locale: string;
  slug: string;
}

export interface CourseView extends CourseCardView {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  alternates: LocaleAlternate[];
}

export interface LessonAttachmentView {
  assetId: string;
  label: string | null;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface LessonView {
  id: string;
  courseId: string;
  /** The course's track: the lesson URL's first segment (ADR-065 §1). */
  courseTrack: string;
  courseSlug: string;
  courseTitle: string;
  sectionId: string;
  sectionTitle: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  learningObjectives: string[];
  estimatedMinutes: number | null;
  videoUrl: string | null;
  externalUrl: string | null;
  heroAssetId: string | null;
  heroUrl: string | null;
  completionRule: string;
  isRequired: boolean;
  /**
   * Resolved here rather than in the page: a download needs a URL, a name and
   * a size to render honestly, and the page is cached so it cannot go looking
   * them up itself. An attachment whose asset has been hard-deleted is DROPPED
   * — a broken download link is worse than a missing one.
   */
  attachments: LessonAttachmentView[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  /** Lesson slugs per locale. The COURSE slug also varies by locale, so the
   * page pairs these with the course alternates when it builds hreflang. */
  alternates: LocaleAlternate[];
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

// ─── Media resolution ────────────────────────────────────────

/**
 * Asset id → public URL, for the whole page in ONE query.
 *
 * Resolving per card would be N+1 on a shelf of courses, and resolving in the
 * page is not available: these loaders are `"use cache"`, so the page renders
 * from what they return. Soft-deleted assets are excluded, so an id whose
 * asset has been removed resolves to `null` and the caller renders the
 * no-artwork state rather than a broken image.
 */
async function resolveAssetUrls(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: unique }, deletedAt: null },
    select: { id: true, url: true },
  });
  return new Map(rows.map((row) => [row.id, row.url]));
}

// ─── Learn index ─────────────────────────────────────────────

/**
 * The `/learn` shelf, grouped by track.
 *
 * Carries section and lesson TITLES AND SLUGS so a course card can expand its
 * curriculum client-side without a request (ADR-055 #11) — and carries no
 * lesson bodies, which is asserted by a test rather than left to reviewer
 * vigilance. The payload is bounded by the curriculum's size, not the
 * content's.
 *
 * A track with no published courses is OMITTED, not returned empty. The page
 * renders whatever this returns, so an empty band is impossible by
 * construction rather than by the template remembering to check (ADR-055 #2).
 */
export async function loadLearnIndex(locale: string): Promise<TrackGroup[]> {
  const { locales, defaultLocale } = await localeContext();

  const courses = await db.course.findMany({
    where: publicCourseWhere(),
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      track: true,
      difficulty: true,
      estimatedHours: true,
      lessonCount: true,
      coverAssetId: true,
      externalUrl: true,
      translations: {
        select: { locale: true, title: true, slug: true, summary: true },
      },
      sections: {
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          translations: { select: { locale: true, title: true, description: true } },
          lessons: {
            where: publicLessonWhere(),
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              estimatedMinutes: true,
              isRequired: true,
              videoUrl: true,
              externalUrl: true,
              translations: {
                select: { locale: true, title: true, slug: true, summary: true },
              },
            },
          },
        },
      },
    },
  });

  const coverUrls = await resolveAssetUrls(courses.map((c) => c.coverAssetId));

  const cards: CourseCardView[] = [];
  for (const course of courses) {
    const t = pickTranslation(course.translations, locale, defaultLocale, locales);
    if (!t) continue; // untranslated in every locale of the chain: not renderable

    cards.push({
      id: course.id,
      track: course.track,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      difficulty: course.difficulty,
      estimatedHours: course.estimatedHours,
      lessonCount: course.lessonCount,
      coverAssetId: course.coverAssetId,
      coverUrl: course.coverAssetId ? (coverUrls.get(course.coverAssetId) ?? null) : null,
      externalUrl: course.externalUrl,
      sections: buildSections(course.sections, locale, defaultLocale, locales),
    });
  }

  return LEARN_TRACK_KEYS.map((track) => ({
    track,
    courses: cards.filter((c) => c.track === track),
  })).filter((group) => group.courses.length > 0);
}

type SectionRow = {
  id: string;
  translations: { locale: string; title: string; description: string | null }[];
  lessons: {
    id: string;
    estimatedMinutes: number | null;
    isRequired: boolean;
    videoUrl: string | null;
    externalUrl: string | null;
    translations: { locale: string; title: string; slug: string; summary: string | null }[];
  }[];
};

function buildSections(
  sections: SectionRow[],
  locale: string,
  defaultLocale: string,
  locales: LocaleFallbackInfo[],
): SectionView[] {
  return (
    sections
      .map((section) => {
        const st = pickTranslation(section.translations, locale, defaultLocale, locales);
        const lessons: LessonCardView[] = [];
        for (const lesson of section.lessons) {
          const lt = pickTranslation(lesson.translations, locale, defaultLocale, locales);
          if (!lt) continue;
          lessons.push({
            id: lesson.id,
            slug: lt.slug,
            title: lt.title,
            summary: lt.summary,
            estimatedMinutes: lesson.estimatedMinutes,
            isRequired: lesson.isRequired,
            hasVideo: lesson.videoUrl !== null,
            hasExternal: lesson.externalUrl !== null,
            externalUrl: lesson.externalUrl,
          });
        }
        return {
          id: section.id,
          title: st?.title ?? "",
          description: st?.description ?? null,
          lessons,
        };
      })
      // An empty section is a grouping with nothing in it — same reasoning as
      // the empty track band, one level down.
      .filter((section) => section.lessons.length > 0)
  );
}

export async function getLearnIndex(locale: string): Promise<TrackGroup[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadLearnIndex(locale);
}

// ─── Course detail ───────────────────────────────────────────

export async function loadCourseBySlug(locale: string, slug: string): Promise<CourseView | null> {
  const { locales, defaultLocale } = await localeContext();

  // Resolve by the slug in ANY locale, then re-pick the translation for the
  // requested one: a reader arriving on the English slug of a course they will
  // read in Spanish still gets the Spanish body, and the canonical/hreflang
  // helpers get the right pair.
  const match = await db.courseTranslation.findFirst({
    where: { slug, course: publicCourseWhere() },
    select: { courseId: true },
  });
  if (!match) return null;

  const course = await db.course.findFirst({
    where: { id: match.courseId, ...publicCourseWhere() },
    select: {
      id: true,
      track: true,
      difficulty: true,
      estimatedHours: true,
      lessonCount: true,
      coverAssetId: true,
      externalUrl: true,
      updatedAt: true,
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          summary: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      sections: {
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          translations: { select: { locale: true, title: true, description: true } },
          lessons: {
            where: publicLessonWhere(),
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              estimatedMinutes: true,
              isRequired: true,
              videoUrl: true,
              externalUrl: true,
              translations: {
                select: { locale: true, title: true, slug: true, summary: true },
              },
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  const t = pickTranslation(course.translations, locale, defaultLocale, locales);
  if (!t) return null;

  const coverUrls = await resolveAssetUrls([course.coverAssetId]);

  return {
    id: course.id,
    track: course.track,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    description: t.description,
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    difficulty: course.difficulty,
    estimatedHours: course.estimatedHours,
    lessonCount: course.lessonCount,
    coverAssetId: course.coverAssetId,
    coverUrl: course.coverAssetId ? (coverUrls.get(course.coverAssetId) ?? null) : null,
    externalUrl: course.externalUrl,
    updatedAt: course.updatedAt,
    // Every locale this course actually HAS a translation in — not every
    // active locale. An hreflang pointing at a URL that 404s is worse than a
    // missing pair.
    alternates: course.translations.map((tr) => ({ locale: tr.locale, slug: tr.slug })),
    sections: buildSections(course.sections, locale, defaultLocale, locales),
  };
}

export async function getCourseBySlug(locale: string, slug: string): Promise<CourseView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadCourseBySlug(locale, slug);
}

// ─── Lesson detail ───────────────────────────────────────────

export async function loadLessonBySlug(
  locale: string,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonView | null> {
  const { locales, defaultLocale } = await localeContext();

  const match = await db.lessonTranslation.findFirst({
    where: {
      slug: lessonSlug,
      lesson: {
        ...publicLessonWhere(),
        section: {
          isPublished: true,
          course: { ...publicCourseWhere(), translations: { some: { slug: courseSlug } } },
        },
      },
    },
    select: { lessonId: true },
  });
  if (!match) return null;

  const lesson = await db.lesson.findFirst({
    where: { id: match.lessonId, ...publicLessonWhere() },
    select: {
      id: true,
      sectionId: true,
      estimatedMinutes: true,
      videoUrl: true,
      externalUrl: true,
      heroAssetId: true,
      completionRule: true,
      isRequired: true,
      updatedAt: true,
      attachments: {
        orderBy: { sortOrder: "asc" },
        select: { assetId: true, label: true },
      },
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          summary: true,
          content: true,
          learningObjectives: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      section: {
        select: {
          courseId: true,
          translations: { select: { locale: true, title: true } },
          course: {
            select: {
              track: true,
              translations: { select: { locale: true, title: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!lesson) return null;

  const t = pickTranslation(lesson.translations, locale, defaultLocale, locales);
  if (!t) return null;

  const courseT = pickTranslation(
    lesson.section.course.translations,
    locale,
    defaultLocale,
    locales,
  );
  const sectionT = pickTranslation(lesson.section.translations, locale, defaultLocale, locales);

  // Hero and every attachment in ONE query, and attachments carry their name
  // and size because a download link that says neither is not a download link.
  const assets = await db.mediaAsset.findMany({
    where: {
      id: {
        in: [
          ...lesson.attachments.map((a) => a.assetId),
          ...(lesson.heroAssetId ? [lesson.heroAssetId] : []),
        ],
      },
      deletedAt: null,
    },
    select: { id: true, url: true, fileName: true, mimeType: true, size: true },
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const { previous, next } = await siblingLessons(
    lesson.section.courseId,
    lesson.id,
    locale,
    defaultLocale,
    locales,
  );

  return {
    id: lesson.id,
    courseId: lesson.section.courseId,
    courseTrack: lesson.section.course.track,
    courseSlug: courseT?.slug ?? courseSlug,
    courseTitle: courseT?.title ?? "",
    sectionId: lesson.sectionId,
    sectionTitle: sectionT?.title ?? "",
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    content: t.content,
    learningObjectives: Array.isArray(t.learningObjectives)
      ? (t.learningObjectives as unknown[]).filter((o): o is string => typeof o === "string")
      : [],
    estimatedMinutes: lesson.estimatedMinutes,
    videoUrl: lesson.videoUrl,
    externalUrl: lesson.externalUrl,
    heroAssetId: lesson.heroAssetId,
    heroUrl: lesson.heroAssetId ? (assetById.get(lesson.heroAssetId)?.url ?? null) : null,
    completionRule: lesson.completionRule,
    isRequired: lesson.isRequired,
    // An attachment whose asset is gone is dropped rather than rendered as a
    // dead link. `deleteMedia()` refuses an asset that is in use, so this only
    // happens to a row that outlived its asset.
    attachments: lesson.attachments.flatMap((attachment) => {
      const asset = assetById.get(attachment.assetId);
      if (!asset) return [];
      return [
        {
          assetId: attachment.assetId,
          label: attachment.label,
          fileName: asset.fileName,
          url: asset.url,
          mimeType: asset.mimeType,
          size: asset.size,
        },
      ];
    }),
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    updatedAt: lesson.updatedAt,
    alternates: lesson.translations.map((tr) => ({ locale: tr.locale, slug: tr.slug })),
    previous,
    next,
  };
}

/**
 * Previous/next across the WHOLE course, in curriculum order — a learner
 * reaching the end of a section continues into the next one rather than
 * hitting a dead end. Section order then lesson order, flattened.
 *
 * This reads titles and slugs for one course's lessons, not their bodies:
 * `architecture.md`-adjacent performance note from the plan — never load the
 * whole course tree on a lesson page.
 */
async function siblingLessons(
  courseId: string,
  lessonId: string,
  locale: string,
  defaultLocale: string,
  locales: LocaleFallbackInfo[],
): Promise<{
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}> {
  const rows = await db.lesson.findMany({
    where: { ...publicLessonWhere(), section: { isPublished: true, courseId } },
    orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      translations: { select: { locale: true, title: true, slug: true } },
    },
  });

  const flat = rows
    .map((row) => {
      const t = pickTranslation(row.translations, locale, defaultLocale, locales);
      return t ? { id: row.id, slug: t.slug, title: t.title } : null;
    })
    .filter((row): row is { id: string; slug: string; title: string } => row !== null);

  const index = flat.findIndex((row) => row.id === lessonId);
  if (index === -1) return { previous: null, next: null };

  const previous = index > 0 ? flat[index - 1]! : null;
  const next = index < flat.length - 1 ? flat[index + 1]! : null;
  return {
    previous: previous ? { slug: previous.slug, title: previous.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  };
}

export async function getLessonBySlug(
  locale: string,
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadLessonBySlug(locale, courseSlug, lessonSlug);
}

// ─── Recommendations (ADR-055 — ContentRelation reuse) ───────

/**
 * Admin-selected recommendations first, in their stored order, then topped up
 * with other published courses from the same track.
 *
 * The top-up is the design, not a fallback bolted on: the block is part of the
 * course page's layout, so it has to fill or the page opens on a hole. An
 * editor who picks three gets exactly those three, in order; one who picks
 * none gets same-track suggestions, which is what a learner expects anyway.
 *
 * Pure ordering over two queries — no algorithm, no behavioural model. That is
 * the whole of Phase 1 recommendations.
 */
async function loadRecommendations(
  locale: string,
  courseId: string,
  track: string,
  limit: number,
): Promise<CourseCardView[]> {
  const { locales, defaultLocale } = await localeContext();

  const explicitIds = await loadRelationTargets({
    sourceType: COURSE,
    sourceId: courseId,
    targetType: COURSE,
    relationType: RECOMMENDED,
  });

  const explicit = await db.course.findMany({
    where: { id: { in: explicitIds }, ...publicCourseWhere() },
    select: recommendationSelect,
  });
  // Restore the editor's order: `findMany` does not preserve `in` order, and a
  // curated list whose order is ignored is not a curated list.
  const byId = new Map(explicit.map((c) => [c.id, c]));
  const ordered = explicitIds.map((id) => byId.get(id)).filter((c) => c !== undefined);

  const shortfall = limit - ordered.length;
  if (shortfall > 0) {
    const exclude = [courseId, ...ordered.map((c) => c.id)];
    const fill = await db.course.findMany({
      where: { track, id: { notIn: exclude }, ...publicCourseWhere() },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      take: shortfall,
      select: recommendationSelect,
    });
    ordered.push(...fill);
  }

  const shown = ordered.slice(0, limit);
  const coverUrls = await resolveAssetUrls(shown.map((c) => c.coverAssetId));

  const cards: CourseCardView[] = [];
  for (const course of shown) {
    const t = pickTranslation(course.translations, locale, defaultLocale, locales);
    if (!t) continue;
    cards.push({
      id: course.id,
      track: course.track,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      difficulty: course.difficulty,
      estimatedHours: course.estimatedHours,
      lessonCount: course.lessonCount,
      coverAssetId: course.coverAssetId,
      coverUrl: course.coverAssetId ? (coverUrls.get(course.coverAssetId) ?? null) : null,
      externalUrl: course.externalUrl,
      sections: [],
    });
  }
  return cards;
}

/**
 * The cached wrapper, added 2026-09-09 — every other public loader in this
 * file already had one and this was the only reader that did not.
 *
 * **What it fixes.** Uncached, this was the one un-prerenderable read on
 * `/[locale]/learn/[course]`: Prisma reaches for `Date.now()` while timing a
 * query, Cache Components rejects an unstable value during prerender, and the
 * whole course route quietly fell out of ISR into per-request rendering
 * (architecture.md #6 and #11). The page still answered 200, which is why it
 * went unnoticed — the cost was a database round trip on every view of every
 * course page, not an error anyone saw. Found while building the course
 * page's right rail; confirmed by stubbing this call out and watching the
 * prerender error stop, then return when it was restored.
 *
 * `content` and 300s to match `getLearnIndex` / `getCourseBySlug` /
 * `getLessonBySlug` exactly: a recommendation IS content, an editor's publish
 * already invalidates that tag, and a block that outlived its neighbours
 * would recommend courses the shelf beside it had stopped listing.
 */
export async function resolveRecommendations(
  locale: string,
  courseId: string,
  track: string,
  limit = 3,
): Promise<CourseCardView[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadRecommendations(locale, courseId, track, limit);
}

const recommendationSelect = {
  id: true,
  track: true,
  difficulty: true,
  estimatedHours: true,
  lessonCount: true,
  coverAssetId: true,
  externalUrl: true,
  translations: { select: { locale: true, title: true, slug: true, summary: true } },
} as const;

// ─── Sitemap ─────────────────────────────────────────────────

export interface LearnSitemapEntry {
  path: string;
  locale: string;
  updatedAt: Date;
}

/**
 * Published, PUBLIC-visibility learn URLs only. Draft, scheduled,
 * AUTHENTICATED and PREMIUM content is absent rather than `noindex` — an
 * unpublished route 404s, and a sitemap entry for a 404 is worse than no
 * entry (plan §11).
 */
export async function loadLearnSitemapEntries(): Promise<LearnSitemapEntry[]> {
  const courses = await db.courseTranslation.findMany({
    where: { course: publicCourseWhere() },
    select: {
      locale: true,
      slug: true,
      updatedAt: true,
      courseId: true,
      course: { select: { track: true } },
    },
  });

  const entries: LearnSitemapEntry[] = courses.map((c) => ({
    path: `/learn/${c.course.track}/${c.slug}`,
    locale: c.locale,
    updatedAt: c.updatedAt,
  }));

  // Track AND slug: both are segments of the lesson URL, and a lesson whose
  // course is untranslated in its locale has neither.
  const courseAddressByKey = new Map(
    courses.map((c) => [`${c.courseId}:${c.locale}`, { track: c.course.track, slug: c.slug }]),
  );

  const lessons = await db.lessonTranslation.findMany({
    where: {
      lesson: {
        ...publicLessonWhere(),
        section: { isPublished: true, course: publicCourseWhere() },
      },
    },
    select: {
      locale: true,
      slug: true,
      updatedAt: true,
      lesson: { select: { section: { select: { courseId: true } } } },
    },
  });

  for (const lesson of lessons) {
    const course = courseAddressByKey.get(`${lesson.lesson.section.courseId}:${lesson.locale}`);
    // A lesson translated into a locale its course is not translated into has
    // no constructible URL. Skipped rather than guessed — emitting a path with
    // a missing segment would put a 404 in the sitemap.
    if (!course) continue;
    entries.push({
      path: `/learn/${course.track}/${course.slug}/${lesson.slug}`,
      locale: lesson.locale,
      updatedAt: lesson.updatedAt,
    });
  }

  return entries;
}
