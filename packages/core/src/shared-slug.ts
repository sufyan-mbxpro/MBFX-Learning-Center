// One slug per item, shared by every language (ADR-181, changes-60).
//
// A translation row still carries its own `slug` column — every public lookup
// matches (locale, slug), and keeping the column is what lets this be a rule
// about WRITES rather than a rewrite of every read. The rule: the default
// locale's row owns the slug; every other locale's row holds a copy of it.
// So a person never types a slug on a non-English tab, a machine job never
// invents one, and an English rename moves every language with it. The
// header's language switcher only swaps the locale prefix, and with one slug
// that swap always lands on the same item.
import type { Prisma } from "@repo/db";
import { pickTranslationSlug } from "./translation-engine.ts";

/** A translation table that carries a slug: its mapped name and FK column. */
export interface SluggedTable {
  table: string;
  fk: string;
}

/**
 * The slug a NON-default locale's row must carry: the default locale's, run
 * through the engine's collision rule (another item already holding it in
 * this locale appends the locale). Null when the item has no default-locale
 * row yet — the caller then derives one as before, since there is nothing to
 * copy.
 */
export async function sharedSlugFor(
  tx: Prisma.TransactionClient,
  entity: SluggedTable,
  entityId: string,
  locale: string,
  defaultLocale: string,
): Promise<string | null> {
  const rows = await tx.$queryRawUnsafe<{ slug: string }[]>(
    `SELECT slug FROM ${entity.table} WHERE ${entity.fk} = ? AND locale = ? LIMIT 1`,
    entityId,
    defaultLocale,
  );
  const source = rows[0]?.slug;
  if (!source) return null;
  return pickTranslationSlug(tx, entity, entityId, locale, source);
}

export interface SlugMove {
  locale: string;
  previous: string;
  next: string;
}

/**
 * After the default locale's slug was written: copy it onto every other
 * locale's row that does not already hold it. Returns each row that moved so
 * the caller writes its redirects with its own path builder — a path is the
 * module's business, not this file's.
 */
export async function propagateSharedSlug(
  tx: Prisma.TransactionClient,
  entity: SluggedTable,
  entityId: string,
  defaultLocale: string,
  slug: string,
): Promise<SlugMove[]> {
  const siblings = await tx.$queryRawUnsafe<{ locale: string; slug: string }[]>(
    `SELECT locale, slug FROM ${entity.table} WHERE ${entity.fk} = ? AND locale <> ?`,
    entityId,
    defaultLocale,
  );
  const moves: SlugMove[] = [];
  for (const sibling of siblings) {
    if (sibling.slug === slug) continue;
    const next = await pickTranslationSlug(tx, entity, entityId, sibling.locale, slug);
    if (next === sibling.slug) continue;
    await tx.$executeRawUnsafe(
      `UPDATE ${entity.table} SET slug = ? WHERE ${entity.fk} = ? AND locale = ?`,
      next,
      entityId,
      sibling.locale,
    );
    moves.push({ locale: sibling.locale, previous: sibling.slug, next });
  }
  return moves;
}
