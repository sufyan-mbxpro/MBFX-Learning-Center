// The tools service (Module 13, ADR-086).
//
// ADR-086 #1's line runs through this file: `TOOL_KEYS` in `@repo/contracts`
// decides which tools exist and what each computes; everything here reads or
// writes what a tool SAYS. A row for a key the registry does not know is
// ignored by every reader rather than rendering an unroutable page — the code
// registry is the source of truth about the SET, always.
import {
  TOOLS,
  TOOL_KEYS,
  isToolKey,
  parseToolConfig,
  toolHighlightSchema,
  type SaveToolInput,
  type ToolFaqEntry,
  type ToolHighlight,
  type ToolKey,
} from "@repo/contracts";
import { db, TranslationStatus, type Prisma } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { htmlLead } from "@repo/utils";
import type { Subject } from "@repo/rbac";
import { cacheLife, cacheTag } from "next/cache";

import { sanitizeRichText } from "./content.ts";
import {
  RELATED,
  TOOL,
  loadMixedRelationTargets,
  replaceMixedRelations,
  type MixedRelation,
} from "./content-relations.ts";
import { recordAudit } from "./index.ts";
import { INDEXABLE_TRANSLATION_STATUSES, isIndexableTranslation } from "./reading-languages.ts";
import { hashToolSource, loadToolSource } from "./tool-source.ts";
import { afterSourceSave } from "./translation-queue.ts";
import { publicArticleWhere } from "./public-articles.ts";
import { publicGlossaryTermWhere } from "./public-content.ts";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";
import { publicVideoWhere } from "./videos.ts";

export class UnknownToolError extends Error {
  constructor(key: string) {
    super(`"${key}" is not a registered tool.`);
    this.name = "UnknownToolError";
  }
}

export class InvalidToolConfigError extends Error {
  readonly issues: string[];
  constructor(key: string, issues: string[]) {
    super(`Configuration for "${key}" is not valid: ${issues.join("; ")}`);
    this.name = "InvalidToolConfigError";
    this.issues = issues;
  }
}

// ─── Views ───────────────────────────────────────────────────

export interface ToolListRow {
  id: string;
  key: ToolKey;
  isEnabled: boolean;
  sortOrder: number;
  title: string | null;
  relatedCount: number;
  showRelated: boolean;
  /** How many items the editor has actually curated. */
  curatedCount: number;
  updatedAt: Date;
  icon: string;
  needs: "none" | "rates" | "history";
}

export interface ToolEditorView {
  id: string;
  key: ToolKey;
  isEnabled: boolean;
  sortOrder: number;
  coverAssetId: string | null;
  /** The cover's URL for the upload field; `null` when unset or its asset was deleted. */
  coverUrl: string | null;
  config: unknown;
  relatedCount: number;
  showRelated: boolean;
  translation: {
    locale: string;
    title: string;
    tagline: string | null;
    intro: string | null;
    body: string | null;
    faq: ToolFaqEntry[];
    highlights: ToolHighlight[];
    seoTitle: string | null;
    seoDescription: string | null;
    seoFocusKeyword: string | null;
    translationStatus: TranslationStatus;
  } | null;
  related: MixedRelation[];
}

/** What a public tool page renders, once the registry has approved the key. */
export interface ToolPageView {
  key: ToolKey;
  /**
   * The words at this URL are not a person's: machine-written, or absent
   * altogether (ADR-168 #5).
   */
  noIndex: boolean;
  /**
   * `null` when no translation exists anywhere in the locale's fallback chain
   * (ADR-168 #2). The page names the tool from the catalog instead
   * (`tools.names.<key>`) and shows the calculator with a notice — never the
   * registry key, which is what a reader on `/ar` used to see.
   */
  title: string | null;
  tagline: string | null;
  intro: string | null;
  body: string | null;
  faq: ToolFaqEntry[];
  highlights: ToolHighlight[];
  seoTitle: string | null;
  seoDescription: string | null;
  coverAssetId: string | null;
  /**
   * The cover's URL, or `null` when there is none or its asset was deleted.
   * The masthead shows it (ADR-117's photo tone); an unresolved id must not
   * reach the page as a picture that 404s.
   */
  coverUrl: string | null;
  /**
   * The locales whose words a person approved, for hreflang (ADR-164 #5). A
   * tool's path is its registry key in every locale, so a locale is enough.
   */
  alternateLocales: string[];
  config: unknown;
  showRelated: boolean;
  relatedCount: number;
}

function parseFaq(value: unknown): ToolFaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ToolFaqEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as ToolFaqEntry).question === "string" &&
      typeof (entry as ToolFaqEntry).answer === "string",
  );
}

/**
 * The stored highlights, or none.
 *
 * Parsed through the CONTRACT schema rather than duck-typed the way `parseFaq`
 * above it is, and the difference is `icon`: a highlight carries a value from
 * a closed list, and a row written before a name was retired would otherwise
 * reach a renderer that has no component for it. `safeParse` per entry drops
 * exactly the bad one and keeps the rest, which is the behaviour a band of
 * four cards wants — three cards beat an empty band.
 */
function parseHighlights(value: unknown): ToolHighlight[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = toolHighlightSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** A cover asset's URL, skipping a soft-deleted asset so no page draws a 404. */
async function resolveCoverUrl(assetId: string | null): Promise<string | null> {
  if (!assetId) return null;
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { url: true },
  });
  return asset?.url ?? null;
}

// ─── Admin reads ─────────────────────────────────────────────

export async function listTools(locale = "en"): Promise<ToolListRow[]> {
  const rows = await db.tool.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    include: { translations: { where: { locale }, select: { title: true } } },
  });

  const curated = await db.contentRelation.groupBy({
    by: ["sourceId"],
    where: { sourceType: TOOL, relationType: RELATED },
    _count: { _all: true },
  });
  const curatedBySource = new Map(curated.map((row) => [row.sourceId, row._count._all]));

  // A row whose key the registry does not know is DROPPED rather than listed:
  // it has no route, no config schema and no island, so an editor opening it
  // would reach a 404 from inside the admin (ADR-086 #1).
  return rows
    .filter((row): row is typeof row & { key: ToolKey } => isToolKey(row.key))
    .map((row) => ({
      id: row.id,
      key: row.key,
      isEnabled: row.isEnabled,
      sortOrder: row.sortOrder,
      title: row.translations[0]?.title ?? null,
      relatedCount: row.relatedCount,
      showRelated: row.showRelated,
      curatedCount: curatedBySource.get(row.id) ?? 0,
      updatedAt: row.updatedAt,
      icon: TOOLS[row.key].icon,
      needs: TOOLS[row.key].needs,
    }));
}

export async function loadTool(key: string, locale = "en"): Promise<ToolEditorView | null> {
  if (!isToolKey(key)) throw new UnknownToolError(key);

  const row = await db.tool.findUnique({
    where: { key },
    include: { translations: { where: { locale } } },
  });
  if (!row) return null;

  const translation = row.translations[0];
  return {
    id: row.id,
    key,
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
    coverAssetId: row.coverAssetId,
    coverUrl: await resolveCoverUrl(row.coverAssetId),
    config: row.config,
    relatedCount: row.relatedCount,
    showRelated: row.showRelated,
    translation: translation
      ? {
          locale: translation.locale,
          title: translation.title,
          tagline: translation.tagline,
          intro: translation.intro,
          body: translation.body,
          faq: parseFaq(translation.faq),
          highlights: parseHighlights(translation.highlights),
          seoTitle: translation.seoTitle,
          seoDescription: translation.seoDescription,
          seoFocusKeyword: translation.seoFocusKeyword,
          translationStatus: translation.translationStatus,
        }
      : null,
    related: await loadMixedRelationTargets({
      sourceType: TOOL,
      sourceId: row.id,
      relationType: RELATED,
    }),
  };
}

// ─── Admin writes ────────────────────────────────────────────

/**
 * One transaction: tool fields, one translation, and the mixed relation set.
 *
 * All three or none — a save that wrote the copy and dropped the related list
 * would leave an editor looking at a screen that disagrees with itself.
 */
/** Returns the tool's id, which its translation jobs are keyed by. */
export async function saveTool(subject: Subject, input: SaveToolInput): Promise<string> {
  if (!isToolKey(input.key)) throw new UnknownToolError(input.key);
  const key: ToolKey = input.key;

  // The config is validated against THIS KEY's schema — the one definition the
  // form, the action and this service all run (ADR-086 #2). A config that
  // belongs to a different tool fails here rather than reaching a widget.
  const parsedConfig = parseToolConfig(key, input.config);
  if (!parsedConfig.ok) {
    throw new InvalidToolConfigError(
      key,
      parsedConfig.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const defaultLocale =
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en";
  const isSource = input.translation.locale === defaultLocale;

  // Sanitised on SAVE, not only on render (security.md #8).
  const clean = {
    intro: input.translation.intro ? sanitizeRichText(input.translation.intro) : null,
    body: input.translation.body ? sanitizeRichText(input.translation.body) : null,
    faq: (input.translation.faq ?? []).map((entry) => ({
      question: entry.question,
      answer: sanitizeRichText(entry.answer),
    })),
    // NOT sanitised, because it is not rich text (ADR-114 #3): the schema
    // accepts a plain string and the renderer prints one, so there is no
    // markup for a sanitiser to have an opinion about. Running it through
    // `sanitizeRichText` anyway would silently delete an ampersand-heavy
    // sentence's meaning while looking like diligence.
    highlights: (input.translation.highlights ?? []).map((entry) => ({
      icon: entry.icon,
      title: entry.title,
      text: entry.text,
    })),
  };

  // What a translation is measured against: every word the job translates
  // (`tool-source.ts`, ADR-069's rule for FAQ and highlights, plus the SEO
  // text since Phase 5). A translation records the hash of the English it was
  // made from, COMPUTED from that row — the stored one was copied before, and
  // a seeded English row has none, so every person's translation looked stale.
  const existingTool = await db.tool.findUnique({ where: { key }, select: { id: true } });
  const translatedFrom =
    isSource || !existingTool
      ? null
      : await loadToolSource(db, existingTool.id, defaultLocale).then((s) =>
          s ? hashToolSource(s) : null,
        );

  await db.$transaction(async (tx) => {
    const tool = await tx.tool.upsert({
      where: { key },
      update: {
        isEnabled: input.isEnabled,
        sortOrder: input.sortOrder,
        coverAssetId: input.coverAssetId ?? null,
        config: parsedConfig.config as Prisma.InputJsonValue,
        relatedCount: input.relatedCount,
        showRelated: input.showRelated,
      },
      create: {
        key,
        isEnabled: input.isEnabled,
        sortOrder: input.sortOrder,
        coverAssetId: input.coverAssetId ?? null,
        config: parsedConfig.config as Prisma.InputJsonValue,
        relatedCount: input.relatedCount,
        showRelated: input.showRelated,
      },
    });

    const translationData = {
      title: input.translation.title,
      tagline: input.translation.tagline ?? null,
      intro: clean.intro,
      body: clean.body,
      // An empty ARRAY is not `undefined`: it is the honest representation of
      // "the author removed every question", and Prisma reads `undefined` as
      // "leave this column alone".
      faq: clean.faq as Prisma.InputJsonValue,
      highlights: clean.highlights as Prisma.InputJsonValue,
      seoTitle: input.translation.seoTitle ?? null,
      seoDescription: input.translation.seoDescription ?? null,
      seoFocusKeyword: input.translation.seoFocusKeyword ?? null,
      ...(isSource ? {} : { sourceHash: translatedFrom }),
      translationStatus: TranslationStatus.TRANSLATED,
    };

    await tx.toolTranslation.upsert({
      where: { toolId_locale: { toolId: tool.id, locale: input.translation.locale } },
      update: translationData,
      create: { toolId: tool.id, locale: input.translation.locale, ...translationData },
    });

    await replaceMixedRelations(tx, {
      sourceType: TOOL,
      sourceId: tool.id,
      relationType: RELATED,
      targets: input.related,
    });
  });

  await recordAudit({
    userId: subject.id,
    action: "tool.update",
    entityType: "Tool",
    entityId: key,
    changes: { after: { key, isEnabled: input.isEnabled, locale: input.translation.locale } },
  });

  // An English save: a person's translation whose source moved becomes
  // OUTDATED and a machine one is re-translated (ADR-161 #3). The old sweep
  // flipped EVERY stale sibling, machine rows included — under ADR-159 that
  // would have made stale machine text indexable.
  const tool = await db.tool.findUniqueOrThrow({ where: { key }, select: { id: true } });
  if (isSource) {
    const source = await loadToolSource(db, tool.id, defaultLocale);
    const hash = source ? hashToolSource(source) : null;
    if (hash) {
      await db.toolTranslation.updateMany({
        where: { toolId: tool.id, locale: defaultLocale },
        data: { sourceHash: hash },
      });
    }
    await afterSourceSave("tool", tool.id, hash, defaultLocale);
  }
  return tool.id;
}

/** The on/off switch, which is `tools.publish` rather than `tools.update`. */
export async function setToolEnabled(
  subject: Subject,
  key: string,
  isEnabled: boolean,
): Promise<void> {
  if (!isToolKey(key)) throw new UnknownToolError(key);
  await db.tool.update({ where: { key }, data: { isEnabled } });
  await recordAudit({
    userId: subject.id,
    action: isEnabled ? "tool.enable" : "tool.disable",
    entityType: "Tool",
    entityId: key,
    changes: { after: { key, isEnabled } },
  });
}

export async function reorderTools(
  subject: Subject,
  orderedKeys: readonly string[],
): Promise<void> {
  const keys = orderedKeys.filter(isToolKey);
  await db.$transaction(
    keys.map((key, index) => db.tool.update({ where: { key }, data: { sortOrder: index } })),
  );
  await recordAudit({
    userId: subject.id,
    action: "tool.reorder",
    entityType: "Tool",
    changes: { after: { order: keys } },
  });
}

// ─── Public reads ────────────────────────────────────────────

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

export interface EnabledTool {
  key: ToolKey;
  /** `null` when untranslated in this locale's chain — see `ToolPageView.title`. */
  title: string | null;
  tagline: string | null;
  icon: string;
  sortOrder: number;
  coverAssetId: string | null;
}

/**
 * The tools a reader may open, in admin order.
 *
 * Feature flags are NOT read here: they gate per-page (ADR-086 #5) and the
 * caller knows which flags it has already resolved. Mixing a flag read into a
 * cached content read would tie the two caches together.
 */
export async function getEnabledTools(locale = "en"): Promise<EnabledTool[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 3600 });

  const [rows, { locales, defaultLocale }] = await Promise.all([
    db.tool.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      include: {
        translations: { select: { locale: true, title: true, tagline: true } },
      },
    }),
    localeContext(),
  ]);

  return rows
    .filter((row): row is typeof row & { key: ToolKey } => isToolKey(row.key))
    .map((row) => {
      // The fallback chain every other module uses (ADR-168 #1). A tool with
      // no row in the chain is still listed — its calculator works in every
      // locale — and the caller names it from the catalog.
      const picked = pickTranslation(row.translations, locale, defaultLocale, locales);
      return {
        key: row.key,
        title: picked?.title ?? null,
        tagline: picked?.tagline ?? null,
        icon: TOOLS[row.key].icon,
        sortOrder: row.sortOrder,
        coverAssetId: row.coverAssetId,
      };
    });
}

/** One tool's page, or `null` when it does not exist or is switched off. */
export async function getToolPage(locale: string, key: string): Promise<ToolPageView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 3600 });

  if (!isToolKey(key)) return null;

  const [row, { locales, defaultLocale }] = await Promise.all([
    db.tool.findUnique({ where: { key }, include: { translations: true } }),
    localeContext(),
  ]);
  // A disabled tool 404s (ADR-086 #5) — the same `null` an unknown key gets,
  // so the page cannot accidentally distinguish them.
  if (!row || !row.isEnabled) return null;

  // The words through the fallback chain (ADR-168 #1); the row this URL NAMES
  // decides indexing, as it does for a glossary term.
  const translation = pickTranslation(row.translations, locale, defaultLocale, locales);
  const own = row.translations.find((t) => t.locale === locale);
  return {
    key,
    // ADR-159 #2: machine-written words at their own URL are served, not
    // indexed — and ADR-168 #5: neither is an address with no words of its own.
    noIndex: own ? !isIndexableTranslation(own, defaultLocale) : locale !== defaultLocale,
    title: translation?.title ?? null,
    tagline: translation?.tagline ?? null,
    intro: translation?.intro ?? null,
    body: translation?.body ?? null,
    faq: parseFaq(translation?.faq),
    highlights: parseHighlights(translation?.highlights),
    seoTitle: translation?.seoTitle ?? null,
    seoDescription: translation?.seoDescription ?? null,
    coverAssetId: row.coverAssetId,
    coverUrl: await resolveCoverUrl(row.coverAssetId),
    alternateLocales: row.translations
      .filter((t) => isIndexableTranslation(t, defaultLocale))
      .map((t) => t.locale),
    config: row.config,
    showRelated: row.showRelated,
    relatedCount: row.relatedCount,
  };
}

/** Every registry key, for `generateStaticParams`. */
export function allToolKeys(): readonly ToolKey[] {
  return TOOL_KEYS;
}

// ─── The related picker's candidates ─────────────────────────

export interface RelatedCandidate {
  targetType: string;
  targetId: string;
  label: string;
}

/**
 * Every content item a tool's related list may point at, across five types.
 *
 * It lives here rather than in the editor's loader because `apps/web` may not
 * import `@repo/db` (architecture.md #2) — and the type checker said so before
 * a reviewer had to. That rule is what keeps `apps/mobile` a configuration
 * change rather than a rewrite, and a "just this once" in an admin page is
 * exactly how it stops being true.
 *
 * One query per type rather than five services: this is the one screen that
 * needs every type's titles at once, and the per-type services would each pay
 * their own round trip anyway.
 */
export async function listRelatedCandidates(
  locale = "en",
  perType = 300,
): Promise<RelatedCandidate[]> {
  const take = Math.max(1, Math.min(perType, 1000));
  const translations = { where: { locale }, select: { title: true } } as const;

  const [lessons, articles, glossary, videos, courses] = await Promise.all([
    db.lesson.findMany({
      where: { deletedAt: null },
      take,
      orderBy: { updatedAt: "desc" },
      select: { id: true, translations },
    }),
    db.article.findMany({
      where: { deletedAt: null },
      take,
      orderBy: { updatedAt: "desc" },
      select: { id: true, translations },
    }),
    db.glossaryTerm.findMany({
      where: { deletedAt: null },
      take,
      orderBy: { updatedAt: "desc" },
      // The glossary's title column is `term`, not `title`.
      select: { id: true, translations: { where: { locale }, select: { term: true } } },
    }),
    db.videoTopic.findMany({
      where: { deletedAt: null },
      take,
      orderBy: { updatedAt: "desc" },
      select: { id: true, translations },
    }),
    db.course.findMany({
      where: { deletedAt: null },
      take,
      orderBy: { updatedAt: "desc" },
      select: { id: true, translations },
    }),
  ]);

  const titled =
    (targetType: string) =>
    (row: { id: string; translations: { title: string }[] }): RelatedCandidate => ({
      targetType,
      targetId: row.id,
      // An untranslated row falls back to its id rather than to an empty
      // label: a blank option in a picker is unclickable and unexplained.
      label: row.translations[0]?.title ?? row.id,
    });

  return [
    ...lessons.map(titled("lesson")),
    ...articles.map(titled("article")),
    ...glossary.map((row) => ({
      targetType: "glossary",
      targetId: row.id,
      label: row.translations[0]?.term ?? row.id,
    })),
    ...videos.map(titled("video")),
    ...courses.map(titled("course")),
  ];
}

// ─── The related strip (ADR-086 #4) ──────────────────────────

export interface ToolRelatedItem {
  targetType: string;
  title: string;
  href: string;
  summary: string | null;
  /**
   * The feature flag the destination's route is gated on. A cached read cannot
   * evaluate flags against a viewer, so the page drops an item whose flag is
   * off rather than linking to a route that answers 404 (changes-46).
   */
  feature: ToolRelatedFeature;
}

export type ToolRelatedFeature = "news" | "analysis" | "courses" | "videos" | "glossary";

/** The flag `/news/[slug]` gates an article on — NEWS on `news`, every other kind on `analysis`. */
function articleFeature(kind: string): ToolRelatedFeature {
  return kind === "NEWS" ? "news" : "analysis";
}

/**
 * Curated first, topped up automatically — `resolveRecommendations`'s pattern
 * (ADR-055), with one difference: the list is MIXED-TYPE, so the top-up draws
 * from the newest published content rather than from one table.
 *
 * **The strip never renders empty** when the tool asks for one. A curated list
 * of two and a count of six yields six; a curated list of none yields six; and
 * only a site with no published content at all yields nothing.
 */
export async function getToolRelated(
  locale: string,
  key: string,
  count: number,
): Promise<ToolRelatedItem[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 3600 });

  if (!isToolKey(key) || count <= 0) return [];

  const tool = await db.tool.findUnique({ where: { key }, select: { id: true } });
  const curated = tool
    ? await loadMixedRelationTargets({
        sourceType: TOOL,
        sourceId: tool.id,
        relationType: RELATED,
      })
    : [];

  const resolved = await resolveMixedTargets(locale, curated);

  if (resolved.length >= count) return resolved.slice(0, count);

  // The top-up. Newest published lessons and articles, minus whatever is
  // already curated — enough to reach the count, never more.
  const taken = new Set(resolved.map((item) => `${item.targetType}:${item.href}`));
  const needed = count - resolved.length;
  const now = new Date();

  const [lessons, articles] = await Promise.all([
    db.lesson.findMany({
      where: relatedTargetWhere(now).lesson,
      orderBy: { publishedAt: "desc" },
      take: needed * 2,
      select: {
        id: true,
        section: {
          select: {
            course: {
              select: { track: true, translations: { where: { locale }, select: { slug: true } } },
            },
          },
        },
        translations: { where: { locale }, select: { title: true, slug: true, summary: true } },
      },
    }),
    db.article.findMany({
      where: relatedTargetWhere(now).article,
      orderBy: { publishedAt: "desc" },
      take: needed * 2,
      select: {
        id: true,
        kind: true,
        translations: { where: { locale }, select: { title: true, slug: true, excerpt: true } },
      },
    }),
  ]);

  const topUp: ToolRelatedItem[] = [];
  for (const article of articles) {
    const tr = article.translations[0];
    if (!tr?.slug) continue;
    const href = relatedArticleHref(tr.slug);
    if (taken.has(`article:${href}`)) continue;
    topUp.push({
      targetType: "article",
      title: tr.title,
      href,
      summary: tr.excerpt,
      feature: articleFeature(article.kind),
    });
  }
  for (const lesson of lessons) {
    const tr = lesson.translations[0];
    const course = lesson.section?.course;
    const courseSlug = course?.translations[0]?.slug;
    if (!tr?.slug || !courseSlug || !course?.track) continue;
    const href = `/learn/${course.track}/${courseSlug}/${tr.slug}`;
    if (taken.has(`lesson:${href}`)) continue;
    topUp.push({
      targetType: "lesson",
      title: tr.title,
      href,
      summary: tr.summary,
      feature: "courses",
    });
  }

  return [...resolved, ...topUp].slice(0, count);
}

/**
 * Where an article lives on the public site. EVERY kind is served at
 * `/news/[slug]` — `/analysis` is a listing with no detail route under it.
 * changes-46: this module built `/analysis/<slug>` for an ANALYSIS article,
 * so "More about this" on /tools/pivot-points linked a published article to
 * the 404 page.
 */
export function relatedArticleHref(slug: string): string {
  return `/news/${slug}`;
}

/**
 * The public visibility rule for each kind of thing a tool can link to.
 *
 * Composed from each module's OWN published rule, never a fresh
 * `status: PUBLISHED` — the site-wide search (ADR-108) takes the same stance,
 * for the same reason: a list with its own idea of "public" is a list that
 * links to drafts, to deactivated rows (ADR-139 #2's `isActive`), to a
 * premium course, or to a lesson inside a hidden section. changes-46: the
 * curated list used to check `deletedAt` alone, so a target an editor
 * unpublished or switched off stayed on every tool page that named it.
 *
 * A lesson is reachable only in a published section of a public course, the
 * rule `Course.lessonCount` counts by (ADR-081 #2).
 */
export function relatedTargetWhere(now: Date) {
  return {
    lesson: {
      ...publicLessonWhere(now),
      section: { isPublished: true, course: publicCourseWhere(now) },
    },
    article: publicArticleWhere(now),
    glossary: publicGlossaryTermWhere(now),
    video: publicVideoWhere(now),
    course: publicCourseWhere(now),
  };
}

/** Resolve curated (type, id) pairs to titles and hrefs, keeping their order. */
async function resolveMixedTargets(
  locale: string,
  targets: readonly MixedRelation[],
): Promise<ToolRelatedItem[]> {
  if (targets.length === 0) return [];
  const byType = (type: string) =>
    targets.filter((t) => t.targetType === type).map((t) => t.targetId);
  const visible = relatedTargetWhere(new Date());

  const [lessons, articles, glossary, videos, courses] = await Promise.all([
    db.lesson.findMany({
      where: { AND: [{ id: { in: byType("lesson") } }, visible.lesson] },
      select: {
        id: true,
        section: {
          select: {
            course: {
              select: { track: true, translations: { where: { locale }, select: { slug: true } } },
            },
          },
        },
        translations: { where: { locale }, select: { title: true, slug: true, summary: true } },
      },
    }),
    db.article.findMany({
      where: { AND: [{ id: { in: byType("article") } }, visible.article] },
      select: {
        id: true,
        kind: true,
        translations: { where: { locale }, select: { title: true, slug: true, excerpt: true } },
      },
    }),
    db.glossaryTerm.findMany({
      where: { AND: [{ id: { in: byType("glossary") } }, visible.glossary] },
      select: {
        id: true,
        translations: {
          where: { locale },
          select: { term: true, slug: true, simpleExplanation: true },
        },
      },
    }),
    db.videoTopic.findMany({
      where: { AND: [{ id: { in: byType("video") } }, visible.video] },
      select: {
        id: true,
        track: true,
        translations: { where: { locale }, select: { title: true, slug: true, summary: true } },
      },
    }),
    db.course.findMany({
      where: { AND: [{ id: { in: byType("course") } }, visible.course] },
      select: {
        id: true,
        track: true,
        translations: { where: { locale }, select: { title: true, slug: true, summary: true } },
      },
    }),
  ]);

  const map = new Map<string, ToolRelatedItem>();
  for (const row of lessons) {
    const tr = row.translations[0];
    const course = row.section?.course;
    const courseSlug = course?.translations[0]?.slug;
    if (!tr?.slug || !courseSlug || !course?.track) continue;
    map.set(`lesson:${row.id}`, {
      targetType: "lesson",
      title: tr.title,
      href: `/learn/${course.track}/${courseSlug}/${tr.slug}`,
      summary: tr.summary,
      feature: "courses",
    });
  }
  for (const row of articles) {
    const tr = row.translations[0];
    if (!tr?.slug) continue;
    map.set(`article:${row.id}`, {
      targetType: "article",
      title: tr.title,
      href: relatedArticleHref(tr.slug),
      summary: tr.excerpt,
      feature: articleFeature(row.kind),
    });
  }
  for (const row of glossary) {
    const tr = row.translations[0];
    if (!tr?.slug) continue;
    map.set(`glossary:${row.id}`, {
      targetType: "glossary",
      title: tr.term,
      href: `/glossary/${tr.slug}`,
      // Rich text (ADR-069) — a card summary is plain, or it prints the tags.
      summary: htmlLead(tr.simpleExplanation),
      feature: "glossary",
    });
  }
  for (const row of videos) {
    const tr = row.translations[0];
    if (!tr?.slug) continue;
    map.set(`video:${row.id}`, {
      targetType: "video",
      title: tr.title,
      href: `/learn/${row.track}/videos/${tr.slug}`,
      summary: tr.summary,
      feature: "videos",
    });
  }
  for (const row of courses) {
    const tr = row.translations[0];
    if (!tr?.slug) continue;
    map.set(`course:${row.id}`, {
      targetType: "course",
      title: tr.title,
      href: `/learn/${row.track}/${tr.slug}`,
      summary: tr.summary,
      feature: "courses",
    });
  }

  // Order restored from the CURATED list, not from the queries: five
  // `findMany`s come back in five arbitrary orders, and the editor's order is
  // the only one that means anything.
  return targets
    .map((target) => map.get(`${target.targetType}:${target.targetId}`))
    .filter((item): item is ToolRelatedItem => item !== undefined);
}

/**
 * The (tool, locale) pairs the sitemap may list (ADR-159 #2): every enabled
 * tool in the default locale, and in another locale once a person has saved
 * its words there. A tool page with no row in a locale still renders (the
 * calculator, a catalog name and a notice — ADR-168), but it is `noindex`
 * and not a page worth submitting.
 */
export async function loadToolSitemapEntries(): Promise<{ key: ToolKey; locale: string }[]> {
  const defaultLocale =
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en";
  const rows = await db.toolTranslation.findMany({
    where: {
      tool: { isEnabled: true },
      OR: [
        { locale: defaultLocale },
        { translationStatus: { in: [...INDEXABLE_TRANSLATION_STATUSES] } },
      ],
    },
    select: { locale: true, tool: { select: { key: true } } },
  });
  return rows.flatMap((row) =>
    isToolKey(row.tool.key) ? [{ key: row.tool.key, locale: row.locale }] : [],
  );
}
