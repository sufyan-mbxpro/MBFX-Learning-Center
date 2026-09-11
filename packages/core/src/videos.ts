// Videos — the fourth learn section (changes-16 PR 3, ADR-068).
//
// A video topic is a PAGE whose subject is a video. It is not a Lesson, it
// belongs to no Course, and nothing about it is graded. That sentence decides
// the shape of this file: there is no progress, no completion, no attempt and
// no enrollment anywhere in it, and there is no reason for any to appear later.
//
// Three rules govern the reads, and all three are inherited rather than
// invented here:
//
//   1. **No session is read in this file.** The public loaders run inside
//      `"use cache"` pages (ADR-056 #1), so a session read would uncache the
//      whole learn area and could serialize per-viewer data into a shared RSC
//      payload (security.md #12). `public-courses.ts` states the same rule.
//   2. **Visibility is enforced in the Prisma `where`,** never by filtering
//      after the fact — a draft or gated row structurally cannot leak.
//   3. **A topic loaded under the wrong track returns null,** the rule ADR-065
//      set for courses: the track is part of the address, so one row must not
//      answer at two URLs.
//
// The one rule specific to videos: **a raw URL never reaches a `src`.** The
// service resolves every video row into a `VideoSourceView` — an `/uploads/…`
// path for an upload, or an embed URL that `parseVideoUrl` derived for an
// external one — and a row whose URL no provider recognises is DROPPED rather
// than passed through (security.md #9, ADR-015 #9).
import { revalidateTag } from "next/cache";
import { cacheLife, cacheTag } from "next/cache";
import {
  type ContentStatus,
  FeatureVisibility,
  TranslationStatus,
  db,
  type Prisma,
} from "@repo/db";
import { computeSourceHash, pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import type { Subject } from "@repo/rbac";
import type {
  CreateVideoTopicInput,
  LearnTrackKey,
  ReorderVideoCategoriesInput,
  VideoCategoryInput,
  VideoCategoryView,
  VideoSourceView,
  VideoTopicCardView,
  VideoTopicInput,
  VideoTopicLinkView,
  VideoTopicView,
} from "@repo/contracts";
import { isLearnTrack } from "@repo/contracts";
import { parseVideoUrl } from "@repo/utils";
import { syncReferences } from "./cms/references.ts";
import {
  CONTENT_TRANSITIONS,
  createSlugRedirect,
  sanitizeRichText,
  scheduledVisibilityOr,
  slugify,
  videoCategoryPath,
  videoTopicPath,
} from "./content.ts";
import { recordAudit } from "./index.ts";

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
 * `VideoTopic.track` is a plain column validated by @repo/contracts, not by a
 * FK (ADR-065 §3), so a READ has to narrow it. A row naming an unregistered
 * track is DROPPED from public output rather than rendered — its URL segment
 * does not exist, so neither does its page. Same call `quizzes.ts` makes.
 */
function trackKeyOf(value: string): LearnTrackKey | null {
  return isLearnTrack(value) ? value : null;
}

// ─── Public visibility (rule 2) ──────────────────────────────

/**
 * The public rule for video topics, as one expression.
 *
 * `PUBLIC` only, for the reason `publicCourseWhere` records at length: ADR-012
 * leaves `PREMIUM` staff-only until an entitlement model exists, deciding "is
 * this viewer entitled" needs a session, and rule 1 forbids one here. A gated
 * topic is therefore absent from the public section entirely — the
 * conservative direction, and the one ADR-012 chose.
 */
export function publicVideoWhere(now: Date = new Date()) {
  return {
    deletedAt: null,
    OR: scheduledVisibilityOr(now),
    visibility: FeatureVisibility.PUBLIC,
  };
}

// ─── Source resolution (the rule specific to videos) ─────────

interface VideoRow {
  assetId: string | null;
  externalUrl: string | null;
  posterAssetId: string | null;
  title: string | null;
}

/**
 * One stored video row → the resolved view a page can render, or `null`.
 *
 * `null` is returned for a row this service cannot make safe: an external URL
 * no provider recognises, or an upload whose asset has been deleted. The
 * caller drops it. Rendering "something" for an unrecognised URL is how a raw
 * attacker-controlled string reaches an `src`, and there is no useful middle
 * state — a player with no source is worse than a page with one fewer video.
 */
function resolveVideoSource(row: VideoRow, assetUrls: Map<string, string>): VideoSourceView | null {
  if (row.assetId) {
    const src = assetUrls.get(row.assetId);
    if (!src) return null; // asset deleted since the placement was written
    return {
      kind: "upload",
      src,
      posterUrl: row.posterAssetId ? (assetUrls.get(row.posterAssetId) ?? null) : null,
      title: row.title,
    };
  }
  if (!row.externalUrl) return null; // neither branch set — contracts refuse it, data may predate them
  const parsed = parseVideoUrl(row.externalUrl);
  if (!parsed) return null;
  return {
    kind: "embed",
    embedUrl: parsed.embedUrl,
    thumbnailUrl: parsed.thumbnailUrl,
    title: row.title,
  };
}

/**
 * Which link branch was stored decides `isExternal` AT RENDER TIME.
 *
 * There is no stored flag by design (ADR-068 §5): a copy of a fact already
 * expressed by the data goes stale the first time a link is edited. A row with
 * neither branch set is dropped — the same posture as an unresolvable video.
 */
function resolveLink(row: {
  label: string;
  path: string | null;
  url: string | null;
}): VideoTopicLinkView | null {
  if (row.path) return { label: row.label, href: row.path, isExternal: false };
  if (row.url) return { label: row.label, href: row.url, isExternal: true };
  return null;
}

/**
 * Batch-resolve asset ids to URLs. Resolving per row would be N+1 on a shelf,
 * and resolving in the page is not available: these loaders are `"use cache"`,
 * so the page renders from what they return. Soft-deleted assets are excluded,
 * so a removed asset resolves to `null` and the caller renders without it.
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

// ─── Admin reads ─────────────────────────────────────────────

export interface VideoTopicAdminRow {
  id: string;
  title: string;
  slug: string;
  track: string;
  categoryId: string | null;
  categoryName: string | null;
  status: ContentStatus;
  visibility: FeatureVisibility;
  videoCount: number;
  linkCount: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

export async function listVideoTopicsAdmin(filter?: {
  track?: string;
  categoryId?: string;
  status?: ContentStatus;
  search?: string;
  includeDeleted?: boolean;
}): Promise<VideoTopicAdminRow[]> {
  const { defaultLocale } = await localeContext();

  const rows = await db.videoTopic.findMany({
    where: {
      ...(filter?.includeDeleted ? {} : { deletedAt: null }),
      ...(filter?.track ? { track: filter.track } : {}),
      ...(filter?.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.search ? { translations: { some: { title: { contains: filter.search } } } } : {}),
    },
    select: {
      id: true,
      track: true,
      categoryId: true,
      status: true,
      visibility: true,
      updatedAt: true,
      deletedAt: true,
      translations: { select: { locale: true, title: true, slug: true } },
      category: { select: { translations: { select: { locale: true, name: true } } } },
      _count: { select: { videos: true, links: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  return rows.map((row) => {
    const t =
      row.translations.find((x) => x.locale === defaultLocale) ?? row.translations[0] ?? null;
    const c =
      row.category?.translations.find((x) => x.locale === defaultLocale) ??
      row.category?.translations[0] ??
      null;
    return {
      id: row.id,
      title: t?.title ?? "",
      slug: t?.slug ?? "",
      track: row.track,
      categoryId: row.categoryId,
      categoryName: c?.name ?? null,
      status: row.status,
      visibility: row.visibility,
      videoCount: row._count.videos,
      linkCount: row._count.links,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  });
}

export interface VideoTopicAdminTranslationRow {
  locale: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoFocusKeyword: string | null;
  translationStatus: TranslationStatus;
  updatedAt: Date;
}

export interface VideoTopicAdminDetail {
  id: string;
  track: string;
  categoryId: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  status: ContentStatus;
  visibility: FeatureVisibility;
  sortOrder: number;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  legalTransitions: ContentStatus[];
  translations: VideoTopicAdminTranslationRow[];
  videos: {
    id: string;
    sortOrder: number;
    assetId: string | null;
    assetUrl: string | null;
    externalUrl: string | null;
    posterAssetId: string | null;
    posterUrl: string | null;
    title: string | null;
  }[];
  links: {
    id: string;
    sortOrder: number;
    label: string;
    path: string | null;
    url: string | null;
  }[];
}

/**
 * Every field, every locale — the editor's loader.
 *
 * It returns the STORED body rather than an empty string, which reads as an
 * obvious statement until you remember it is exactly the defect ADR-069 was
 * written about: the glossary's inline form seeded its state to `""` and its
 * loader selected no body, so the form could never edit, only overwrite.
 */
export async function getVideoTopicAdmin(id: string): Promise<VideoTopicAdminDetail | null> {
  const row = await db.videoTopic.findUnique({
    where: { id },
    select: {
      id: true,
      track: true,
      categoryId: true,
      coverAssetId: true,
      status: true,
      visibility: true,
      sortOrder: true,
      publishedAt: true,
      scheduledFor: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          summary: true,
          content: true,
          seoTitle: true,
          seoDescription: true,
          seoFocusKeyword: true,
          translationStatus: true,
          updatedAt: true,
        },
        orderBy: { locale: "asc" },
      },
      videos: {
        select: {
          id: true,
          sortOrder: true,
          assetId: true,
          externalUrl: true,
          posterAssetId: true,
          title: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      links: {
        select: { id: true, sortOrder: true, label: true, path: true, url: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!row) return null;

  const urls = await resolveAssetUrls([
    row.coverAssetId,
    ...row.videos.flatMap((v) => [v.assetId, v.posterAssetId]),
  ]);

  return {
    id: row.id,
    track: row.track,
    categoryId: row.categoryId,
    coverAssetId: row.coverAssetId,
    coverUrl: row.coverAssetId ? (urls.get(row.coverAssetId) ?? null) : null,
    status: row.status,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
    publishedAt: row.publishedAt,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    legalTransitions: CONTENT_TRANSITIONS[row.status],
    translations: row.translations,
    videos: row.videos.map((v) => ({
      ...v,
      assetUrl: v.assetId ? (urls.get(v.assetId) ?? null) : null,
      posterUrl: v.posterAssetId ? (urls.get(v.posterAssetId) ?? null) : null,
    })),
    links: row.links,
  };
}

// ─── Admin writes ────────────────────────────────────────────

/**
 * Slug uniqueness is per-locale and excludes the row being saved, so
 * re-saving a topic without touching its slug is a no-op rather than a
 * silent rename to `-2`.
 */
async function uniqueTopicSlug(locale: string, base: string, topicId: string): Promise<string> {
  const seed = base || "video";
  let candidate = seed;
  for (let n = 2; n < 100; n += 1) {
    const clash = await db.videoTopicTranslation.findFirst({
      where: { locale, slug: candidate, NOT: { topicId } },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${seed}-${n}`;
  }
  return `${seed}-${Date.now()}`;
}

async function uniqueCategorySlug(
  locale: string,
  base: string,
  categoryId: string,
): Promise<string> {
  const seed = base || "category";
  let candidate = seed;
  for (let n = 2; n < 100; n += 1) {
    const clash = await db.videoCategoryTranslation.findFirst({
      where: { locale, slug: candidate, NOT: { categoryId } },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${seed}-${n}`;
  }
  return `${seed}-${Date.now()}`;
}

export async function createVideoTopic(
  actor: Subject,
  input: CreateVideoTopicInput,
): Promise<string> {
  const { defaultLocale } = await localeContext();
  const topic = await db.videoTopic.create({
    data: {
      track: input.track,
      categoryId: input.categoryId ?? null,
      authorId: actor.id,
    },
  });
  const slug = await uniqueTopicSlug(defaultLocale, slugify(input.title), topic.id);

  await db.videoTopicTranslation.create({
    data: { topicId: topic.id, locale: defaultLocale, title: input.title, slug },
  });

  await recordAudit({
    userId: actor.id,
    action: "videos.create",
    entityType: "videos",
    entityId: topic.id,
    changes: { after: { title: input.title, track: input.track } },
  });
  revalidateTag("content", { expire: 0 });
  return topic.id;
}

/**
 * Meta, one translation, the WHOLE video list, the WHOLE link list and the
 * media references — one transaction.
 *
 * Both lists are replaced rather than diffed, for the reason `saveQuiz`
 * records about its question set: an editor reorders, deletes and adds in one
 * pass, and applying that as a stream of individual mutations is how a
 * half-saved page happens. Rows carrying an `id` keep it, so a stable
 * reference survives a reorder.
 *
 * The redirect is written OUTSIDE the transaction, exactly as `saveQuiz` and
 * `saveLesson` do and for the recorded reason: a failed redirect write has
 * never rolled back a saved translation.
 */
export async function saveVideoTopic(actor: Subject, input: VideoTopicInput): Promise<void> {
  const { defaultLocale } = await localeContext();
  const locale = input.translation.locale;
  const isSource = locale === defaultLocale;

  const slug = await uniqueTopicSlug(
    locale,
    slugify(input.translation.slug?.trim() || input.translation.title),
    input.topicId,
  );
  const existing = await db.videoTopicTranslation.findUnique({
    where: { topicId_locale: { topicId: input.topicId, locale } },
    select: { slug: true },
  });
  // Read before the update or there is nothing to redirect FROM. The track is
  // the URL's second segment (ADR-068 §1), so re-tracking relocates the page
  // exactly as a rename does.
  const previousTrack = (
    await db.videoTopic.findUnique({ where: { id: input.topicId }, select: { track: true } })
  )?.track;

  const meta: Prisma.VideoTopicUpdateInput = {};
  if (input.meta.track !== undefined) meta.track = input.meta.track;
  if (input.meta.visibility !== undefined) meta.visibility = input.meta.visibility;
  if (input.meta.sortOrder !== undefined) meta.sortOrder = input.meta.sortOrder;
  if (input.meta.categoryId !== undefined) {
    meta.category = input.meta.categoryId
      ? { connect: { id: input.meta.categoryId } }
      : { disconnect: true };
  }
  if (input.meta.coverAssetId !== undefined) meta.coverAssetId = input.meta.coverAssetId ?? null;

  // Sanitized server-side on save, always — regardless of what the editor
  // emitted (security.md #8). The body is the only rich-text field here.
  const content = input.translation.content ? sanitizeRichText(input.translation.content) : null;

  // The hash covers every field a translator reads, which is the lesson
  // ADR-069 §2 paid for: a hash over a subset means an edit to an uncovered
  // field leaves every sibling translation claiming to be current.
  const sourceHash = isSource
    ? computeSourceHash(
        `${input.translation.title}${input.translation.summary ?? ""}${content ?? ""}`,
      )
    : undefined;

  const fields = {
    title: input.translation.title,
    slug,
    summary: input.translation.summary ?? null,
    content,
    seoTitle: input.translation.seoTitle ?? null,
    seoDescription: input.translation.seoDescription ?? null,
    seoFocusKeyword: input.translation.seoFocusKeyword ?? null,
    ...(sourceHash === undefined ? {} : { sourceHash }),
    translationStatus: TranslationStatus.TRANSLATED,
  };

  await db.$transaction(async (tx) => {
    await tx.videoTopic.update({ where: { id: input.topicId }, data: meta });
    await tx.videoTopicTranslation.upsert({
      where: { topicId_locale: { topicId: input.topicId, locale } },
      update: fields,
      create: { topicId: input.topicId, locale, ...fields },
    });

    const keptVideoIds = input.videos.flatMap((v) => (v.id ? [v.id] : []));
    await tx.videoTopicVideo.deleteMany({
      where: {
        topicId: input.topicId,
        ...(keptVideoIds.length > 0 ? { id: { notIn: keptVideoIds } } : {}),
      },
    });
    for (const video of input.videos) {
      const data = {
        sortOrder: video.sortOrder,
        assetId: video.assetId ?? null,
        externalUrl: video.externalUrl ?? null,
        posterAssetId: video.posterAssetId ?? null,
        title: video.title ?? null,
      };
      if (video.id) {
        await tx.videoTopicVideo.update({ where: { id: video.id }, data });
      } else {
        await tx.videoTopicVideo.create({ data: { topicId: input.topicId, ...data } });
      }
    }

    // Links carry no id in the contract — they are a small, wholly-replaced
    // list with nothing pointing at an individual row, so replace is simpler
    // than a diff and cannot leave a stale one behind.
    await tx.videoTopicLink.deleteMany({ where: { topicId: input.topicId } });
    if (input.links.length > 0) {
      await tx.videoTopicLink.createMany({
        data: input.links.map((link, index) => ({
          topicId: input.topicId,
          sortOrder: index,
          label: link.label,
          path: link.path ?? null,
          url: link.url ?? null,
        })),
      });
    }

    // ADR-068 §7 — every media placement on this topic is a ContentReference,
    // so `deleteMedia()`'s in-use guard protects it. Written unconditionally
    // (an empty list when nothing is placed) so CLEARING a cover also clears
    // its reference; syncReferences replaces the whole set for this source.
    const placements = [
      ...(input.meta.coverAssetId
        ? [{ refType: "MEDIA" as const, refId: input.meta.coverAssetId, field: "coverAssetId" }]
        : []),
      ...input.videos.flatMap((video, index) => [
        ...(video.assetId
          ? [{ refType: "MEDIA" as const, refId: video.assetId, field: `videos.${index}.assetId` }]
          : []),
        ...(video.posterAssetId
          ? [
              {
                refType: "MEDIA" as const,
                refId: video.posterAssetId,
                field: `videos.${index}.posterAssetId`,
              },
            ]
          : []),
      ]),
    ];
    await syncReferences(tx, { sourceType: "VIDEO_TOPIC", sourceId: input.topicId }, placements);
  });

  const track = input.meta.track ?? previousTrack;
  if (existing && previousTrack && track && (existing.slug !== slug || previousTrack !== track)) {
    await createSlugRedirect(
      videoTopicPath(locale, defaultLocale, previousTrack, existing.slug),
      videoTopicPath(locale, defaultLocale, track, slug),
      actor.id,
    );
  }

  await recordAudit({
    userId: actor.id,
    action: "videos.update",
    entityType: "videos",
    entityId: input.topicId,
    changes: { after: { locale, videos: input.videos.length, links: input.links.length } },
  });
  revalidateTag("content", { expire: 0 });
}

export async function setVideoTopicDeleted(
  actor: Subject,
  topicId: string,
  deleted: boolean,
): Promise<void> {
  await db.videoTopic.update({
    where: { id: topicId },
    data: { deletedAt: deleted ? new Date() : null },
  });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "videos.delete" : "videos.restore",
    entityType: "videos",
    entityId: topicId,
    changes: { after: { deleted } },
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Categories ──────────────────────────────────────────────

export interface VideoCategoryAdminRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  topicCount: number;
}

export async function listVideoCategoriesAdmin(): Promise<VideoCategoryAdminRow[]> {
  const { defaultLocale } = await localeContext();
  const rows = await db.videoCategory.findMany({
    select: {
      id: true,
      isActive: true,
      sortOrder: true,
      translations: {
        select: { locale: true, name: true, slug: true, description: true },
      },
      _count: { select: { topics: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => {
    const t =
      row.translations.find((x) => x.locale === defaultLocale) ?? row.translations[0] ?? null;
    return {
      id: row.id,
      name: t?.name ?? "",
      slug: t?.slug ?? "",
      description: t?.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      topicCount: row._count.topics,
    };
  });
}

/** Create when `categoryId` is absent, update when it is present — one screen, one action. */
export async function saveVideoCategory(
  actor: Subject,
  input: VideoCategoryInput,
): Promise<string> {
  const locale = input.translation.locale;
  const { defaultLocale } = await localeContext();

  const categoryId =
    input.categoryId ??
    (
      await db.videoCategory.create({
        data: { isActive: input.isActive ?? true, sortOrder: input.sortOrder ?? 0 },
        select: { id: true },
      })
    ).id;

  const slug = await uniqueCategorySlug(
    locale,
    slugify(input.translation.slug?.trim() || input.translation.name),
    categoryId,
  );
  const existing = await db.videoCategoryTranslation.findUnique({
    where: { categoryId_locale: { categoryId, locale } },
    select: { slug: true },
  });

  const fields = {
    name: input.translation.name,
    slug,
    description: input.translation.description ?? null,
    seoTitle: input.translation.seoTitle ?? null,
    seoDescription: input.translation.seoDescription ?? null,
  };

  await db.$transaction(async (tx) => {
    if (input.categoryId) {
      const meta: Prisma.VideoCategoryUpdateInput = {};
      if (input.isActive !== undefined) meta.isActive = input.isActive;
      if (input.sortOrder !== undefined) meta.sortOrder = input.sortOrder;
      if (Object.keys(meta).length > 0) {
        await tx.videoCategory.update({ where: { id: categoryId }, data: meta });
      }
    }
    await tx.videoCategoryTranslation.upsert({
      where: { categoryId_locale: { categoryId, locale } },
      update: fields,
      create: { categoryId, locale, ...fields },
    });
  });

  // A category page lives under every track it has topics in, so a rename
  // relocates as many URLs as there are tracks. Writing one redirect per track
  // is the honest cost of ADR-068 §1's decision that a category is taxonomy
  // rather than address — the page exists at each of them.
  if (existing && existing.slug !== slug) {
    const tracks = await db.videoTopic.findMany({
      where: { categoryId, ...publicVideoWhere() },
      select: { track: true },
      distinct: ["track"],
    });
    for (const { track } of tracks) {
      await createSlugRedirect(
        videoCategoryPath(locale, defaultLocale, track, existing.slug),
        videoCategoryPath(locale, defaultLocale, track, slug),
        actor.id,
      );
    }
  }

  await recordAudit({
    userId: actor.id,
    action: input.categoryId ? "videos.category.update" : "videos.category.create",
    entityType: "videos",
    entityId: categoryId,
    changes: { after: { locale, name: input.translation.name } },
  });
  revalidateTag("content", { expire: 0 });
  return categoryId;
}

export async function setVideoCategoryActive(
  actor: Subject,
  categoryId: string,
  active: boolean,
): Promise<void> {
  await db.videoCategory.update({ where: { id: categoryId }, data: { isActive: active } });
  await recordAudit({
    userId: actor.id,
    action: "videos.category.update",
    entityType: "videos",
    entityId: categoryId,
    changes: { after: { isActive: active } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Hard delete, and the topics filed under it SURVIVE.
 *
 * The FK is `onDelete: SetNull` for exactly this — the same call `Lesson.quizId`
 * makes. Deleting a taxonomy row must never delete the pages it organised, and
 * a topic with no category is a legitimate state the reads already handle.
 */
export async function deleteVideoCategory(actor: Subject, categoryId: string): Promise<void> {
  await db.videoCategory.delete({ where: { id: categoryId } });
  await recordAudit({
    userId: actor.id,
    action: "videos.category.delete",
    entityType: "videos",
    entityId: categoryId,
    changes: { before: { categoryId } },
  });
  revalidateTag("content", { expire: 0 });
}

/** Keyboard-only reorder (plan 8.2 — no DnD dependency): the caller sends the whole order. */
export async function reorderVideoCategories(
  actor: Subject,
  input: ReorderVideoCategoriesInput,
): Promise<void> {
  await db.$transaction(
    input.ids.map((id, index) =>
      db.videoCategory.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  await recordAudit({
    userId: actor.id,
    action: "videos.category.reorder",
    entityType: "videos",
    entityId: "video-categories",
    changes: { after: { order: input.ids } },
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Public reads ────────────────────────────────────────────

export async function loadVideoTopics(
  locale: string,
  track: string,
  categorySlug?: string,
): Promise<VideoTopicCardView[]> {
  if (!trackKeyOf(track)) return [];
  const { locales, defaultLocale } = await localeContext();

  const rows = await db.videoTopic.findMany({
    where: {
      ...publicVideoWhere(),
      track,
      ...(categorySlug
        ? { category: { isActive: true, translations: { some: { slug: categorySlug } } } }
        : {}),
    },
    select: {
      id: true,
      track: true,
      coverAssetId: true,
      translations: { select: { locale: true, title: true, slug: true, summary: true } },
      category: {
        select: { translations: { select: { locale: true, name: true, slug: true } } },
      },
      _count: { select: { videos: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
  });

  const coverUrls = await resolveAssetUrls(rows.map((r) => r.coverAssetId));

  return rows.flatMap((row) => {
    const t = pickTranslation(row.translations, locale, defaultLocale, locales);
    if (!t) return [];
    const c = row.category
      ? pickTranslation(row.category.translations, locale, defaultLocale, locales)
      : null;
    return [
      {
        id: row.id,
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        track: row.track,
        category: c ? { slug: c.slug, name: c.name } : null,
        coverUrl: row.coverAssetId ? (coverUrls.get(row.coverAssetId) ?? null) : null,
        videoCount: row._count.videos,
      },
    ];
  });
}

export async function getVideoTopics(
  locale: string,
  track: string,
  categorySlug?: string,
): Promise<VideoTopicCardView[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadVideoTopics(locale, track, categorySlug);
}

/**
 * One topic, addressed by TRACK + slug.
 *
 * Returns null when the row's track differs from the one asked for, so a topic
 * loaded under the wrong school 404s rather than answering at two URLs — the
 * rule ADR-065 set for courses and quizzes.
 */
export async function loadVideoTopicBySlug(
  locale: string,
  track: string,
  slug: string,
): Promise<VideoTopicView | null> {
  if (!trackKeyOf(track)) return null;
  const { locales, defaultLocale } = await localeContext();

  const match = await db.videoTopicTranslation.findFirst({
    where: { slug, topic: { ...publicVideoWhere(), track } },
    select: { topicId: true },
  });
  if (!match) return null;

  const row = await db.videoTopic.findFirst({
    where: { id: match.topicId, ...publicVideoWhere(), track },
    select: {
      id: true,
      track: true,
      coverAssetId: true,
      updatedAt: true,
      translations: {
        select: {
          locale: true,
          title: true,
          slug: true,
          summary: true,
          content: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      category: {
        select: { translations: { select: { locale: true, name: true, slug: true } } },
      },
      videos: {
        select: {
          assetId: true,
          externalUrl: true,
          posterAssetId: true,
          title: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      links: {
        select: { label: true, path: true, url: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!row) return null;

  const t = pickTranslation(row.translations, locale, defaultLocale, locales);
  if (!t) return null;
  const c = row.category
    ? pickTranslation(row.category.translations, locale, defaultLocale, locales)
    : null;

  const urls = await resolveAssetUrls([
    row.coverAssetId,
    ...row.videos.flatMap((v) => [v.assetId, v.posterAssetId]),
  ]);

  return {
    id: row.id,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    content: t.content,
    track: row.track,
    category: c ? { slug: c.slug, name: c.name } : null,
    coverUrl: row.coverAssetId ? (urls.get(row.coverAssetId) ?? null) : null,
    videos: row.videos.flatMap((v) => {
      const resolved = resolveVideoSource(v, urls);
      return resolved ? [resolved] : [];
    }),
    links: row.links.flatMap((l) => {
      const resolved = resolveLink(l);
      return resolved ? [resolved] : [];
    }),
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    updatedAt: row.updatedAt,
  };
}

export async function getVideoTopicBySlug(
  locale: string,
  track: string,
  slug: string,
): Promise<VideoTopicView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadVideoTopicBySlug(locale, track, slug);
}

/**
 * Categories that have at least one published topic IN THIS TRACK, with the
 * count for that track only.
 *
 * A category spans tracks (ADR-068 §1), so the same chip legitimately shows
 * different counts under different schools. That is the accepted consequence
 * of a category being taxonomy rather than address, and it is written down
 * here so it is not "fixed" into a global count later.
 */
export async function loadVideoCategories(
  locale: string,
  track: string,
): Promise<VideoCategoryView[]> {
  if (!trackKeyOf(track)) return [];
  const { locales, defaultLocale } = await localeContext();

  const rows = await db.videoCategory.findMany({
    where: { isActive: true, topics: { some: { ...publicVideoWhere(), track } } },
    select: {
      id: true,
      translations: { select: { locale: true, name: true, slug: true, description: true } },
      _count: { select: { topics: { where: { ...publicVideoWhere(), track } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.flatMap((row) => {
    const t = pickTranslation(row.translations, locale, defaultLocale, locales);
    if (!t) return [];
    return [
      {
        id: row.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        topicCount: row._count.topics,
      },
    ];
  });
}

export async function getVideoCategories(
  locale: string,
  track: string,
): Promise<VideoCategoryView[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadVideoCategories(locale, track);
}

export interface VideoSitemapEntry {
  /** Locale-free path, exactly as `QuizSitemapEntry` carries it — the sitemap
   * adds the prefix, so one shape works for every loader it consumes. */
  path: string;
  locale: string;
  updatedAt: Date;
}

/**
 * Every published topic in a registered track, per locale.
 *
 * Rows in a de-registered track are dropped for the same reason the card
 * loaders drop them: the URL segment does not exist, so the page does not
 * either, and a sitemap entry pointing at a 404 is worse than a missing one.
 */
export async function loadVideoSitemapEntries(): Promise<VideoSitemapEntry[]> {
  const rows = await db.videoTopicTranslation.findMany({
    where: { topic: publicVideoWhere() },
    select: {
      locale: true,
      slug: true,
      updatedAt: true,
      topic: { select: { track: true } },
    },
  });
  return rows.flatMap((row) =>
    trackKeyOf(row.topic.track)
      ? [
          {
            path: `/learn/${row.topic.track}/videos/${row.slug}`,
            locale: row.locale,
            updatedAt: row.updatedAt,
          },
        ]
      : [],
  );
}
