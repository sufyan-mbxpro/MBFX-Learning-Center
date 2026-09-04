// Content system services (Module 11): status machine, server-side
// sanitization on save (security.md #8 — regardless of editor behavior),
// the translation lifecycle finally wired to Module 06's sourceHash
// primitives, and slug-change → Redirect rows (the SEO-preserving detail
// that's cheap now and painful later).
import { revalidateTag } from "next/cache";
import sanitize from "sanitize-html";
import { db, ContentStatus, TranslationStatus } from "@repo/db";
import { computeSourceHash, isTranslationOutdated } from "@repo/i18n";
import { can, type Subject } from "@repo/rbac";
import { recordAudit } from "./index.ts";

// ─── Status machine ──────────────────────────────────────────

/**
 * Frozen transition map. Notably ABSENT: DRAFT → PUBLISHED (must pass
 * review), anything → APPROVED except SEO_REVIEW, and edits to ARCHIVED
 * except reviving to DRAFT.
 */
export const CONTENT_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: [ContentStatus.IN_REVIEW, ContentStatus.ARCHIVED],
  IN_REVIEW: [ContentStatus.DRAFT, ContentStatus.SEO_REVIEW],
  SEO_REVIEW: [ContentStatus.IN_REVIEW, ContentStatus.APPROVED],
  APPROVED: [ContentStatus.SCHEDULED, ContentStatus.PUBLISHED, ContentStatus.IN_REVIEW],
  SCHEDULED: [ContentStatus.PUBLISHED, ContentStatus.APPROVED],
  PUBLISHED: [ContentStatus.ARCHIVED],
  ARCHIVED: [ContentStatus.DRAFT],
};

export class IllegalTransitionError extends Error {
  constructor(from: ContentStatus, to: ContentStatus) {
    super(`Illegal content transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export class PublishPermissionError extends Error {
  constructor(permission: string) {
    super(`Publishing requires ${permission}`);
    this.name = "PublishPermissionError";
  }
}

export function assertTransition(from: ContentStatus, to: ContentStatus): void {
  if (!CONTENT_TRANSITIONS[from]?.includes(to)) throw new IllegalTransitionError(from, to);
}

const PUBLISHING: ContentStatus[] = [ContentStatus.PUBLISHED, ContentStatus.SCHEDULED];

type ContentEntity = "courses" | "lessons" | "glossary";

const ENTITY_DELEGATE = {
  courses: () => db.course,
  lessons: () => db.lesson,
  glossary: () => db.glossaryTerm,
} as const;

/**
 * One transition function for the three content entities: the machine is
 * identical, only the delegate and the publish-permission key differ.
 * Publishing (→ PUBLISHED/SCHEDULED) requires the entity's `*.publish`
 * permission ON TOP of whatever the calling action already required.
 */
export async function transitionContentStatus(
  actor: Subject,
  entity: ContentEntity,
  entityId: string,
  to: ContentStatus,
): Promise<void> {
  if (PUBLISHING.includes(to) && !can(actor, `${entity}.publish`)) {
    throw new PublishPermissionError(`${entity}.publish`);
  }

  const delegate = ENTITY_DELEGATE[entity]() as unknown as {
    findUniqueOrThrow: (args: unknown) => Promise<{ status: ContentStatus }>;
    update: (args: unknown) => Promise<unknown>;
  };
  const current = await delegate.findUniqueOrThrow({
    where: { id: entityId },
    select: { status: true },
  });
  assertTransition(current.status, to);

  await delegate.update({
    where: { id: entityId },
    data: {
      status: to,
      ...(to === ContentStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
    },
  });
  await recordAudit({
    userId: actor.id,
    action: `${entity}.transition`,
    entityType: entity,
    entityId,
    changes: { before: { status: current.status }, after: { status: to } },
  });
  revalidateTag("content", { expire: 0 });
}

// ─── Sanitization (security.md #8) ───────────────────────────

/**
 * Server-side, on SAVE, regardless of what the editor claims to have done.
 * Allows the rich-text vocabulary Tiptap emits (ADR-009); strips scripts,
 * styles, event handlers, javascript: URLs — the XSS regression suite
 * pins this.
 */
export function sanitizeRichText(html: string): string {
  return sanitize(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "hr",
      "blockquote",
      "pre",
      "code",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      span: ["class"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // No inline styles at all — styling is the theme engine's job.
    allowedStyles: {},
  });
}

// ─── Slugs & redirects ───────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

/** Public path for a glossary term, locale-prefix per routing's as-needed rule. Module 12 renders these URLs; this is the one place their shape lives. */
export function glossaryTermPath(locale: string, defaultLocale: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/glossary/${slug}`;
}

async function createSlugRedirect(
  fromPath: string,
  toPath: string,
  actorId: string,
): Promise<void> {
  if (fromPath === toPath) return;
  await db.redirect.upsert({
    where: { fromPath },
    update: { toPath, isActive: true },
    create: { fromPath, toPath, statusCode: 301, createdBy: actorId },
  });
}

// ─── Glossary translations — the full lifecycle in one entity ─

export interface SaveGlossaryTranslationInput {
  termId: string;
  locale: string;
  term: string;
  slug?: string;
  simpleExplanation: string;
  detailedExplanation?: string | null;
}

/**
 * The translation lifecycle, wired end to end (Module 06's primitives
 * finally get their write path):
 *  - rich text sanitized server-side on save;
 *  - saving the DEFAULT locale recomputes the source hash and flips every
 *    sibling translation whose stored hash no longer matches → OUTDATED;
 *  - saving a NON-default locale stamps the current source hash and marks
 *    the row TRANSLATED;
 *  - a slug change writes a 301 Redirect row for the old public path.
 */
export async function saveGlossaryTranslation(
  actor: Subject,
  input: SaveGlossaryTranslationInput,
): Promise<void> {
  const defaultLocale =
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en";

  const clean = {
    simpleExplanation: sanitizeRichText(input.simpleExplanation),
    detailedExplanation: input.detailedExplanation
      ? sanitizeRichText(input.detailedExplanation)
      : null,
  };
  const slug = slugify(input.slug?.trim() || input.term);
  const isSource = input.locale === defaultLocale;

  const existing = await db.glossaryTermTranslation.findUnique({
    where: { termId_locale: { termId: input.termId, locale: input.locale } },
  });

  const sourceHash = isSource
    ? computeSourceHash(clean.simpleExplanation + (clean.detailedExplanation ?? ""))
    : await currentGlossarySourceHash(input.termId, defaultLocale);

  await db.glossaryTermTranslation.upsert({
    where: { termId_locale: { termId: input.termId, locale: input.locale } },
    update: {
      term: input.term,
      slug,
      ...clean,
      sourceHash,
      translationStatus: TranslationStatus.TRANSLATED,
    },
    create: {
      termId: input.termId,
      locale: input.locale,
      term: input.term,
      slug,
      ...clean,
      sourceHash,
      translationStatus: TranslationStatus.TRANSLATED,
    },
  });

  // Slug change → 301 from the old public path (SEO-preserving detail).
  if (existing && existing.slug !== slug) {
    await createSlugRedirect(
      glossaryTermPath(input.locale, defaultLocale, existing.slug),
      glossaryTermPath(input.locale, defaultLocale, slug),
      actor.id,
    );
  }

  // Source edit → flip stale siblings OUTDATED (Module 06's
  // isTranslationOutdated, applied to real rows).
  if (isSource) {
    const siblings = await db.glossaryTermTranslation.findMany({
      where: { termId: input.termId, locale: { not: defaultLocale } },
      select: { id: true, sourceHash: true },
    });
    const stale = siblings.filter((s) => isTranslationOutdated(sourceHash!, s.sourceHash));
    if (stale.length > 0) {
      await db.glossaryTermTranslation.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { translationStatus: TranslationStatus.OUTDATED },
      });
    }
  }

  await recordAudit({
    userId: actor.id,
    action: "glossary.saveTranslation",
    entityType: "glossaryTermTranslation",
    entityId: `${input.termId}:${input.locale}`,
    changes: { after: { term: input.term, slug, locale: input.locale } },
  });
  revalidateTag("content", { expire: 0 });
}

async function currentGlossarySourceHash(
  termId: string,
  defaultLocale: string,
): Promise<string | null> {
  const source = await db.glossaryTermTranslation.findUnique({
    where: { termId_locale: { termId, locale: defaultLocale } },
    select: { simpleExplanation: true, detailedExplanation: true },
  });
  if (!source) return null;
  return computeSourceHash(source.simpleExplanation + (source.detailedExplanation ?? ""));
}

/** The admin's translation work queue: everything flipped OUTDATED by a source edit. */
export async function listOutdatedGlossaryTranslations(): Promise<
  { termId: string; locale: string; term: string }[]
> {
  const rows = await db.glossaryTermTranslation.findMany({
    where: { translationStatus: TranslationStatus.OUTDATED },
    select: { termId: true, locale: true, term: true },
    orderBy: { updatedAt: "asc" },
  });
  return rows;
}

// ─── Soft delete / restore ───────────────────────────────────

export async function setGlossaryTermDeleted(
  actor: Subject,
  termId: string,
  deleted: boolean,
): Promise<void> {
  await db.glossaryTerm.update({
    where: { id: termId },
    data: { deletedAt: deleted ? new Date() : null },
  });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "glossary.softDelete" : "glossary.restore",
    entityType: "glossaryTerm",
    entityId: termId,
  });
  revalidateTag("content", { expire: 0 });
}

export interface GlossaryAdminRow {
  id: string;
  status: ContentStatus;
  deletedAt: Date | null;
  term: string | null;
  slug: string | null;
  locales: { locale: string; translationStatus: TranslationStatus }[];
  legalTransitions: ContentStatus[];
}

export async function loadGlossaryAdminList(): Promise<GlossaryAdminRow[]> {
  const rows = await db.glossaryTerm.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      translations: {
        select: { locale: true, term: true, slug: true, translationStatus: true },
      },
    },
  });
  return rows.map((row) => {
    const en = row.translations.find((t) => t.locale === "en");
    return {
      id: row.id,
      status: row.status,
      deletedAt: row.deletedAt,
      term: en?.term ?? null,
      slug: en?.slug ?? null,
      locales: row.translations.map((t) => ({
        locale: t.locale,
        translationStatus: t.translationStatus,
      })),
      legalTransitions: CONTENT_TRANSITIONS[row.status],
    };
  });
}

export async function createGlossaryTerm(actor: Subject, category?: string): Promise<string> {
  const term = await db.glossaryTerm.create({ data: { category, authorId: actor.id } });
  await recordAudit({
    userId: actor.id,
    action: "glossary.create",
    entityType: "glossaryTerm",
    entityId: term.id,
  });
  return term.id;
}
