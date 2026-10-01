// What an announcement is ABOUT (ADR-171, changes-54 §7, §8.1): the course,
// whether it can be announced right now, and the words and links each
// recipient's email carries.
//
// "Can a reader open it" is the course module's own rule, `publicCourseWhere`,
// composed rather than copied — an announcement with its own idea of public is
// a way to mail a link to a 404. A SCHEDULED course is announceable too, and
// waits (owner, D5): nothing is sent until the same rule says it is live.
import { htmlLead, siteOrigin } from "@repo/utils";
import { catalogMessage } from "@repo/i18n";
import { ContentStatus, FeatureVisibility, db, type TranslationStatus } from "@repo/db";
import { coursePath } from "./content.ts";
import { publicCourseWhere } from "./public-courses.ts";
import { isIndexableTranslation } from "./reading-languages.ts";

export type TargetAvailability = "live" | "scheduled" | "unavailable";

export interface CourseTargetTranslation {
  locale: string;
  title: string;
  slug: string;
  summary: string | null;
  translationStatus: TranslationStatus;
}

export interface CourseTarget {
  id: string;
  track: string;
  difficulty: string;
  lessonCount: number;
  coverUrl: string | null;
  scheduledFor: Date | null;
  availability: TargetAvailability;
  translations: CourseTargetTranslation[];
}

export interface Locales {
  defaultLocale: string;
  active: string[];
}

export async function loadLocales(): Promise<Locales> {
  const rows = await db.locale.findMany({
    where: { isActive: true },
    select: { code: true, isDefault: true },
    orderBy: { sortOrder: "asc" },
  });
  return {
    defaultLocale: rows.find((row) => row.isDefault)?.code ?? "en",
    active: rows.map((row) => row.code),
  };
}

/**
 * SCHEDULED for the future, and otherwise exactly what `publicCourseWhere`
 * would show once the date arrives. The date is the only thing missing.
 */
function scheduledCourseWhere(now: Date) {
  return {
    deletedAt: null,
    isActive: true,
    visibility: FeatureVisibility.PUBLIC,
    status: ContentStatus.SCHEDULED,
    scheduledFor: { gt: now },
  };
}

export async function courseAvailability(id: string, now: Date): Promise<TargetAvailability> {
  if ((await db.course.count({ where: { id, ...publicCourseWhere(now) } })) > 0) return "live";
  if ((await db.course.count({ where: { id, ...scheduledCourseWhere(now) } })) > 0) {
    return "scheduled";
  }
  return "unavailable";
}

export async function loadCourseTarget(id: string, now: Date): Promise<CourseTarget | null> {
  const row = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      track: true,
      difficulty: true,
      lessonCount: true,
      coverAssetId: true,
      scheduledFor: true,
      deletedAt: true,
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          summary: true,
          translationStatus: true,
        },
      },
    },
  });
  if (!row || row.deletedAt) return null;
  const cover = row.coverAssetId
    ? await db.mediaAsset.findUnique({ where: { id: row.coverAssetId }, select: { url: true } })
    : null;
  return {
    id: row.id,
    track: row.track,
    difficulty: row.difficulty,
    lessonCount: row.lessonCount,
    coverUrl: cover?.url ?? null,
    scheduledFor: row.scheduledFor,
    availability: await courseAvailability(row.id, now),
    translations: row.translations,
  };
}

/**
 * The words a recipient in `locale` gets: that language's translation when
 * the locale is ACTIVE and the translation is one a person stands behind
 * (`isIndexableTranslation` — never raw machine output), else the default
 * language's. The LINK uses the locale the words came from, so the email and
 * the page it opens agree (plan §7).
 */
export function pickCourseWords(
  target: CourseTarget,
  locale: string,
  locales: Locales,
): CourseTargetTranslation | null {
  const fallback = target.translations.find((row) => row.locale === locales.defaultLocale) ?? null;
  if (locale === locales.defaultLocale || !locales.active.includes(locale)) return fallback;
  const own = target.translations.find((row) => row.locale === locale);
  return own && isIndexableTranslation(own, locales.defaultLocale) ? own : fallback;
}

/** Absolute, because a message has no page for a relative path to resolve against. */
function absolute(url: string, origin: string): string {
  return /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * The raster panel for a coverless course. The web cover is an SVG and Gmail
 * and Outlook do not render one (`scripts/generate-email-covers.mjs`).
 */
export function emailTrackCover(track: string, origin: string): string {
  const known = track === "crypto" ? "crypto" : "forex";
  return `${origin}/email/track-${known}.png`;
}

export interface CourseEmailWords {
  /** The locale the words (and so the link) are in. */
  locale: string;
  variables: Record<string, string>;
}

/**
 * The `announcement.course` variables for one language, apart from
 * `unsubscribe.url`, which is per recipient. Null when the course has no
 * words at all (it cannot happen for a saved course; the caller fails the
 * recipient rather than sending an empty card).
 */
export async function courseEmailWords(
  target: CourseTarget,
  locale: string,
  locales: Locales,
  message: string | null,
): Promise<CourseEmailWords | null> {
  const words = pickCourseWords(target, locale, locales);
  if (!words) return null;
  const origin = siteOrigin().replace(/\/+$/, "");
  const level =
    (await catalogMessage(words.locale, `learn.difficulty.${target.difficulty}`)) ??
    target.difficulty;
  return {
    locale: words.locale,
    variables: {
      "course.title": words.title,
      "course.summary": words.summary ? htmlLead(words.summary, 300) : "",
      "course.level": level,
      "course.lessonCount": String(target.lessonCount),
      "course.url": `${origin}${coursePath(words.locale, locales.defaultLocale, target.track, words.slug)}`,
      "course.coverUrl": target.coverUrl
        ? absolute(target.coverUrl, origin)
        : emailTrackCover(target.track, origin),
      "campaign.message": message ?? "",
    },
  };
}
