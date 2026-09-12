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
  type SaveToolInput,
  type ToolFaqEntry,
  type ToolKey,
} from "@repo/contracts";
import { db, TranslationStatus, type Prisma } from "@repo/db";
import { computeSourceHash, isTranslationOutdated } from "@repo/i18n";
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
  title: string;
  tagline: string | null;
  intro: string | null;
  body: string | null;
  faq: ToolFaqEntry[];
  seoTitle: string | null;
  seoDescription: string | null;
  coverAssetId: string | null;
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
 * Everything a tool's prose says, in one string, for the source hash.
 *
 * **`faq` is in it — question AND answer of every entry.** ADR-069's rule:
 * an FAQ-only edit must flip sibling translations OUTDATED exactly as a body
 * edit does. The glossary term found this the hard way (its hash covered two
 * of four prose fields, so an example-only edit left translations claiming to
 * be current), and this is the same mistake refused in advance.
 */
function toolSourceMaterial(input: {
  title: string;
  tagline?: string | null;
  intro?: string | null;
  body?: string | null;
  faq?: readonly ToolFaqEntry[] | null;
}): string {
  return [
    input.title,
    input.tagline ?? "",
    input.intro ?? "",
    input.body ?? "",
    ...(input.faq ?? []).flatMap((entry) => [entry.question, entry.answer]),
      // A separator that cannot occur in prose, written as an ESCAPE rather
    // than as a raw byte: a NUL in a source file survives git but not every
    // editor. A space would be wrong — ["a b", "c"] and ["a", "b c"] hash
    // the same, so moving a word from the title into the tagline would leave
    // sibling translations claiming to be current.
  ].join("\u0000");
}

/**
 * One transaction: tool fields, one translation, and the mixed relation set.
 *
 * All three or none — a save that wrote the copy and dropped the related list
 * would leave an editor looking at a screen that disagrees with itself.
 */
export async function saveTool(subject: Subject, input: SaveToolInput): Promise<void> {
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
  };

  const sourceHash = isSource
    ? computeSourceHash(
        toolSourceMaterial({
          title: input.translation.title,
          tagline: input.translation.tagline,
          ...clean,
        }),
      )
    : ((
        await db.toolTranslation.findFirst({
          where: { tool: { key }, locale: defaultLocale },
          select: { sourceHash: true },
        })
      )?.sourceHash ?? null);

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
      seoTitle: input.translation.seoTitle ?? null,
      seoDescription: input.translation.seoDescription ?? null,
      seoFocusKeyword: input.translation.seoFocusKeyword ?? null,
      sourceHash,
      translationStatus: TranslationStatus.TRANSLATED,
    };

    await tx.toolTranslation.upsert({
      where: { toolId_locale: { toolId: tool.id, locale: input.translation.locale } },
      update: translationData,
      create: { toolId: tool.id, locale: input.translation.locale, ...translationData },
    });

    // A source edit flips stale siblings OUTDATED (Module 06's
    // isTranslationOutdated over real rows).
    if (isSource && sourceHash) {
      const siblings = await tx.toolTranslation.findMany({
        where: { toolId: tool.id, locale: { not: defaultLocale } },
        select: { id: true, sourceHash: true },
      });
      const stale = siblings.filter((s) => isTranslationOutdated(sourceHash, s.sourceHash));
      if (stale.length > 0) {
        await tx.toolTranslation.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: { translationStatus: TranslationStatus.OUTDATED },
        });
      }
    }

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

export async function reorderTools(subject: Subject, orderedKeys: readonly string[]): Promise<void> {
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

export interface EnabledTool {
  key: ToolKey;
  title: string;
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

  const rows = await db.tool.findMany({
    where: { isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    include: { translations: { where: { locale }, select: { title: true, tagline: true } } },
  });

  return rows
    .filter((row): row is typeof row & { key: ToolKey } => isToolKey(row.key))
    .map((row) => ({
      key: row.key,
      // A tool with no translation in this locale still has a name: its
      // registry key humanised. An untranslated card is better than a gap.
      title: row.translations[0]?.title ?? row.key,
      tagline: row.translations[0]?.tagline ?? null,
      icon: TOOLS[row.key].icon,
      sortOrder: row.sortOrder,
      coverAssetId: row.coverAssetId,
    }));
}

/** One tool's page, or `null` when it does not exist or is switched off. */
export async function getToolPage(locale: string, key: string): Promise<ToolPageView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 3600 });

  if (!isToolKey(key)) return null;

  const row = await db.tool.findUnique({
    where: { key },
    include: { translations: { where: { locale } } },
  });
  // A disabled tool 404s (ADR-086 #5) — the same `null` an unknown key gets,
  // so the page cannot accidentally distinguish them.
  if (!row || !row.isEnabled) return null;

  const translation = row.translations[0];
  return {
    key,
    title: translation?.title ?? key,
    tagline: translation?.tagline ?? null,
    intro: translation?.intro ?? null,
    body: translation?.body ?? null,
    faq: parseFaq(translation?.faq),
    seoTitle: translation?.seoTitle ?? null,
    seoDescription: translation?.seoDescription ?? null,
    coverAssetId: row.coverAssetId,
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

  const titled = (targetType: string) =>
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
