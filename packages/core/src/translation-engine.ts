// The machine-translation engine for every entity type (Phase 5, ADR-161/162).
//
// `article-translation.ts` wrote the protocol out once, by hand. Every other
// translatable entity follows the same one, so it lives here and each entity
// declares only what is particular to it — its translation table, the English
// source it reads, the segments it sends and how a result is written back:
//
//   1. Read the English source NOW (a job carries no content).
//   2. Decide from the target row's STATUS: a person's row (TRANSLATED,
//      OUTDATED, NEEDS_REVIEW, DRAFT) is never overwritten; a TRANSLATED row
//      whose source moved becomes OUTDATED and nothing else happens (ADR-161).
//   3. Translate OUTSIDE any transaction: Google can take seconds.
//   4. Write inside a short ReadCommitted transaction that locks the source
//      row, re-hashes it and re-reads the target (ADR-162 #5). A source that
//      moved means "requeue"; a person who saved meanwhile wins.
//   5. A figure that changed is written NEEDS_REVIEW (ADR-160 #8).
//
// The same declaration derives the backfill walk, the coverage counts, the
// pre-flight estimate and the review rows (ADR-163 #6), with SQL built from
// identifiers the declaration names. Those identifiers are CODE constants,
// never input, and `defineTranslatable` refuses any that is not a plain name.
import { TranslationStatus, db, type Prisma } from "@repo/db";
import {
  numbersMatch,
  translateHtmlMany,
  translateTexts,
  type JobHandler,
  type JobOutcome,
} from "@repo/translate";

import { fitTo, loadGlossaryPairs } from "./article-translation.ts";
import { sanitizeRichText } from "./content.ts";
import type { CoverageCounts } from "./translation-coverage.ts";
import { toCoverage } from "./translation-coverage.ts";
import type { ReviewRow, ReviewStatus, TranslatableType } from "./translatable-types.ts";

type Client = Prisma.TransactionClient | typeof db;

/**
 * One piece of text to translate. `text` is plain; `html` is rich text, sent
 * with glossary substitution and sanitized on the way back (security.md #8).
 * `max` is the column width a plain result is fitted to.
 */
export type Segment =
  | { key: string; kind: "text"; text: string; max?: number }
  | { key: string; kind: "html"; text: string };

/** What `write` receives: the translation of each segment, by key. */
export type Translated = Readonly<Record<string, string>>;

export interface WriteArgs<S> {
  entityId: string;
  locale: string;
  source: S;
  translated: Translated;
  status: TranslationStatus;
  hash: string;
  /** Whether a (machine) row exists already: update it rather than create. */
  exists: boolean;
}

export interface TranslatableEntity<S> {
  entityType: string;
  /** The translation table (snake_case, as mapped) and its FK column. */
  table: string;
  fk: string;
  /** The entity's own table, for "is it still live". */
  parentTable: string;
  /** Extra condition on `p` (the parent row), e.g. `p.deletedAt IS NULL`. */
  parentWhere?: string;
  /** The column a review row shows as its title. */
  titleColumn: string;
  /** Absent on the few tables without one (menu items, sections). */
  updatedAtColumn?: string;
  loadSource: (client: Client, entityId: string, defaultLocale: string) => Promise<S | null>;
  hash: (source: S) => string;
  segments: (source: S) => Segment[];
  write: (tx: Prisma.TransactionClient, args: WriteArgs<S>) => Promise<void>;
  /**
   * Locks the English source inside the write transaction, so a save of it
   * waits for this write. Default: its row in the translation table. A type
   * whose English lives elsewhere (a setting's is `settings.value`, ADR-165 #7)
   * locks that row instead.
   */
  lockSource?: (
    tx: Prisma.TransactionClient,
    entityId: string,
    defaultLocale: string,
  ) => Promise<void>;
  /**
   * A check beside the number check: false writes the result NEEDS_REVIEW
   * (ADR-160 #8). A setting's `{year}` token is the case (ADR-165 #8).
   */
  acceptResult?: (segments: readonly Segment[], translated: Translated) => boolean;
  /**
   * Runs after a write COMMITS. For a cache tag the runner's per-batch
   * revalidation does not cover — dropping it inside the transaction would let
   * a request refill the cache from the row before the write is visible.
   */
  afterWrite?: (entityId: string, source: S) => void | Promise<void>;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PARENT_WHERE = /^[A-Za-z0-9_ .=<>'()]*$/;

async function defaultLocaleCode(client: Client = db): Promise<string> {
  return (
    (await client.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/** Every text a source or its translation carries, for the number check. */
function joined(segments: readonly Segment[], values?: Translated): string {
  return segments.map((s) => (values ? (values[s.key] ?? "") : s.text)).join("\n");
}

/** Characters a translation of these segments would send (blank ones skipped). */
export function segmentCharacters(segments: readonly Segment[]): number {
  return segments.reduce((sum, s) => sum + (s.text.trim() === "" ? 0 : s.text.length), 0);
}

/**
 * Translates segments: plain ones in one call, rich ones in another with the
 * glossary substituted (ADR-160 #9). Rich results are sanitized, plain ones
 * fitted to their column. A blank source stays blank.
 */
export async function translateSegmentsFor(
  segments: readonly Segment[],
  options: { entityType: string; entityId: string; source: string; target: string },
): Promise<Record<string, string>> {
  const text = segments.filter((s) => s.kind === "text");
  const html = segments.filter((s) => s.kind === "html");
  const call = {
    source: options.source,
    target: options.target,
    entity: { type: options.entityType, id: options.entityId },
  };
  const glossary = html.length > 0 ? await loadGlossaryPairs(options.target, options.source) : [];
  const [texts, htmls] = await Promise.all([
    text.length > 0
      ? translateTexts(
          text.map((s) => s.text),
          call,
        )
      : Promise.resolve([]),
    html.length > 0
      ? translateHtmlMany(
          html.map((s) => s.text),
          { ...call, glossary },
        )
      : Promise.resolve([]),
  ]);

  const out: Record<string, string> = {};
  text.forEach((segment, index) => {
    const value = segment.text.trim() === "" ? "" : (texts[index] ?? "");
    out[segment.key] = segment.max ? fitTo(value, segment.max) : value;
  });
  html.forEach((segment, index) => {
    out[segment.key] = segment.text.trim() === "" ? "" : sanitizeRichText(htmls[index] ?? "");
  });
  return out;
}

/**
 * A slug for a machine-created row (ADR-161 #6): the English one, unless
 * another entity already holds it in this locale — then the locale, then a
 * piece of the id, is appended. Never transliterated.
 */
export async function pickTranslationSlug(
  tx: Prisma.TransactionClient,
  entity: { table: string; fk: string },
  entityId: string,
  locale: string,
  slug: string,
): Promise<string> {
  const candidates = [slug, `${slug}-${locale}`, `${slug}-${locale}-${entityId.slice(-6)}`];
  for (const candidate of candidates) {
    const rows = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM ${entity.table} WHERE locale = ? AND slug = ? AND ${entity.fk} <> ? LIMIT 1`,
      locale,
      candidate,
      entityId,
    );
    if (rows.length === 0) return candidate;
  }
  return `${slug}-${entityId}`;
}

interface TargetState {
  status: TranslationStatus;
  sourceHash: string | null;
}

/**
 * The job handler: ADR-161's rules and ADR-162 #5's conditional write.
 * Exported for a type that writes its own walk, counts and review rows but
 * must not write its own protocol (settings, ADR-165 #7).
 */
export function translationJobHandler<S>(entity: TranslatableEntity<S>): JobHandler {
  const { table, fk } = entity;
  const readTarget = async (client: Client, entityId: string, locale: string, lock: boolean) => {
    const rows = await client.$queryRawUnsafe<
      Array<{ translationStatus: TranslationStatus; sourceHash: string | null }>
    >(
      `SELECT translationStatus, sourceHash FROM ${table} WHERE ${fk} = ? AND locale = ?${lock ? " FOR UPDATE" : ""}`,
      entityId,
      locale,
    );
    const row = rows[0];
    return row
      ? ({ status: row.translationStatus, sourceHash: row.sourceHash } as TargetState)
      : null;
  };

  return async (job): Promise<JobOutcome> => {
    const defaultLocale = await defaultLocaleCode();
    if (job.locale === defaultLocale) return "done";

    const source = await entity.loadSource(db, job.entityId, defaultLocale);
    if (!source) return "done";
    const hash = entity.hash(source);

    const target = await readTarget(db, job.entityId, job.locale, false);
    if (target && target.status !== TranslationStatus.MACHINE_TRANSLATED) {
      if (target.status === TranslationStatus.TRANSLATED && target.sourceHash !== hash) {
        await db.$executeRawUnsafe(
          `UPDATE ${table} SET translationStatus = 'OUTDATED'
            WHERE ${fk} = ? AND locale = ? AND translationStatus = 'TRANSLATED'`,
          job.entityId,
          job.locale,
        );
      }
      return "done";
    }
    if (target && target.sourceHash === hash) return "done";

    const segments = entity.segments(source);
    const translated = await translateSegmentsFor(segments, {
      entityType: entity.entityType,
      entityId: job.entityId,
      source: defaultLocale,
      target: job.locale,
    });
    const status =
      numbersMatch(joined(segments), joined(segments, translated)) &&
      (entity.acceptResult?.(segments, translated) ?? true)
        ? TranslationStatus.MACHINE_TRANSLATED
        : TranslationStatus.NEEDS_REVIEW;

    let written: S | null = null;
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          // Lock the source so a save of it waits for this write; its
          // enqueue then finds the job RUNNING and marks it `rerun`.
          if (entity.lockSource) {
            await entity.lockSource(tx, job.entityId, defaultLocale);
          } else {
            await tx.$queryRawUnsafe(
              `SELECT id FROM ${table} WHERE ${fk} = ? AND locale = ? FOR UPDATE`,
              job.entityId,
              defaultLocale,
            );
          }
          const current = await entity.loadSource(tx, job.entityId, defaultLocale);
          if (!current) return "done" as const;
          if (entity.hash(current) !== hash) return "requeue" as const;

          const existing = await readTarget(tx, job.entityId, job.locale, true);
          if (existing && existing.status !== TranslationStatus.MACHINE_TRANSLATED) {
            return "done" as const; // a person saved it while we translated
          }
          await entity.write(tx, {
            entityId: job.entityId,
            locale: job.locale,
            source: current,
            translated,
            status,
            hash,
            exists: existing !== null,
          });
          written = current;
          return "done" as const;
        },
        { isolationLevel: "ReadCommitted" },
      );
      if (written !== null) await entity.afterWrite?.(job.entityId, written);
      return outcome;
    } catch (error) {
      // A person created the row between our read and our insert: theirs wins.
      if (isUniqueViolation(error) && (await readTarget(db, job.entityId, job.locale, false))) {
        return "done";
      }
      throw error;
    }
  };
}

const REVIEW_STATUSES: readonly ReviewStatus[] = ["MACHINE_TRANSLATED", "OUTDATED", "NEEDS_REVIEW"];

/**
 * Turns an entity declaration into the registry entry the queue and the
 * dashboard read (`TRANSLATABLE_TYPES`).
 */
export function defineTranslatable<S>(entity: TranslatableEntity<S>): TranslatableType {
  for (const name of [
    entity.table,
    entity.fk,
    entity.parentTable,
    entity.titleColumn,
    entity.updatedAtColumn ?? "id",
  ]) {
    if (!IDENT.test(name)) throw new Error(`defineTranslatable: bad identifier ${name}`);
  }
  if (entity.parentWhere && !PARENT_WHERE.test(entity.parentWhere)) {
    throw new Error(`defineTranslatable: bad parentWhere for ${entity.entityType}`);
  }
  const { table, fk, parentTable } = entity;
  const live = `JOIN ${parentTable} p ON p.id = e.${fk}${entity.parentWhere ? ` AND ${entity.parentWhere}` : ""}`;

  const page = async (after: string | null, take: number, defaultLocale: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT e.${fk} AS id FROM ${table} e ${live}
        WHERE e.locale = ?${after ? ` AND e.${fk} > ?` : ""}
        ORDER BY e.${fk} LIMIT ?`,
      ...(after ? [defaultLocale, after, take] : [defaultLocale, take]),
    );
    return rows.map((row) => row.id);
  };

  return {
    entityType: entity.entityType,
    handler: translationJobHandler(entity),
    page,

    async coverage(locale, defaultLocale): Promise<CoverageCounts> {
      const [totalRows, groups] = await Promise.all([
        db.$queryRawUnsafe<Array<{ c: bigint | number }>>(
          `SELECT COUNT(*) AS c FROM ${table} e ${live} WHERE e.locale = ?`,
          defaultLocale,
        ),
        db.$queryRawUnsafe<Array<{ s: TranslationStatus; c: bigint | number }>>(
          `SELECT t.translationStatus AS s, COUNT(*) AS c
             FROM ${table} t
             JOIN ${table} e ON e.${fk} = t.${fk} AND e.locale = ?
             ${live}
            WHERE t.locale = ?
            GROUP BY t.translationStatus`,
          defaultLocale,
          locale,
        ),
      ]);
      return toCoverage(
        Number(totalRows[0]?.c ?? 0),
        groups.map((g) => ({ status: g.s, count: Number(g.c) })),
      );
    },

    async estimate(locales, defaultLocale) {
      const totals = new Map(locales.map((locale) => [locale, 0]));
      if (locales.length === 0) return totals;
      let after: string | null = null;
      for (;;) {
        const ids = await page(after, 100, defaultLocale);
        if (ids.length === 0) break;
        after = ids[ids.length - 1]!;
        const targets = await db.$queryRawUnsafe<
          Array<{ id: string; locale: string; s: TranslationStatus; h: string | null }>
        >(
          `SELECT ${fk} AS id, locale, translationStatus AS s, sourceHash AS h FROM ${table}
            WHERE ${fk} IN (${ids.map(() => "?").join(", ")})
              AND locale IN (${locales.map(() => "?").join(", ")})`,
          ...ids,
          ...locales,
        );
        const targetOf = new Map(targets.map((t) => [`${t.id}:${t.locale}`, t]));
        for (const id of ids) {
          const source = await entity.loadSource(db, id, defaultLocale);
          if (!source) continue;
          const characters = segmentCharacters(entity.segments(source));
          const hash = entity.hash(source);
          for (const locale of locales) {
            const target = targetOf.get(`${id}:${locale}`);
            const wouldTranslate =
              !target || (target.s === TranslationStatus.MACHINE_TRANSLATED && target.h !== hash);
            if (wouldTranslate) totals.set(locale, (totals.get(locale) ?? 0) + characters);
          }
        }
        if (ids.length < 100) break;
      }
      return totals;
    },

    async review({ locale, defaultLocale, take }): Promise<ReviewRow[]> {
      const updated = entity.updatedAtColumn ? `t.${entity.updatedAtColumn}` : "NULL";
      const rows = await db.$queryRawUnsafe<
        Array<{
          entityId: string;
          locale: string;
          status: ReviewStatus;
          title: string | null;
          sourceTitle: string | null;
          updatedAt: Date | null;
        }>
      >(
        `SELECT t.${fk} AS entityId, t.locale AS locale, t.translationStatus AS status,
                t.${entity.titleColumn} AS title, e.${entity.titleColumn} AS sourceTitle,
                ${updated} AS updatedAt
           FROM ${table} t
           JOIN ${table} e ON e.${fk} = t.${fk} AND e.locale = ?
           ${live}
          WHERE t.translationStatus IN (${REVIEW_STATUSES.map(() => "?").join(", ")})
            AND ${locale ? "t.locale = ?" : "t.locale <> ?"}
          ORDER BY ${entity.updatedAtColumn ? `t.${entity.updatedAtColumn} DESC` : `t.${fk}`}
          LIMIT ?`,
        defaultLocale,
        ...REVIEW_STATUSES,
        locale ?? defaultLocale,
        take,
      );
      return rows.map((row) => ({
        entityType: entity.entityType,
        entityId: row.entityId,
        locale: row.locale,
        status: row.status,
        // A promotion linked to site content may have no title of its own
        // (it borrows the target's), so the column can be NULL.
        title: row.title ?? row.sourceTitle ?? "",
        sourceTitle: row.sourceTitle,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      }));
    },
  };
}
