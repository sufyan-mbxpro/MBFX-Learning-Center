// Public-surface content reads (Module 12). Everything here is cached
// under the `content` tag (writes in content.ts revalidate it) and scoped
// to PUBLISHED + non-deleted — draft content structurally cannot leak to
// the public payload, the same query-level discipline as
// loadPublicSettings (security.md #12).
import { cacheLife, cacheTag } from "next/cache";
import { db, ContentStatus } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";

export interface GlossaryListEntry {
  termId: string;
  term: string;
  slug: string;
  locale: string;
  category: string | null;
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
 * A–Z list for /glossary. Per term, the translation is resolved through
 * the frozen fallback chain — an RTL locale with no translation and no
 * fallbackCode contributes NOTHING for that term (the list simply omits
 * it), never silently-English rows inside an RTL page (ADR-007).
 */
export async function loadPublishedGlossary(locale: string): Promise<GlossaryListEntry[]> {
  const [ctx, terms] = await Promise.all([
    localeContext(),
    db.glossaryTerm.findMany({
      where: { status: ContentStatus.PUBLISHED, deletedAt: null },
      include: { translations: { select: { locale: true, term: true, slug: true } } },
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
      category: term.category,
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
      glossaryTerm: { status: ContentStatus.PUBLISHED, deletedAt: null },
    },
    include: {
      glossaryTerm: {
        include: { translations: true },
      },
    },
  });
  if (!translation) return null;

  const picked = pickTranslation(
    translation.glossaryTerm.translations,
    locale,
    ctx.defaultLocale,
    ctx.locales,
  );

  if (!picked) {
    return {
      termId: translation.termId,
      locale,
      requestedLocaleMissing: true,
      term: translation.term,
      slug: translation.slug,
      simpleExplanation: "",
      detailedExplanation: null,
      seoTitle: null,
      seoDescription: null,
      alternates: translation.glossaryTerm.translations.map((t) => ({
        locale: t.locale,
        slug: t.slug,
      })),
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
    seoTitle: picked.seoTitle,
    seoDescription: picked.seoDescription,
    alternates: translation.glossaryTerm.translations.map((t) => ({
      locale: t.locale,
      slug: t.slug,
    })),
  };
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
    where: { glossaryTerm: { status: ContentStatus.PUBLISHED, deletedAt: null } },
    select: { locale: true, slug: true, updatedAt: true },
  });
  return rows;
}
