// Public-surface content reads (Module 12). Everything here is cached
// under the `content` tag (writes in content.ts revalidate it) and scoped
// to PUBLISHED + non-deleted — draft content structurally cannot leak to
// the public payload, the same query-level discipline as
// loadPublicSettings (security.md #12).
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { htmlToText } from "@repo/utils";
import { scheduledVisibilityOr } from "./content.ts";

export interface GlossaryListEntry {
  termId: string;
  term: string;
  slug: string;
  locale: string;
  /**
   * The topic's NAME and slug, not a free-text category (ADR-055 #12 / D27).
   * Both null when a term is unfiled, which is a legitimate state — a term
   * without a topic still appears in the A–Z browse.
   */
  topicName: string | null;
  topicSlug: string | null;
  /**
   * The track this term is filed under, or NULL for a cross-market term
   * (ADR-065 §3). Null means "appears in every track's glossary", never
   * "unfiled" — that is what `topicSlug` being null means, one field up.
   */
  track: string | null;
  /**
   * Shown INLINE on the A-Z list (changes-11 §9.5) — it is what makes the
   * glossary useful without a click. Carrying it here costs a field per row,
   * not a second query.
   *
   * **PLAIN TEXT, stripped by this loader.** The column is rich text: the
   * admin editor writes `<p>…</p>` into it, so the raw value rendered as a
   * string shows literal tags, and the A–Z browser's client-side search would
   * match on tag names. Both are what this strip prevents. The DETAIL loader
   * keeps the markup — that page renders it as HTML.
   */
  simpleExplanation: string;
}

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
 * The public visibility rule for a glossary term (ADR-071). It was a bare
 * `status: PUBLISHED` in four places here and three more in
 * `glossary-topics.ts`; a term gained a schedule, so the rule needed a name
 * and one definition. The topics module imports it too, so a topic's term
 * COUNT cannot disagree with the terms its page actually lists.
 */
export function publicGlossaryTermWhere(now: Date = new Date()) {
  return { OR: scheduledVisibilityOr(now), deletedAt: null };
}

/**
 * A–Z list for /glossary. Per term, the translation is resolved through
 * the frozen fallback chain — an RTL locale with no translation and no
 * fallbackCode contributes NOTHING for that term (the list simply omits
 * it), never silently-English rows inside an RTL page (ADR-007).
 */
export async function loadPublishedGlossary(locale: string): Promise<GlossaryListEntry[]> {
  const [ctx, terms] = await Promise.all([
    localeContext(),
    db.glossaryTerm.findMany({
      where: publicGlossaryTermWhere(),
      include: {
        translations: {
          select: { locale: true, term: true, slug: true, simpleExplanation: true },
        },
        topic: {
          select: {
            isActive: true,
            translations: { select: { locale: true, name: true, slug: true } },
          },
        },
      },
    }),
  ]);

  const entries: GlossaryListEntry[] = [];
  for (const term of terms) {
    const picked = pickTranslation(term.translations, locale, ctx.defaultLocale, ctx.locales);
    if (!picked) continue;
    entries.push({
      termId: term.id,
      term: picked.term,
      slug: picked.slug,
      locale: picked.locale,
      track: term.track,
      // Resolved through the same fallback chain the term itself uses: a topic
      // name in the wrong language on an RTL page is the bug ADR-007 exists to
      // prevent, one level down. An INACTIVE topic reads as unfiled rather than
      // linking to a page that is switched off.
      ...(() => {
        const topic =
          term.topic && term.topic.isActive
            ? pickTranslation(term.topic.translations, locale, ctx.defaultLocale, ctx.locales)
            : null;
        return { topicName: topic?.name ?? null, topicSlug: topic?.slug ?? null };
      })(),
      simpleExplanation: htmlToText(picked.simpleExplanation),
    });
  }
  return [...entries].sort((a, b) => a.term.localeCompare(b.term, locale));
}

export async function getPublishedGlossary(locale: string): Promise<GlossaryListEntry[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadPublishedGlossary(locale);
}

export interface GlossaryTermView {
  termId: string;
  locale: string;
  requestedLocaleMissing: boolean;
  term: string;
  slug: string;
  simpleExplanation: string;
  detailedExplanation: string | null;
  /** ADR-069: the two bodies that had columns but no write path until the editor landed. */
  advancedExplanation: string | null;
  exampleScenario: string | null;
  faq: { question: string; answer: string }[];
  /** Term-level, so they do NOT vary by locale the way the bodies do. */
  topicName: string | null;
  topicSlug: string | null;
  track: string | null;
  difficulty: string;
  formula: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Every locale that has a translation, for hreflang alternates. */
  alternates: { locale: string; slug: string }[];
}

/**
 * Detail lookup by the LOCALE-SPECIFIC slug. Returns:
 *  - the resolved view (fallback chain applied) when the slug matches a
 *    translation in the requested locale;
 *  - `requestedLocaleMissing: true` when the term exists but the
 *    requested locale's chain yields nothing — the page renders the
 *    "not yet translated" notice (ADR-007), NOT English content;
 *  - null when no published term owns that slug in that locale at all
 *    (the route then consults the Redirect table before 404ing).
 */
export async function loadGlossaryTermBySlug(
  locale: string,
  slug: string,
): Promise<GlossaryTermView | null> {
  const ctx = await localeContext();
  const translation = await db.glossaryTermTranslation.findFirst({
    where: {
      slug,
      locale,
      glossaryTerm: publicGlossaryTermWhere(),
    },
    include: {
      glossaryTerm: {
        include: {
          translations: true,
          // An INACTIVE topic reads as unfiled rather than linking to a page
          // that is switched off — the same rule loadPublishedGlossary applies.
          topic: {
            select: {
              isActive: true,
              translations: { select: { locale: true, name: true, slug: true } },
            },
          },
        },
      },
    },
  });
  if (!translation) return null;

  const term = translation.glossaryTerm;
  const picked = pickTranslation(term.translations, locale, ctx.defaultLocale, ctx.locales);

  const alternates = term.translations.map((t) => ({ locale: t.locale, slug: t.slug }));

  // Resolved through the same fallback chain the body uses: a topic name in
  // the wrong language on an RTL page is the bug ADR-007 exists to prevent,
  // one level down.
  const topic =
    term.topic && term.topic.isActive
      ? pickTranslation(term.topic.translations, locale, ctx.defaultLocale, ctx.locales)
      : null;

  // Term-level fields are the SAME whichever translation was picked, so they
  // are filled in on both branches below — including the untranslated one,
  // where the difficulty badge and the topic link are still true and still
  // useful next to the "not yet translated" notice.
  const meta = {
    topicName: topic?.name ?? null,
    topicSlug: topic?.slug ?? null,
    track: term.track,
    difficulty: term.difficulty as string,
    formula: term.formula,
  };

  if (!picked) {
    return {
      termId: translation.termId,
      locale,
      requestedLocaleMissing: true,
      term: translation.term,
      slug: translation.slug,
      simpleExplanation: "",
      detailedExplanation: null,
      advancedExplanation: null,
      exampleScenario: null,
      faq: [],
      ...meta,
      seoTitle: null,
      seoDescription: null,
      alternates,
    };
  }

  return {
    termId: translation.termId,
    locale: picked.locale,
    requestedLocaleMissing: false,
    term: picked.term,
    slug: picked.slug,
    simpleExplanation: picked.simpleExplanation,
    detailedExplanation: picked.detailedExplanation,
    advancedExplanation: picked.advancedExplanation,
    exampleScenario: picked.exampleScenario,
    faq: readPublicFaq(picked.faq),
    ...meta,
    seoTitle: picked.seoTitle,
    seoDescription: picked.seoDescription,
    alternates,
  };
}

/**
 * `faq` is a `Json?` column, so what comes back is `unknown` and a public page
 * is the worst place to discover that. Anything that is not a `{question,
 * answer}` pair of non-empty strings is dropped: a malformed row renders one
 * fewer question rather than a runtime error on a cached page.
 */
function readPublicFaq(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { question, answer } = item as Record<string, unknown>;
    if (typeof question !== "string" || typeof answer !== "string") return [];
    if (question.trim() === "" || answer.trim() === "") return [];
    return [{ question, answer }];
  });
}

export async function getGlossaryTermBySlug(
  locale: string,
  slug: string,
): Promise<GlossaryTermView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadGlossaryTermBySlug(locale, slug);
}

/** Old-slug handling: the Redirect rows content.ts writes on slug changes. Returns the target path or null. */
export async function lookupRedirect(fromPath: string): Promise<string | null> {
  const row = await db.redirect.findUnique({ where: { fromPath } });
  if (!row || !row.isActive) return null;
  return row.toPath;
}

/** Cached wrapper — redirect rows are written by the same slug edits that revalidate `content`, so they share the tag. */
export async function getRedirect(fromPath: string): Promise<string | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return lookupRedirect(fromPath);
}

/** Sitemap feed: every published translation's locale+slug pair. */
export async function loadGlossarySitemapEntries(): Promise<
  { locale: string; slug: string; updatedAt: Date }[]
> {
  const rows = await db.glossaryTermTranslation.findMany({
    where: { glossaryTerm: publicGlossaryTermWhere() },
    select: { locale: true, slug: true, updatedAt: true },
  });
  return rows;
}

// ─── Term of the day (ADR-055, changes-11 D29) ───────────────

/**
 * A stable-per-day index over a list of length `count`.
 *
 * Deterministic from the DATE alone: every visitor sees the same term on the
 * same day, it changes at midnight UTC, and there is no `featuredOn` column,
 * no cron job and no admin screen behind it (D29). Exported so a test can pin
 * the rotation without reaching through the cached loader.
 *
 * The hash is a small FNV-1a over `YYYY-MM-DD`. It does not need to be
 * cryptographic — it needs to SCATTER consecutive dates, which a plain
 * day-number modulo does not: that walks the list in order and shows the same
 * term on the same weekday-of-cycle forever.
 */
export function termOfTheDayIndex(isoDate: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < isoDate.length; i += 1) {
    hash ^= isoDate.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % count;
}

/**
 * The glossary masthead's featured term.
 *
 * `cacheLife` is a DAILY profile rather than the 5-minute default the other
 * public loaders use: the value only changes at midnight, so re-rendering to
 * produce the same term every five minutes is waste. It still carries the
 * `content` tag, so publishing or unpublishing a term invalidates it at once —
 * a featured term that 404s would otherwise persist for up to a day.
 */
export async function getTermOfTheDay(locale: string): Promise<GlossaryListEntry | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 86_400 });

  const entries = await loadPublishedGlossary(locale);
  if (entries.length === 0) return null;

  // UTC, not local time: the server and the reader can be on different days,
  // and the whole point of D29 is that everyone sees the SAME term.
  const isoDate = new Date().toISOString().slice(0, 10);
  return entries[termOfTheDayIndex(isoDate, entries.length)] ?? null;
}

// ─── Popular terms, topic of the day, related terms (ADR-069) ─

export interface GlossaryTermLink {
  termId: string;
  term: string;
  slug: string;
}

/**
 * The "Popular terms" rail on a term page.
 *
 * Ordered `viewCount DESC, term ASC` — and **nothing increments `viewCount`
 * yet** (ADR-069 §4). That is deliberate, not an oversight: a per-request write
 * on a `"use cache"` page is the wrong shape, and the right one is a batched
 * counter that belongs with analytics. Until it exists every count is 0 and the
 * tie-break makes this strictly alphabetical — stable, honest, and
 * indistinguishable from the reference screen's own alphabetical list.
 *
 * Sorted in memory rather than by SQL `ORDER BY term`: the term lives on the
 * TRANSLATION row and which translation applies is decided by the fallback
 * chain, so the database cannot order by a column it has not picked yet.
 */
export async function loadPopularGlossaryTerms(
  locale: string,
  limit = 8,
): Promise<GlossaryTermLink[]> {
  const entries = await loadPublishedGlossary(locale);
  const byViews = await db.glossaryTerm.findMany({
    where: publicGlossaryTermWhere(),
    select: { id: true, viewCount: true },
  });
  const views = new Map(byViews.map((t) => [t.id, t.viewCount]));

  return [...entries]
    .sort((a, b) => {
      const diff = (views.get(b.termId) ?? 0) - (views.get(a.termId) ?? 0);
      return diff !== 0 ? diff : a.term.localeCompare(b.term, locale);
    })
    .slice(0, limit)
    .map((entry) => ({ termId: entry.termId, term: entry.term, slug: entry.slug }));
}

export async function getPopularGlossaryTerms(
  locale: string,
  limit = 8,
): Promise<GlossaryTermLink[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadPopularGlossaryTerms(locale, limit);
}

/**
 * Terms worth reading next, after this one.
 *
 * Same TOPIC first, then same TRACK, then anything — each tier alphabetical,
 * and the term itself always excluded. The tiers are the honest ranking: two
 * terms under one topic are related by an editor's decision, two under one
 * track only by subject area, and the third tier exists so the rail is never
 * empty on a glossary that has not been filed yet.
 *
 * A cross-market term (`track: null`) is related to everything in the tier
 * sense — ADR-065 §3 — so it matches any track rather than only other nulls.
 */
export async function loadRelatedGlossaryTerms(
  locale: string,
  termId: string,
  limit = 6,
): Promise<GlossaryTermLink[]> {
  const entries = await loadPublishedGlossary(locale);
  const self = entries.find((entry) => entry.termId === termId);
  if (!self) return [];

  const tier = (entry: GlossaryListEntry): number => {
    if (self.topicSlug !== null && entry.topicSlug === self.topicSlug) return 0;
    if (self.track === null || entry.track === null || entry.track === self.track) return 1;
    return 2;
  };

  return entries
    .filter((entry) => entry.termId !== termId)
    .map((entry) => ({ entry, rank: tier(entry) }))
    .sort((a, b) => a.rank - b.rank || a.entry.term.localeCompare(b.entry.term, locale))
    .slice(0, limit)
    .map(({ entry }) => ({ termId: entry.termId, term: entry.term, slug: entry.slug }));
}

export async function getRelatedGlossaryTerms(
  locale: string,
  termId: string,
  limit = 6,
): Promise<GlossaryTermLink[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadRelatedGlossaryTerms(locale, termId, limit);
}
