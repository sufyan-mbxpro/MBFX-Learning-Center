// Glossary topics (changes-11 Phase 10, ADR-055 #12 / D27).
//
// `GlossaryTerm.category` was free text: no slug, no translation, no
// description, no ordering, and no page to link to. It could not support
// "browse by topic", and it broke two rules the repo already holds —
// ADR-044 #5 (a raw identifier never renders) and ADR-043 #1 (public strings
// are translatable). A topic is a real row now.
//
// The model mirrors `ArticleCategory` exactly, which is the whole point: it is
// a proven pattern here, so the admin screens and the public loaders are the
// same shape as the ones an editor already knows.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type Prisma } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { htmlToText } from "@repo/utils";
import type { Subject } from "@repo/rbac";
import { sanitizeRichText, slugify } from "./content.ts";
// One-way edge: public-content.ts does not import this module, so the daily
// rotation primitive is shared rather than duplicated (import-x/no-cycle).
import { publicGlossaryTermWhere, termOfTheDayIndex } from "./public-content.ts";
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

export class TopicInUseError extends Error {
  constructor(termCount: number) {
    super(`This topic still has ${termCount} term(s)`);
    this.name = "TopicInUseError";
  }
}

async function uniqueTopicSlug(locale: string, base: string, topicId: string): Promise<string> {
  const candidate = base || "topic";
  let slug = candidate;
  let suffix = 2;
  for (;;) {
    const clash = await db.glossaryTopicTranslation.findFirst({
      where: { locale, slug, NOT: { topicId } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${candidate}-${suffix}`;
    suffix += 1;
  }
}

// ─── Admin ───────────────────────────────────────────────────

export interface GlossaryTopicAdminRow {
  id: string;
  name: string;
  slug: string;
  /** PLAIN TEXT. `description` is rich text in the database since changes-18
   * PR 3, and a table cell that printed the raw column would show literal tags
   * and let the search box match `<strong>`. ADR-069 recorded exactly this bug
   * for `simpleExplanation`; this is the same fix, applied before it shipped. */
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  termCount: number;
  locales: string[];
  updatedAt: Date;
}

export async function listGlossaryTopics(): Promise<GlossaryTopicAdminRow[]> {
  const { locales, defaultLocale } = await localeContext();
  const rows = await db.glossaryTopic.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      isActive: true,
      sortOrder: true,
      updatedAt: true,
      translations: { select: { locale: true, name: true, slug: true, description: true } },
      _count: { select: { terms: true } },
    },
  });

  return rows.map((row) => {
    const t = pickTranslation(row.translations, defaultLocale, defaultLocale, locales);
    return {
      id: row.id,
      name: t?.name ?? "",
      slug: t?.slug ?? "",
      description: t?.description ? htmlToText(t.description) : null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      termCount: row._count.terms,
      locales: row.translations.map((tr) => tr.locale),
      updatedAt: row.updatedAt,
    };
  });
}

/** One locale's stored topic copy, exactly as the editor should prefill it. */
export interface GlossaryTopicTranslationRow {
  locale: string;
  name: string;
  slug: string;
  /** RAW rich text — this one feeds an editor, so it must not be flattened. */
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

export interface GlossaryTopicAdminDetail {
  id: string;
  isActive: boolean;
  sortOrder: number;
  termCount: number;
  updatedAt: Date;
  /** Every locale that HAS a row. The editor adds the missing ones. */
  translations: GlossaryTopicTranslationRow[];
}

/**
 * Everything the topic editor needs, in one read (changes-18 PR 3).
 *
 * Returns the stored body **unflattened**, which is the whole reason this
 * exists separately from `listGlossaryTopics`: ADR-069's cautionary tale is a
 * loader that did not select the body at all, so the editor seeded every field
 * to `""` and saving a typo fix wiped the definition.
 */
export async function loadGlossaryTopicAdminDetail(
  topicId: string,
): Promise<GlossaryTopicAdminDetail | null> {
  const row = await db.glossaryTopic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      isActive: true,
      sortOrder: true,
      updatedAt: true,
      _count: { select: { terms: true } },
      translations: {
        select: {
          locale: true,
          name: true,
          slug: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    termCount: row._count.terms,
    updatedAt: row.updatedAt,
    translations: row.translations,
  };
}

/**
 * Copy a topic, with every translation, switched OFF (changes-18 PR 5).
 *
 * Inactive rather than active, and for a sharper reason than "drafts are
 * safer": an active copy would appear on `/glossary/topics` immediately, as a
 * second topic named "… (copy)" with no terms in it. `duplicateGlossaryTerm`
 * lands on DRAFT for the same reason — the copy must not be public until
 * someone has looked at it.
 *
 * The terms filed under the source do NOT move or fan out. A term belongs to
 * one topic (`GlossaryTerm.topicId` is a single FK), so "copy the topic with
 * its terms" is not a thing the model can express, and silently re-filing them
 * would empty the original.
 */
export async function duplicateGlossaryTopic(actor: Subject, topicId: string): Promise<string> {
  const source = await db.glossaryTopic.findUniqueOrThrow({
    where: { id: topicId },
    include: { translations: true },
  });

  const copy = await db.glossaryTopic.create({
    data: { isActive: false, sortOrder: source.sortOrder },
    select: { id: true },
  });

  // After the row exists, because `uniqueTopicSlug` excludes a topic id and
  // there is no id to exclude until then. Sequential rather than parallel: two
  // locales resolving at once could both settle on the same free slug.
  for (const t of source.translations) {
    await db.glossaryTopicTranslation.create({
      data: {
        topicId: copy.id,
        locale: t.locale,
        name: `${t.name} (copy)`,
        slug: await uniqueTopicSlug(t.locale, `${t.slug}-copy`, copy.id),
        description: t.description,
        seoTitle: t.seoTitle,
        seoDescription: t.seoDescription,
        seoKeywords: t.seoKeywords,
      },
    });
  }

  await recordAudit({
    userId: actor.id,
    action: "glossary.duplicate",
    entityType: "glossaryTopic",
    entityId: copy.id,
    changes: { after: { sourceTopicId: topicId } },
  });
  revalidateTag("content", { expire: 0 });
  return copy.id;
}

export async function createGlossaryTopic(actor: Subject, name: string): Promise<string> {
  const { defaultLocale } = await localeContext();
  const topic = await db.glossaryTopic.create({ data: {} });
  const slug = await uniqueTopicSlug(defaultLocale, slugify(name), topic.id);

  await db.glossaryTopicTranslation.create({
    data: { topicId: topic.id, locale: defaultLocale, name, slug },
  });

  await recordAudit({
    userId: actor.id,
    action: "glossary.create",
    entityType: "glossaryTopic",
    entityId: topic.id,
    changes: { after: { name } },
  });
  revalidateTag("content", { expire: 0 });
  return topic.id;
}

export interface GlossaryTopicInput {
  topicId: string;
  locale: string;
  name: string;
  slug?: string;
  /** Rich text since changes-18 PR 3 — sanitized here, on save. */
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function saveGlossaryTopic(actor: Subject, input: GlossaryTopicInput): Promise<void> {
  const slug = await uniqueTopicSlug(
    input.locale,
    slugify(input.slug?.trim() || input.name),
    input.topicId,
  );

  const meta: Prisma.GlossaryTopicUpdateInput = {};
  if (input.isActive !== undefined) meta.isActive = input.isActive;
  if (input.sortOrder !== undefined) meta.sortOrder = input.sortOrder;

  const fields = {
    name: input.name,
    slug,
    // security.md #8: sanitized server-side on save, regardless of what the
    // editor claims to have sent. This field became rich text in changes-18
    // PR 3; before that it was a plain caption and needed no gate.
    description: input.description ? sanitizeRichText(input.description) : null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    seoKeywords: input.seoKeywords ?? null,
  };

  await db.$transaction(async (tx) => {
    await tx.glossaryTopic.update({ where: { id: input.topicId }, data: meta });
    await tx.glossaryTopicTranslation.upsert({
      where: { topicId_locale: { topicId: input.topicId, locale: input.locale } },
      update: fields,
      create: { topicId: input.topicId, locale: input.locale, ...fields },
    });
  });

  await recordAudit({
    userId: actor.id,
    action: "glossary.update",
    entityType: "glossaryTopic",
    entityId: input.topicId,
    changes: { after: { locale: input.locale, name: input.name } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Delete a topic — refused while terms are filed under it.
 *
 * The FK is `SetNull`, so the database would happily orphan them; the refusal
 * is a service rule rather than a constraint because the right fix is an
 * editor's decision ("move these first"), not a silent reassignment to nothing.
 * The same shape `deleteSection` uses for a section that still has lessons.
 */
export async function deleteGlossaryTopic(actor: Subject, topicId: string): Promise<void> {
  const count = await db.glossaryTerm.count({ where: { topicId, deletedAt: null } });
  if (count > 0) throw new TopicInUseError(count);

  await db.glossaryTopic.delete({ where: { id: topicId } });
  await recordAudit({
    userId: actor.id,
    action: "glossary.delete",
    entityType: "glossaryTopic",
    entityId: topicId,
  });
  revalidateTag("content", { expire: 0 });
}

export async function reorderGlossaryTopics(actor: Subject, ids: string[]): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.glossaryTopic.update({ where: { id }, data: { sortOrder: index } });
    }
  });
  await recordAudit({
    userId: actor.id,
    action: "glossary.update",
    entityType: "glossaryTopic",
    changes: { after: { order: ids } },
  });
  revalidateTag("content", { expire: 0 });
}

/** Set (or clear) the topic a term is filed under. */
export async function setGlossaryTermTopic(
  actor: Subject,
  termId: string,
  topicId: string | null,
): Promise<void> {
  await db.glossaryTerm.update({ where: { id: termId }, data: { topicId } });
  await recordAudit({
    userId: actor.id,
    action: "glossary.update",
    entityType: "glossaryTerm",
    entityId: termId,
    changes: { after: { topicId } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Set (or clear) the TRACK a term belongs to (ADR-065 §3).
 *
 * Clearing it is not "unfiling" the term — `null` puts it in EVERY track's
 * glossary, which is the right answer for "leverage" and "volatility". That is
 * why this is a separate setter from `setGlossaryTermTopic` above: the two
 * nulls mean opposite things and sharing one function would hide that.
 */
export async function setGlossaryTermTrack(
  actor: Subject,
  termId: string,
  track: string | null,
): Promise<void> {
  await db.glossaryTerm.update({ where: { id: termId }, data: { track } });
  await recordAudit({
    userId: actor.id,
    action: "glossary.update",
    entityType: "glossaryTerm",
    entityId: termId,
    changes: { after: { track } },
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Public ──────────────────────────────────────────────────

export interface GlossaryTopicView {
  id: string;
  slug: string;
  name: string;
  /**
   * PLAIN TEXT, always. The column became rich text in changes-18 PR 3, and
   * this field feeds a line-clamped card and the `<meta name="description">`
   * fallback — both of which would print literal `<p>` tags if handed markup.
   *
   * This is ADR-069's `simpleExplanation` finding applied before it could
   * ship: there, the raw column reached a card and the A–Z search started
   * matching tag names. The topic DETAIL view carries `descriptionHtml`
   * alongside for the one surface that renders it as prose.
   */
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  termCount: number;
}

export interface GlossaryTopicTermView {
  termId: string;
  slug: string;
  term: string;
  definition: string | null;
}

/**
 * Every active topic that has at least one published term.
 *
 * A topic with nothing in it is OMITTED rather than rendered empty — the same
 * rule the learn index applies to a track with no courses (ADR-055 #2), for the
 * same reason: an empty group is a promise the page cannot keep.
 */
export async function loadGlossaryTopics(locale: string): Promise<GlossaryTopicView[]> {
  const { locales, defaultLocale } = await localeContext();
  const rows = await db.glossaryTopic.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      translations: {
        select: {
          locale: true,
          name: true,
          slug: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      _count: {
        select: { terms: { where: publicGlossaryTermWhere() } },
      },
    },
  });

  return rows.flatMap((row) => {
    if (row._count.terms === 0) return [];
    const t = pickTranslation(row.translations, locale, defaultLocale, locales);
    if (!t) return [];
    return [
      {
        id: row.id,
        slug: t.slug,
        name: t.name,
        description: t.description ? htmlToText(t.description) : null,
        seoTitle: t.seoTitle,
        seoDescription: t.seoDescription,
        termCount: row._count.terms,
      },
    ];
  });
}

export async function getGlossaryTopics(locale: string): Promise<GlossaryTopicView[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadGlossaryTopics(locale);
}

export interface GlossaryTopicDetail extends GlossaryTopicView {
  /**
   * The description as stored: rich text, already sanitized on save
   * (security.md #8), for the one surface that renders it as prose. The
   * inherited `description` stays flattened for the meta tag.
   */
  descriptionHtml: string | null;
  terms: GlossaryTopicTermView[];
  /** Per-locale slugs, for hreflang — the same shape the course view uses. */
  alternates: { locale: string; slug: string }[];
}

export async function loadGlossaryTopicBySlug(
  locale: string,
  slug: string,
): Promise<GlossaryTopicDetail | null> {
  const { locales, defaultLocale } = await localeContext();

  const match = await db.glossaryTopicTranslation.findFirst({
    where: { slug, topic: { isActive: true } },
    select: { topicId: true },
  });
  if (!match) return null;

  const topic = await db.glossaryTopic.findFirst({
    where: { id: match.topicId, isActive: true },
    select: {
      id: true,
      translations: {
        select: {
          locale: true,
          name: true,
          slug: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      terms: {
        where: publicGlossaryTermWhere(),
        select: {
          id: true,
          translations: {
            select: { locale: true, term: true, slug: true, simpleExplanation: true },
          },
        },
      },
    },
  });
  if (!topic) return null;

  const t = pickTranslation(topic.translations, locale, defaultLocale, locales);
  if (!t) return null;

  const terms = topic.terms
    .flatMap((term) => {
      const tt = pickTranslation(term.translations, locale, defaultLocale, locales);
      if (!tt) return [];
      // ADR-069: this selected a `definition` column that has never existed in
      // any migration — Phase 10 shipped the line dead, and nothing caught it
      // because a topic page only renders once a topic HAS published terms,
      // which was impossible until the admin could file one. Stripped to plain
      // text for the same reason the A–Z list is: the column is rich text.
      return [
        {
          termId: term.id,
          slug: tt.slug,
          term: tt.term,
          definition: htmlToText(tt.simpleExplanation),
        },
      ];
    })
    // Alphabetical, because a topic page is a reference list and a reader
    // scanning it is looking for a word, not for an editor's ordering.
    .sort((a, b) => a.term.localeCompare(b.term));

  return {
    id: topic.id,
    slug: t.slug,
    name: t.name,
    description: t.description ? htmlToText(t.description) : null,
    descriptionHtml: t.description,
    seoTitle: t.seoTitle,
    seoDescription: t.seoDescription,
    termCount: terms.length,
    terms,
    alternates: topic.translations.map((tr) => ({ locale: tr.locale, slug: tr.slug })),
  };
}

export async function getGlossaryTopicBySlug(
  locale: string,
  slug: string,
): Promise<GlossaryTopicDetail | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadGlossaryTopicBySlug(locale, slug);
}

export interface GlossaryTopicSitemapEntry {
  path: string;
  locale: string;
  updatedAt: Date;
}

export async function loadGlossaryTopicSitemapEntries(): Promise<GlossaryTopicSitemapEntry[]> {
  const rows = await db.glossaryTopicTranslation.findMany({
    where: {
      topic: {
        isActive: true,
        terms: { some: publicGlossaryTermWhere() },
      },
    },
    select: { locale: true, slug: true, updatedAt: true },
  });
  return rows.map((row) => ({
    path: `/glossary/topics/${row.slug}`,
    locale: row.locale,
    updatedAt: row.updatedAt,
  }));
}

/**
 * The masthead's featured TOPIC — `getTermOfTheDay`'s pair, and the card
 * `term-of-the-day.tsx` said it was deferring until topics were a real model.
 *
 * Same rotation primitive, same daily `cacheLife`, and deliberately a
 * DIFFERENT date string (`isoDate + ":topic"`): hashing the same key over two
 * lists of similar length would correlate the two cards, so on any day where
 * both lists happened to align the page would feature a term and the topic it
 * belongs to, which reads as a bug rather than a coincidence.
 */
export async function getTopicOfTheDay(locale: string): Promise<GlossaryTopicView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 86_400 });

  const topics = await loadGlossaryTopics(locale);
  if (topics.length === 0) return null;

  const isoDate = new Date().toISOString().slice(0, 10);
  return topics[termOfTheDayIndex(`${isoDate}:topic`, topics.length)] ?? null;
}
