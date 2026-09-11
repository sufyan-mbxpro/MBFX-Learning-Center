// Content system services (Module 11): status machine, server-side
// sanitization on save (security.md #8 — regardless of editor behavior),
// the translation lifecycle finally wired to Module 06's sourceHash
// primitives, and slug-change → Redirect rows (the SEO-preserving detail
// that's cheap now and painful later).
import { revalidateTag } from "next/cache";
import sanitize from "sanitize-html";
import { db, ContentStatus, TranslationStatus, type Difficulty, type Prisma } from "@repo/db";
import { isReservedGlossarySlug, type GlossaryFaqItemInput } from "@repo/contracts";
import { computeSourceHash, isTranslationOutdated } from "@repo/i18n";
import { can, type Subject } from "@repo/rbac";
import { parseVideoEmbedUrl, slugify } from "@repo/utils";
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

export class ReservedGlossarySlugError extends Error {
  constructor(slug: string) {
    super(`"${slug}" is a reserved glossary path`);
    this.name = "ReservedGlossarySlugError";
  }
}

export class PublishPermissionError extends Error {
  constructor(permission: string) {
    super(`Publishing requires ${permission}`);
    this.name = "PublishPermissionError";
  }
}

/**
 * Defined HERE rather than in `articles.ts`, where it started life, because
 * ADR-071 gives every content entity the schedule that only articles had.
 * `articles.ts` re-exports the name, so no caller changed.
 */
export class ScheduleInPastError extends Error {
  constructor() {
    super("Scheduled time must be in the future");
    this.name = "ScheduleInPastError";
  }
}

export function assertTransition(from: ContentStatus, to: ContentStatus): void {
  if (!CONTENT_TRANSITIONS[from]?.includes(to)) throw new IllegalTransitionError(from, to);
}

const PUBLISHING: ContentStatus[] = [ContentStatus.PUBLISHED, ContentStatus.SCHEDULED];

// ─── Scheduled visibility (ADR-071) ──────────────────────────

/**
 * The half of scheduling that actually makes it work: a row is public when it
 * is PUBLISHED, **or** when it is SCHEDULED and its time has come. Visibility
 * is therefore decided by the query, not by a job — a sweep that is late,
 * failed or never configured delays nothing, and `publishDueContent` is only
 * tidying up afterwards.
 *
 * `now` is required HERE and defaulted on the `public*Where` helpers that wrap
 * it, which matches what articles have always done: the loader computes
 * `const now = new Date()` and the loader runs inside a `"use cache"` wrapper,
 * so `now` is frozen for that cache entry either way. **The freeze is bounded
 * by `cacheLife`, not by the signature** — five minutes on every reader
 * involved, which is the punctuality floor ADR-015 #6 accepted and ADR-071
 * inherited.
 */
export function scheduledVisibilityOr(now: Date) {
  return [
    { status: ContentStatus.PUBLISHED },
    { status: ContentStatus.SCHEDULED, scheduledFor: { lte: now } },
  ];
}

/**
 * A due-but-unswept SCHEDULED row has no `publishedAt` yet, and its honest
 * publish time is the one it was promised. Every surface that renders a
 * publish time reads it through here. Started as `public-articles.ts`'s;
 * shared since ADR-071 gave the other five entities a schedule.
 */
export function effectivePublishedAt(row: {
  publishedAt: Date | null;
  scheduledFor: Date | null;
}): Date | null {
  return row.publishedAt ?? row.scheduledFor;
}

type ContentEntity = "courses" | "lessons" | "glossary" | "quizzes" | "videos";

const ENTITY_DELEGATE = {
  courses: () => db.course,
  lessons: () => db.lesson,
  glossary: () => db.glossaryTerm,
  quizzes: () => db.quiz,
  videos: () => db.videoTopic,
} as const;

/**
 * The permission key each entity publishes under.
 *
 * It was `${entity}.publish` until quizzes arrived, and quizzes are the reason
 * this map exists: ADR-058 #8 gates them on the LESSON keys, because there are
 * no `quizzes.*` keys in the seed registry and `changes-11-plan.md` §18 rule #3
 * forbids adding any. Interpolating the entity name would have looked for
 * `quizzes.publish`, which no role can hold, and every quiz publish would have
 * failed with a key that does not exist — the exact silent-403 bug
 * `check:permission-keys` was written to catch.
 *
 * The named cost is in the ADR: quiz authorship cannot be granted independently
 * of lesson authorship, and a `quizzes.*` group is the additive fix if that
 * ever matters.
 */
const ENTITY_PUBLISH_PERMISSION: Record<ContentEntity, string> = {
  courses: "courses.publish",
  lessons: "lessons.publish",
  glossary: "glossary.publish",
  quizzes: "lessons.publish",
  // ADR-068 §3 — the THIRD entity to publish on the lesson keys, after quizzes
  // and for the same reason: there are no `videos.*` keys in the seed registry
  // and adding five with no seeded role behind them is a silent 403 waiting to
  // happen. The named cost is that video authorship cannot be granted apart
  // from lesson authorship; this map is the one line that fixes it if it ever
  // matters.
  videos: "lessons.publish",
};

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
  scheduledFor?: Date,
): Promise<void> {
  const publishPermission = ENTITY_PUBLISH_PERMISSION[entity];
  if (PUBLISHING.includes(to) && !can(actor, publishPermission)) {
    throw new PublishPermissionError(publishPermission);
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

  // ADR-071 — the same rule articles have enforced since Module 15. A
  // SCHEDULED row with no future date is the parked state this ADR exists to
  // end, so it is refused at the service rather than defaulted to "now".
  if (to === ContentStatus.SCHEDULED && (!scheduledFor || scheduledFor.getTime() <= Date.now())) {
    throw new ScheduleInPastError();
  }

  await delegate.update({
    where: { id: entityId },
    data: {
      status: to,
      ...(to === ContentStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      // A schedule survives ONLY a move that is itself a schedule: PUBLISHED
      // has happened, and every other destination has called it off. The
      // article machine writes this as "clear on PUBLISHED and DRAFT" because
      // those are the only two moves out of SCHEDULED it has. The seven-state
      // machine also allows SCHEDULED → APPROVED, so enumerating destinations
      // left that one row carrying a date that would never fire — which the
      // editor's panel renders verbatim as "Scheduled: …" on an APPROVED row.
      scheduledFor: to === ContentStatus.SCHEDULED ? (scheduledFor ?? null) : null,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: `${entity}.transition`,
    entityType: entity,
    entityId,
    changes: {
      before: { status: current.status },
      after: { status: to, ...(scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}) },
    },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * Flip due SCHEDULED rows → PUBLISHED across all five content entities
 * (ADR-071 #3), mirroring `publishDueArticles`. Public visibility does NOT
 * depend on this running — `scheduledVisibilityOr` already treats a due row as
 * live — so this is bookkeeping: it makes `status` tell the truth and stamps
 * `publishedAt` with the PROMISED time rather than the sweep's, which is the
 * detail that keeps "published at" honest for a sweep that ran late.
 *
 * Audited with `userId: null`, the convention `publishDueArticles` set for a
 * system action with no subject behind it.
 */
export async function publishDueContent(now: Date = new Date()): Promise<number> {
  let total = 0;
  for (const entity of Object.keys(ENTITY_DELEGATE) as ContentEntity[]) {
    const delegate = ENTITY_DELEGATE[entity]() as unknown as {
      findMany: (args: unknown) => Promise<{ id: string; scheduledFor: Date | null }[]>;
      update: (args: unknown) => Promise<unknown>;
    };
    const due = await delegate.findMany({
      where: { status: ContentStatus.SCHEDULED, scheduledFor: { lte: now }, deletedAt: null },
      select: { id: true, scheduledFor: true },
    });
    if (due.length === 0) continue;

    for (const row of due) {
      await delegate.update({
        where: { id: row.id },
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: row.scheduledFor,
          scheduledFor: null,
        },
      });
    }
    await recordAudit({
      userId: null,
      action: `${entity}.publishDue`,
      entityType: entity,
      changes: { after: { count: due.length, ids: due.map((r) => r.id) } },
    });
    total += due.length;
  }
  if (total > 0) revalidateTag("content", { expire: 0 });
  return total;
}

// ─── Sanitization (security.md #8) ───────────────────────────

/**
 * The closed class vocabulary the editor may emit (changes-10, ADR-046).
 * Mirrors the `.ed-*` rules in `@repo/ui`'s globals.css — that file is the
 * definition, this is the gate. Enumerated rather than globbed as `ed-*`
 * so a class with no stylesheet behind it cannot ride along.
 */
const EDITORIAL_CLASSES = [
  "ed-tx-primary",
  "ed-tx-success",
  "ed-tx-warning",
  "ed-tx-info",
  "ed-tx-danger",
  "ed-tx-muted",
  "ed-hl-primary",
  "ed-hl-success",
  "ed-hl-warning",
  "ed-hl-info",
  "ed-hl-danger",
  "ed-hl-muted",
  "ed-ff-sans",
  "ed-ff-serif",
  "ed-ff-mono",
  "ed-fs-sm",
  "ed-fs-base",
  "ed-fs-lg",
  "ed-fs-xl",
  "ed-fs-2xl",
  "ed-align-start",
  "ed-align-center",
  "ed-align-end",
  "ed-align-justify",
  "ed-embed",
];

/** The one permission set a derived provider frame is given. */
const EMBED_ALLOW = "accelerometer; encrypted-media; gyroscope; picture-in-picture";

/**
 * Server-side, on SAVE, regardless of what the editor claims to have done.
 * Allows the rich-text vocabulary Tiptap emits (ADR-009); strips scripts,
 * styles, event handlers, javascript: URLs — the XSS regression suite
 * pins this.
 *
 * changes-10 widened the vocabulary in three controlled ways, none of which
 * relax the "no inline styles" rule (security.md #8 — `allowedStyles` is
 * still `{}`):
 *
 *  - `allowedClasses` replaces the old blanket `class` attribute on
 *    span/code. That is a TIGHTENING: a class used to be able to say
 *    anything, and now must come from `EDITORIAL_CLASSES` (or be a
 *    `language-*` hint on a code block).
 *  - Author styling — colour, highlight, family, size, alignment — arrives
 *    as those classes, so it resolves to theme tokens and survives a
 *    re-brand and dark mode (code-style.md #1).
 *  - `<iframe>` is allowed ONLY where `parseVideoEmbedUrl` recognises the
 *    src as one of our own derived provider embeds. The surviving frame is
 *    REBUILT from the parsed provider and id — src, attributes and all — so
 *    an author-supplied iframe contributes nothing but a video id.
 */
export function sanitizeRichText(html: string): string {
  return sanitize(html, {
    allowedTags: [
      "iframe",
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
      "mark",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan", "class"],
      th: ["colspan", "rowspan", "class"],
      span: ["class"],
      code: ["class"],
      mark: ["class"],
      p: ["class"],
      h1: ["class"],
      h2: ["class"],
      h3: ["class"],
      h4: ["class"],
      li: ["class"],
      blockquote: ["class"],
      figure: ["class"],
      figcaption: ["class"],
      table: ["class"],
      // Rebuilt wholesale by transformTags below — an author-supplied value
      // for any of these never reaches the output.
      iframe: ["src", "title", "loading", "allow", "allowfullscreen"],
    },
    allowedClasses: {
      "*": EDITORIAL_CLASSES,
      // Highlight.js/Prism-style language hint on a fenced code block. Kept
      // as a glob because the language name is open-ended and inert.
      code: [...EDITORIAL_CLASSES, "language-*"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // Second, independent lock on the frames transformTags lets through:
    // even a bug there cannot point a frame at another host.
    allowedIframeHostnames: ["www.youtube-nocookie.com", "player.vimeo.com", "www.dailymotion.com"],
    transformTags: {
      // Derive, don't trust (ADR-015 #9's principle, applied on save rather
      // than at render because the body IS the rendered output). Anything
      // that does not parse loses its src and is dropped by exclusiveFilter.
      iframe: (_tagName, attribs) => {
        const parsed = parseVideoEmbedUrl(attribs.src ?? "");
        if (!parsed) return { tagName: "iframe", attribs: {} };
        return {
          tagName: "iframe",
          attribs: {
            src: parsed.embedUrl,
            // The author's caption is prose and stays theirs; sanitize-html
            // escapes it as an attribute value.
            ...(attribs.title ? { title: attribs.title } : {}),
            loading: "lazy",
            allow: EMBED_ALLOW,
            allowfullscreen: "",
          },
        };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
    // No inline styles at all — styling is the theme engine's job. Author
    // styling goes through EDITORIAL_CLASSES instead (ADR-046).
    allowedStyles: {},
  });
}

// ─── Slugs & redirects ───────────────────────────────────────

// `slugify` moved to `@repo/utils` (changes-18 PR 3) and is re-exported here
// so every existing `import { slugify } from "@repo/core"` keeps working. It
// is a pure string function with no database in it, and the admin's client-side
// `SlugField` needs it to preview a slug as the editor types — which it cannot
// do from this package, because importing it drags Prisma into the browser
// bundle. One definition, reachable from both sides.
export { slugify };

/** Public path for a glossary term, locale-prefix per routing's as-needed rule. Module 12 renders these URLs; this is the one place their shape lives. */
export function glossaryTermPath(locale: string, defaultLocale: string, slug: string): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/glossary/${slug}`;
}

/**
 * Public path for a course: `/learn/<track>/<course>` (ADR-065 §1, replacing
 * ADR-055 #3's flat shape). Sections still never appear in a URL.
 *
 * The TRACK is part of the address, which is why `saveCourse` writes redirects
 * when a course moves between tracks and not only when its slug changes.
 */
export function coursePath(
  locale: string,
  defaultLocale: string,
  track: string,
  slug: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/learn/${track}/${slug}`;
}

/**
 * Public path for a lesson (ADR-065 §1): `/learn/<track>/<course>/<lesson>`.
 *
 * The lesson path embeds the TRACK and the COURSE slug, which is why
 * `saveCourse` has to write a redirect per lesson when either changes — a
 * detail that is invisible until you notice a renamed course 404s every
 * bookmarked lesson under it.
 */
export function lessonPath(
  locale: string,
  defaultLocale: string,
  track: string,
  courseSlug: string,
  lessonSlug: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/learn/${track}/${courseSlug}/${lessonSlug}`;
}

/**
 * Public path for a video topic (ADR-068 §1): `/learn/<track>/videos/<slug>`.
 *
 * It lives here rather than in @repo/contracts beside `learnTrackVideosPath`
 * because it carries the locale prefix and feeds `createSlugRedirect` — the
 * same job, and the same neighbourhood, as `coursePath` and `lessonPath`.
 * The static section path has no locale logic, so it stayed in contracts.
 */
export function videoTopicPath(
  locale: string,
  defaultLocale: string,
  track: string,
  slug: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/learn/${track}/videos/${slug}`;
}

/**
 * Public path for a video category VIEW: `/learn/<track>/videos/categories/<slug>`.
 *
 * A category is taxonomy, not address (ADR-068 §1) — it spans tracks, and this
 * is a filtered view onto one of them, the way `/learn/<track>/glossary` is a
 * view onto `/glossary`. That is why renaming a category writes one redirect
 * per track it has topics in rather than one redirect full stop.
 */
export function videoCategoryPath(
  locale: string,
  defaultLocale: string,
  track: string,
  slug: string,
): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${prefix}/learn/${track}/videos/categories/${slug}`;
}

/** Exported for the learn services (ADR-055); the glossary and article paths already used it privately. */
export async function createSlugRedirect(
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
  advancedExplanation?: string | null;
  exampleScenario?: string | null;
  faq?: GlossaryFaqItemInput[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/**
 * The four prose fields, sanitized ONE BY ONE.
 *
 * Not one `sanitizeRichText` over a concatenation: `sanitize-html` balances
 * tags across the whole string it is given, so an unclosed tag at the end of
 * the simple explanation would swallow the detailed one into it and the two
 * would come apart once stored in separate columns. Per field is also what
 * security.md #8 means by "sanitized on save" — each column is its own
 * boundary.
 */
function cleanGlossaryProse(input: {
  simpleExplanation: string;
  detailedExplanation?: string | null;
  advancedExplanation?: string | null;
  exampleScenario?: string | null;
}) {
  return {
    simpleExplanation: sanitizeRichText(input.simpleExplanation),
    detailedExplanation: input.detailedExplanation
      ? sanitizeRichText(input.detailedExplanation)
      : null,
    advancedExplanation: input.advancedExplanation
      ? sanitizeRichText(input.advancedExplanation)
      : null,
    exampleScenario: input.exampleScenario ? sanitizeRichText(input.exampleScenario) : null,
  };
}

/**
 * What a source edit is measured against (ADR-069 §2).
 *
 * ALL FOUR prose fields, in a fixed order. Before ADR-069 this covered only
 * `simpleExplanation + detailedExplanation`, which was correct while those
 * were the only two fields with a write path. Now that the editor writes the
 * advanced explanation and the worked example too, leaving them out would mean
 * an author could rewrite a term's entire worked example and no translation
 * would ever be marked OUTDATED — the exact failure the sourceHash exists to
 * prevent.
 *
 * A NUL separator rather than bare concatenation: without it, moving a
 * sentence from the end of one field to the start of the next produces an
 * identical hash and the translations silently stay "current".
 */
function glossarySourceMaterial(prose: {
  simpleExplanation: string;
  detailedExplanation: string | null;
  advancedExplanation: string | null;
  exampleScenario: string | null;
}): string {
  return [
    prose.simpleExplanation,
    prose.detailedExplanation ?? "",
    prose.advancedExplanation ?? "",
    prose.exampleScenario ?? "",
  ].join("\u0000");
}

/**
 * The term-level fields, as the editor sends them.
 *
 * Every field optional, and `undefined` means UNTOUCHED while `null` means
 * cleared. That distinction is load-bearing here in a way it is not on most of
 * our inputs: `topicId: null` ("unfiled") and `track: null` ("every school")
 * are both real, chosen values a user picks from a dropdown, so neither can be
 * collapsed into "no value supplied".
 */
export interface SaveGlossaryTermMeta {
  topicId?: string | null;
  track?: string | null;
  difficulty?: Difficulty;
  formula?: string | null;
  imageUrl?: string | null;
}

export interface SaveGlossaryTermInput {
  termId: string;
  meta: SaveGlossaryTermMeta;
  translation: Omit<SaveGlossaryTranslationInput, "termId">;
}

/**
 * The editor's one save (ADR-069 §1) — term-level fields and the active
 * locale's translation, committed in ONE transaction.
 *
 * The lifecycle this owns, unchanged from the translation-only version it
 * replaces:
 *  - rich text sanitized server-side on save, per field;
 *  - saving the DEFAULT locale recomputes the source hash and flips every
 *    sibling translation whose stored hash no longer matches → OUTDATED;
 *  - saving a NON-default locale stamps the current source hash and marks the
 *    row TRANSLATED;
 *  - a slug change writes a 301 Redirect row for the old public path.
 *
 * The redirect is written AFTER the transaction commits, deliberately. It is a
 * separate aggregate, and a failed redirect upsert must not roll back a saved
 * definition — a missing 301 is a stale link, a rolled-back save is lost work.
 */
export async function saveGlossaryTerm(
  actor: Subject,
  input: SaveGlossaryTermInput,
): Promise<void> {
  const { termId, meta } = input;
  const translation = input.translation;

  const defaultLocale =
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en";

  const clean = cleanGlossaryProse(translation);
  const slug = slugify(translation.slug?.trim() || translation.term);
  // D27: `/glossary/topics` is a real route, so a term cannot claim that slug.
  if (isReservedGlossarySlug(slug)) throw new ReservedGlossarySlugError(slug);
  const isSource = translation.locale === defaultLocale;

  const existing = await db.glossaryTermTranslation.findUnique({
    where: { termId_locale: { termId, locale: translation.locale } },
    select: { slug: true },
  });

  const sourceHash = isSource
    ? computeSourceHash(glossarySourceMaterial(clean))
    : await currentGlossarySourceHash(termId, defaultLocale);

  const translationData = {
    term: translation.term,
    slug,
    ...clean,
    // `faq` is `Json?`, and Prisma reads `undefined` as "leave this column
    // alone". An empty ARRAY is not the same thing: it is the honest
    // representation of "the author removed every question".
    ...(translation.faq === undefined ? {} : { faq: translation.faq }),
    seoTitle: translation.seoTitle ?? null,
    seoDescription: translation.seoDescription ?? null,
    sourceHash,
    translationStatus: TranslationStatus.TRANSLATED,
  };

  await db.$transaction(async (tx) => {
    // Only the keys the caller actually sent — see SaveGlossaryTermMeta on why
    // `undefined` and `null` must not be conflated here.
    const metaData = {
      ...(meta.topicId === undefined ? {} : { topicId: meta.topicId }),
      ...(meta.track === undefined ? {} : { track: meta.track }),
      ...(meta.difficulty === undefined ? {} : { difficulty: meta.difficulty }),
      ...(meta.formula === undefined ? {} : { formula: meta.formula }),
      ...(meta.imageUrl === undefined ? {} : { imageUrl: meta.imageUrl }),
    };
    if (Object.keys(metaData).length > 0) {
      await tx.glossaryTerm.update({ where: { id: termId }, data: metaData });
    }

    await tx.glossaryTermTranslation.upsert({
      where: { termId_locale: { termId, locale: translation.locale } },
      update: translationData,
      create: { termId, locale: translation.locale, ...translationData },
    });

    // Source edit → flip stale siblings OUTDATED (Module 06's
    // isTranslationOutdated, applied to real rows).
    if (isSource) {
      const siblings = await tx.glossaryTermTranslation.findMany({
        where: { termId, locale: { not: defaultLocale } },
        select: { id: true, sourceHash: true },
      });
      const stale = siblings.filter((s) => isTranslationOutdated(sourceHash!, s.sourceHash));
      if (stale.length > 0) {
        await tx.glossaryTermTranslation.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: { translationStatus: TranslationStatus.OUTDATED },
        });
      }
    }
  });

  // Slug change → 301 from the old public path (SEO-preserving detail).
  if (existing && existing.slug !== slug) {
    await createSlugRedirect(
      glossaryTermPath(translation.locale, defaultLocale, existing.slug),
      glossaryTermPath(translation.locale, defaultLocale, slug),
      actor.id,
    );
  }

  await recordAudit({
    userId: actor.id,
    action: "glossary.save",
    entityType: "glossaryTerm",
    entityId: termId,
    changes: { after: { term: translation.term, slug, locale: translation.locale, ...meta } },
  });
  revalidateTag("content", { expire: 0 });
}

/**
 * The translation-only entry point, kept for every caller that has no
 * term-level field to write. Delegates rather than duplicating: the
 * OUTDATED-flip and the slug redirect are the parts worth having exactly one
 * copy of, and they are tested through this signature.
 */
export async function saveGlossaryTranslation(
  actor: Subject,
  input: SaveGlossaryTranslationInput,
): Promise<void> {
  const { termId, ...translation } = input;
  await saveGlossaryTerm(actor, { termId, meta: {}, translation });
}

async function currentGlossarySourceHash(
  termId: string,
  defaultLocale: string,
): Promise<string | null> {
  const source = await db.glossaryTermTranslation.findUnique({
    where: { termId_locale: { termId, locale: defaultLocale } },
    select: {
      simpleExplanation: true,
      detailedExplanation: true,
      advancedExplanation: true,
      exampleScenario: true,
    },
  });
  if (!source) return null;
  return computeSourceHash(glossarySourceMaterial(source));
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

// ─── Duplicate ───────────────────────────────────────────────

/**
 * A glossary slug that no OTHER term holds in this locale.
 *
 * `saveGlossaryTerm` does not need this — an editor typing a slug that clashes
 * should be told so, and the `@@unique([locale, slug])` constraint tells them.
 * A duplicate is different: nobody typed anything, so the copy has to find its
 * own free slug or the action fails for a reason the actor cannot act on.
 */
async function uniqueGlossarySlug(locale: string, base: string): Promise<string> {
  const candidate = base || "term";
  let slug = candidate;
  let suffix = 2;
  for (;;) {
    const clash = await db.glossaryTermTranslation.findFirst({
      where: { locale, slug },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${candidate}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Copies a glossary term, with every translation, as a DRAFT (changes-18 PR 5).
 *
 * `duplicateLesson`'s shape. Two term-specific notes:
 *
 *  - **`publishedAt` is cleared and `viewCount` restarts at zero.** The copy
 *    has never been published and nobody has read it; carrying either across
 *    would make the new row assert something untrue about itself.
 *  - **`sourceHash` comes across unchanged**, so a copy's non-English
 *    translations keep whatever freshness state the original's had. Recomputing
 *    it would mark every sibling OUTDATED for a change no one made, and
 *    clearing it would claim they had never been checked.
 *
 * The reserved-slug guard is not re-run: the source's slug already passed it,
 * and appending `-copy` cannot turn a legal slug into `topics` or `glossary`.
 */
export async function duplicateGlossaryTerm(actor: Subject, termId: string): Promise<string> {
  const source = await db.glossaryTerm.findUniqueOrThrow({
    where: { id: termId },
    include: { translations: true },
  });

  // Resolved before the transaction: the loop polls the table, and holding a
  // write transaction open across it blocks every other editor's save.
  const slugs = new Map<string, string>();
  for (const t of source.translations) {
    slugs.set(t.locale, await uniqueGlossarySlug(t.locale, `${t.slug}-copy`));
  }

  const copy = await db.glossaryTerm.create({
    data: {
      topicId: source.topicId,
      track: source.track,
      difficulty: source.difficulty,
      formula: source.formula,
      imageUrl: source.imageUrl,
      status: ContentStatus.DRAFT,
      authorId: actor.id,
      publishedAt: null,
      translations: {
        create: source.translations.map((t) => ({
          locale: t.locale,
          term: `${t.term} (copy)`,
          slug: slugs.get(t.locale)!,
          simpleExplanation: t.simpleExplanation,
          detailedExplanation: t.detailedExplanation,
          advancedExplanation: t.advancedExplanation,
          exampleScenario: t.exampleScenario,
          ...(t.faq === null ? {} : { faq: t.faq as Prisma.InputJsonValue }),
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          sourceHash: t.sourceHash,
          translationStatus: t.translationStatus,
        })),
      },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "glossary.duplicate",
    entityType: "glossaryTerm",
    entityId: copy.id,
    changes: { after: { sourceTermId: termId } },
  });
  revalidateTag("content", { expire: 0 });
  return copy.id;
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
  /** The school this term is filed under; null = every one (ADR-065 §3). */
  track: string | null;
  /** The topic it is filed under; null = UNFILED — the other null (ADR-069 §3). */
  topicId: string | null;
  topicName: string | null;
  difficulty: Difficulty;
  deletedAt: Date | null;
  term: string | null;
  slug: string | null;
  updatedAt: Date;
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
      // The admin is English-only (ADR-043 #2), so the topic NAME shown in the
      // table comes from the default locale rather than the fallback chain the
      // public loader runs. A topic with no English translation shows as
      // unfiled here, which is the right prompt to go and name it.
      topic: { select: { id: true, translations: { select: { locale: true, name: true } } } },
    },
  });
  return rows.map((row) => {
    const en = row.translations.find((t) => t.locale === "en");
    return {
      id: row.id,
      status: row.status,
      track: row.track,
      topicId: row.topicId,
      topicName: row.topic?.translations.find((t) => t.locale === "en")?.name ?? null,
      difficulty: row.difficulty,
      deletedAt: row.deletedAt,
      term: en?.term ?? null,
      slug: en?.slug ?? null,
      updatedAt: row.updatedAt,
      locales: row.translations.map((t) => ({
        locale: t.locale,
        translationStatus: t.translationStatus,
      })),
      legalTransitions: CONTENT_TRANSITIONS[row.status],
    };
  });
}

export interface GlossaryTranslationAdminRow {
  locale: string;
  term: string;
  slug: string;
  simpleExplanation: string;
  detailedExplanation: string | null;
  advancedExplanation: string | null;
  exampleScenario: string | null;
  faq: GlossaryFaqItemInput[];
  seoTitle: string | null;
  seoDescription: string | null;
  translationStatus: TranslationStatus;
}

export interface GlossaryTermAdminDetail {
  id: string;
  status: ContentStatus;
  topicId: string | null;
  track: string | null;
  difficulty: Difficulty;
  formula: string | null;
  imageUrl: string | null;
  viewCount: number;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  translations: GlossaryTranslationAdminRow[];
  legalTransitions: ContentStatus[];
}

/**
 * A `Json?` column read back into a typed list.
 *
 * Defensive on purpose. Rows written before ADR-069 have `faq: null`, and
 * anything hand-inserted could hold a shape the schema would now reject. The
 * editor must not explode on either — it drops what it cannot understand and
 * the author re-adds it, which beats a 500 on a content screen.
 */
function readGlossaryFaq(value: unknown): GlossaryFaqItemInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { question, answer } = item as Record<string, unknown>;
    if (typeof question !== "string" || typeof answer !== "string") return [];
    if (question.trim() === "" || answer.trim() === "") return [];
    return [{ question, answer }];
  });
}

/**
 * Everything the editor route needs, in one query (ADR-069).
 *
 * The bug this exists to close: `loadGlossaryAdminList` never selected a
 * single body field, so the inline form it fed had nothing to prefill from and
 * opened blank on a term that had been written months ago. A detail loader is
 * the fix — the list stays lean, and the screen that edits one term loads that
 * one term completely.
 */
export async function loadGlossaryTermAdminDetail(
  termId: string,
): Promise<GlossaryTermAdminDetail | null> {
  const row = await db.glossaryTerm.findUnique({
    where: { id: termId },
    include: { translations: { orderBy: { locale: "asc" } } },
  });
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    topicId: row.topicId,
    track: row.track,
    difficulty: row.difficulty,
    formula: row.formula,
    imageUrl: row.imageUrl,
    viewCount: row.viewCount,
    publishedAt: row.publishedAt,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    translations: row.translations.map((t) => ({
      locale: t.locale,
      term: t.term,
      slug: t.slug,
      simpleExplanation: t.simpleExplanation,
      detailedExplanation: t.detailedExplanation,
      advancedExplanation: t.advancedExplanation,
      exampleScenario: t.exampleScenario,
      faq: readGlossaryFaq(t.faq),
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      translationStatus: t.translationStatus,
    })),
    legalTransitions: CONTENT_TRANSITIONS[row.status],
  };
}

/**
 * `topicId` replaces the old free-text `category` (ADR-055 #12 / D27), and
 * `track` joined it in ADR-065 §3. Both are optional and both may be null —
 * "unfiled" and "every school" are real choices the New-term dialog offers,
 * not the absence of one (ADR-069 §3).
 */
export async function createGlossaryTerm(
  actor: Subject,
  init: { topicId?: string | null; track?: string | null } = {},
): Promise<string> {
  const term = await db.glossaryTerm.create({
    data: { topicId: init.topicId ?? null, track: init.track ?? null, authorId: actor.id },
  });
  await recordAudit({
    userId: actor.id,
    action: "glossary.create",
    entityType: "glossaryTerm",
    entityId: term.id,
  });
  return term.id;
}
