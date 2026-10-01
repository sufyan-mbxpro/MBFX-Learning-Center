// Announcement emails (ADR-171, changes-54 N3): the service behind
// /keystone/announcements and the public unsubscribe.
//
// Four rules shape everything here:
//
// 1. **Delivery is a job queue, never inline** (owner, D8). Send writes one
//    recipient row per address and returns; `announcement-runner.ts` sends.
//    "Send me a test" is the one exception: one message, to the actor.
// 2. **One announcement reaches one address once** — `@@unique([campaignId,
//    email])`, filled by `announcement-audience.ts` (ADR-171 #2).
// 3. **Nothing is mailed about a course a reader cannot open.** A SCHEDULED
//    course may be announced and the campaign waits for it (owner, D5);
//    anything else refuses, and a campaign whose course disappears is
//    cancelled rather than sent.
// 4. **Every mutation checks its own key** behind the action's
//    `requirePermission` (security.md #1), and writes an audit row naming
//    counts and keys — never addresses.
import {
  ANNOUNCEMENT_TEMPLATE_KEYS,
  announcementAudienceSchema,
  audiencesForKind,
  isContentKind,
  announcementInactiveDays,
  normaliseEmail,
  type AnnouncementAudience,
  type AnnouncementAudienceKey,
  type AnnouncementKindInput,
  type AnnouncementRefusal,
  type AnnouncementSave,
  type AnnouncementStatusValue,
  type CampaignKind,
  type UnsubscribeSubjectKind,
} from "@repo/contracts";
import { SubscriberStatus, db, emailTemplateDefault } from "@repo/db";
import {
  announcementUnsubscribeUrls,
  createSendSession,
  hasLinkSecret,
  loadLocalizedEmailContext,
  type EmailScheme,
  renderEmail,
  sanitizeEmailHtml,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type DeliveryResult,
  type RenderedEmail,
} from "@repo/email";
import { catalogMessage } from "@repo/i18n";
import { can, type Subject } from "@repo/rbac";
import { loadSetting } from "@repo/settings";
import { siteOrigin } from "@repo/utils";
import {
  countAudience,
  countEachCard,
  snapshotRecipients,
  type AudienceContext,
  type AudienceCounts,
} from "./announcement-audience.ts";
import {
  courseAvailability,
  courseEmailWords,
  loadCourseTarget,
  loadLocales,
  type TargetAvailability,
} from "./announcement-target.ts";
import { hashCampaignContents, loadCampaignContents } from "./campaign-content.ts";
import { recordAudit } from "./index.ts";

export const ANNOUNCEMENT_SUPPRESSION_SCOPE = "ANNOUNCEMENTS" as const;

// ─── Errors ──────────────────────────────────────────────────

export class AnnouncementNotFoundError extends Error {
  constructor(id: string) {
    super(`Announcement ${id} not found`);
    this.name = "AnnouncementNotFoundError";
  }
}

/** Defence in depth behind the action's `requirePermission` (security.md #1). */
export class AnnouncementPermissionError extends Error {
  constructor(readonly permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = "AnnouncementPermissionError";
  }
}

/** A refusal the Review step names, each with its own fix-it link (plan §8.1). */
export class AnnouncementRefusedError extends Error {
  constructor(readonly reason: AnnouncementRefusal) {
    super(`Announcement refused: ${reason}`);
    this.name = "AnnouncementRefusedError";
  }
}

function requireKey(actor: Subject, permission: string): void {
  if (!can(actor, permission)) throw new AnnouncementPermissionError(permission);
}

// ─── Shared helpers ──────────────────────────────────────────

/** The audience JSON as stored, or null when a draft has none yet. */
export function parseStoredAudience(value: unknown): AnnouncementAudience | null {
  const parsed = announcementAudienceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function audienceContext(targetCourseId: string | null, now: Date): Promise<AudienceContext> {
  const days = announcementInactiveDays((await loadSetting("announcements.inactiveDays")) ?? "30");
  return { targetCourseId, inactiveBefore: new Date(now.getTime() - days * 86_400_000) };
}

function templateKeyFor(kind: AnnouncementKindInput) {
  return ANNOUNCEMENT_TEMPLATE_KEYS[kind];
}

/**
 * Everything that must be true before a campaign may start, in the order the
 * Review step lists it (plan §8.1). Returns every failing reason, not just the
 * first, so the checklist shows the whole picture at once.
 */
export async function announcementBlockers(
  campaign: {
    id: string;
    kind: CampaignKind;
    targetId: string | null;
    audience: unknown;
    testedHash?: string | null;
  },
  now: Date,
): Promise<{ blockers: AnnouncementRefusal[]; availability: TargetAvailability }> {
  const blockers: AnnouncementRefusal[] = [];
  // A custom email is about no content, so there is nothing to wait for.
  const availability: TargetAvailability = !isContentKind(campaign.kind)
    ? "live"
    : campaign.targetId
      ? await courseAvailability(campaign.targetId, now)
      : "unavailable";
  if (availability === "unavailable") blockers.push("target_unavailable");
  if ((await loadSetting("email.enabled")) === false) blockers.push("email_disabled");
  if (isContentKind(campaign.kind)) {
    const template = await db.emailTemplate.findUnique({
      where: { key: templateKeyFor(campaign.kind) },
      select: { isActive: true },
    });
    // A missing row is restored from its default (active) on first send
    // (ADR-131), so only an existing row switched OFF blocks.
    if (template && !template.isActive) blockers.push("template_inactive");
  } else {
    // ADR-172 #2: words in the default locale, and a test since the last edit.
    const [contents, { defaultLocale }] = await Promise.all([
      loadCampaignContents(campaign.id),
      loadLocales(),
    ]);
    if (!contents.some((row) => row.locale === defaultLocale)) blockers.push("no_content");
    else if (campaign.testedHash !== hashCampaignContents(contents)) {
      blockers.push("test_required");
    }
  }
  const postalAddress = (await loadSetting("email.postalAddress")) ?? "";
  if (postalAddress.trim() === "") blockers.push("no_postal_address");
  if (!hasLinkSecret()) blockers.push("no_link_secret");
  // A card the kind does not offer (staff on a course announcement) is no
  // audience at all: the save schemas refuse it, and this catches a row that
  // was written some other way.
  const audience = parseStoredAudience(campaign.audience);
  const allowed = audiencesForKind(campaign.kind);
  if (!audience || audience.keys.some((key) => !allowed.includes(key))) {
    blockers.push("no_audience");
  }
  return { blockers, availability };
}

/** The campaign counters, recomputed from its rows so they cannot drift. */
export async function refreshAnnouncementCounters(campaignId: string): Promise<void> {
  const groups = await db.emailCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const count = (status: string) =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: {
      recipientCount: groups.reduce((total, group) => total + group._count._all, 0),
      sentCount: count("SENT"),
      failedCount: count("FAILED"),
      skippedCount: count("SKIPPED") + count("SUPPRESSED"),
    },
  });
}

// ─── Drafts ──────────────────────────────────────────────────

/** Create or update a DRAFT. A campaign that has left draft is history. */
export async function saveAnnouncementDraft(
  actor: Subject,
  input: AnnouncementSave,
): Promise<string> {
  requireKey(actor, "announcements.create");
  const course = await db.course.findUnique({
    where: { id: input.targetId },
    select: { deletedAt: true },
  });
  if (!course || course.deletedAt) throw new AnnouncementRefusedError("target_unavailable");

  const columns = {
    kind: input.kind,
    targetId: input.targetId,
    name: input.name,
    subject: input.subject,
    message: input.message,
    ...(input.audience ? { audience: input.audience } : {}),
  };

  let id: string;
  if (input.id) {
    const existing = await db.emailCampaign.findUnique({
      where: { id: input.id },
      select: { status: true, kind: true },
    });
    // A custom email is saved by `saveCustomEmail`; this form cannot edit one.
    if (!existing || existing.kind !== input.kind) throw new AnnouncementNotFoundError(input.id);
    if (existing.status !== "DRAFT") throw new AnnouncementRefusedError("not_draft");
    await db.emailCampaign.update({ where: { id: input.id }, data: columns });
    id = input.id;
  } else {
    const row = await db.emailCampaign.create({
      data: { ...columns, audience: input.audience ?? { keys: [] }, createdById: actor.id },
      select: { id: true },
    });
    id = row.id;
  }

  await recordAudit({
    userId: actor.id,
    action: input.id ? "announcements.update" : "announcements.create",
    entityType: "announcement",
    entityId: id,
    changes: {
      after: {
        kind: input.kind,
        targetId: input.targetId,
        name: input.name,
        audience: input.audience?.keys ?? null,
      },
    },
  });
  return id;
}

export async function deleteAnnouncementDraft(actor: Subject, id: string): Promise<void> {
  requireKey(actor, "announcements.create");
  const row = await db.emailCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new AnnouncementNotFoundError(id);
  if (row.status !== "DRAFT") throw new AnnouncementRefusedError("not_draft");
  await db.emailCampaign.delete({ where: { id } });
  await recordAudit({
    userId: actor.id,
    action: "announcements.delete",
    entityType: "announcement",
    entityId: id,
  });
}

/**
 * A copy as a new DRAFT: same course or words, same audience; nothing sent.
 * A custom email's words are copied too and its test is NOT: the copy is a new
 * email and is tested before it goes (ADR-172 #2). A direct email is a one-off
 * to one person and is not duplicated.
 */
export async function duplicateAnnouncement(actor: Subject, id: string): Promise<string> {
  requireKey(actor, "announcements.create");
  const row = await db.emailCampaign.findUnique({
    where: { id },
    include: { contents: true },
  });
  if (!row || row.kind === "DIRECT") throw new AnnouncementNotFoundError(id);
  const copy = await db.emailCampaign.create({
    data: {
      kind: row.kind,
      targetId: row.targetId,
      name: row.name.slice(0, 160),
      subject: row.subject,
      message: row.message,
      audience: row.audience ?? { keys: [] },
      designId: row.designId,
      createdById: actor.id,
      contents: {
        create: row.contents.map((content) => ({
          locale: content.locale,
          subject: content.subject,
          preheader: content.preheader,
          mode: content.mode,
          bodyHtml: content.bodyHtml,
        })),
      },
    },
    select: { id: true },
  });
  await recordAudit({
    userId: actor.id,
    action: "announcements.create",
    entityType: "announcement",
    entityId: copy.id,
    changes: { after: { duplicateOf: id } },
  });
  return copy.id;
}

// ─── Reads ───────────────────────────────────────────────────

export interface AnnouncementListRow {
  id: string;
  kind: CampaignKind;
  name: string;
  status: AnnouncementStatusValue;
  /** SCHEDULED and waiting for its course to go live (D5). */
  waitingForTarget: boolean;
  /** Null for a custom or direct email, which is about no content. */
  targetId: string | null;
  targetTitle: string | null;
  audienceKeys: AnnouncementAudienceKey[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  scheduledFor: Date | null;
  createdAt: Date;
  finishedAt: Date | null;
  createdByName: string | null;
}

export interface AnnouncementListFilter {
  status?: AnnouncementStatusValue | undefined;
  query?: string | undefined;
  /**
   * Which kind to list. By default a direct email is left out: it is a
   * one-to-one message, found on the person's record and in the delivery log,
   * and a hundred of them would bury every broadcast (ADR-172 #1).
   */
  kind?: CampaignKind | undefined;
}

async function englishTitles(courseIds: string[]): Promise<Map<string, string>> {
  if (courseIds.length === 0) return new Map();
  const { defaultLocale } = await loadLocales();
  const rows = await db.courseTranslation.findMany({
    where: { courseId: { in: courseIds }, locale: defaultLocale },
    select: { courseId: true, title: true },
  });
  return new Map(rows.map((row) => [row.courseId, row.title]));
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function listAnnouncements(
  actor: Subject,
  filter: AnnouncementListFilter = {},
): Promise<AnnouncementListRow[]> {
  requireKey(actor, "announcements.view");
  const query = filter.query?.trim();
  const rows = await db.emailCampaign.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(query ? { name: { contains: query } } : {}),
      kind: filter.kind ?? { not: "DIRECT" },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const courseIds = rows.flatMap((row) =>
    row.targetId && isContentKind(row.kind) ? [row.targetId] : [],
  );
  const [titles, names] = await Promise.all([
    englishTitles([...new Set(courseIds)]),
    userNames([...new Set(rows.map((row) => row.createdById))]),
  ]);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    status: row.status,
    waitingForTarget: row.status === "SCHEDULED" && row.sendWhenLive,
    targetId: row.targetId,
    targetTitle: row.targetId ? (titles.get(row.targetId) ?? null) : null,
    audienceKeys: parseStoredAudience(row.audience)?.keys ?? [],
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    createdByName: names.get(row.createdById) ?? null,
  }));
}

export interface AnnouncementDetail extends AnnouncementListRow {
  subject: string | null;
  message: string | null;
  audience: AnnouncementAudience | null;
  cancelReason: string | null;
  startedAt: Date | null;
  pendingCount: number;
  targetAvailability: TargetAvailability;
  targetScheduledFor: Date | null;
  blockers: AnnouncementRefusal[];
  /** Earlier sends about the same course, newest first (plan §8.1). */
  previousSends: { id: string; startedAt: Date | null; recipientCount: number }[];
}

export async function getAnnouncement(
  actor: Subject,
  id: string,
  now: Date = new Date(),
): Promise<AnnouncementDetail> {
  requireKey(actor, "announcements.view");
  const row = await db.emailCampaign.findUnique({ where: { id } });
  if (!row) throw new AnnouncementNotFoundError(id);
  const courseId = isContentKind(row.kind) ? row.targetId : null;
  const [titles, names, pendingCount, target, previous, check] = await Promise.all([
    englishTitles(courseId ? [courseId] : []),
    userNames([row.createdById]),
    db.emailCampaignRecipient.count({
      where: { campaignId: id, status: { in: ["PENDING", "SENDING"] } },
    }),
    courseId
      ? db.course.findUnique({ where: { id: courseId }, select: { scheduledFor: true } })
      : null,
    courseId
      ? db.emailCampaign.findMany({
          where: {
            kind: row.kind,
            targetId: courseId,
            id: { not: id },
            status: { in: ["SENDING", "SENT"] },
          },
          select: { id: true, startedAt: true, recipientCount: true },
          orderBy: { startedAt: "desc" },
          take: 5,
        })
      : [],
    announcementBlockers(row, now),
  ]);
  const audience = parseStoredAudience(row.audience);
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    status: row.status,
    waitingForTarget: row.status === "SCHEDULED" && row.sendWhenLive,
    targetId: row.targetId,
    targetTitle: courseId ? (titles.get(courseId) ?? null) : null,
    audienceKeys: audience?.keys ?? [],
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    createdByName: names.get(row.createdById) ?? null,
    subject: row.subject,
    message: row.message,
    audience,
    cancelReason: row.cancelReason,
    startedAt: row.startedAt,
    pendingCount,
    targetAvailability: check.availability,
    targetScheduledFor: target?.scheduledFor ?? null,
    blockers: check.blockers,
    previousSends: previous,
  };
}

export interface FailedRecipientRow {
  email: string;
  lastError: string | null;
  attempts: number;
}

/** The detail screen's failure table. It lists ADDRESSES, so it takes the log key. */
export async function listFailedRecipients(
  actor: Subject,
  id: string,
): Promise<FailedRecipientRow[]> {
  requireKey(actor, "announcements.view");
  requireKey(actor, "email.log.view");
  return db.emailCampaignRecipient.findMany({
    where: { campaignId: id, status: "FAILED" },
    select: { email: true, lastError: true, attempts: true },
    orderBy: { email: "asc" },
    take: 500,
  });
}

// ─── The Content and Audience steps ──────────────────────────

export interface AnnounceableCourse {
  id: string;
  title: string;
  track: string;
  difficulty: string;
  availability: Exclude<TargetAvailability, "unavailable">;
  scheduledFor: Date | null;
  coverUrl: string | null;
}

/**
 * The Content step's picker: courses a reader can open, and SCHEDULED ones
 * labelled with their go-live date (D5). Never a draft.
 */
export async function searchAnnounceableCourses(
  actor: Subject,
  query: string,
  now: Date = new Date(),
): Promise<AnnounceableCourse[]> {
  requireKey(actor, "announcements.create");
  const { defaultLocale } = await loadLocales();
  const trimmed = query.trim();
  const rows = await db.course.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      visibility: "PUBLIC",
      OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED" }],
      ...(trimmed
        ? { translations: { some: { locale: defaultLocale, title: { contains: trimmed } } } }
        : {}),
    },
    select: {
      id: true,
      track: true,
      difficulty: true,
      scheduledFor: true,
      coverAssetId: true,
      translations: { where: { locale: defaultLocale }, select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const covers = await db.mediaAsset.findMany({
    where: { id: { in: rows.flatMap((row) => (row.coverAssetId ? [row.coverAssetId] : [])) } },
    select: { id: true, url: true },
  });
  const coverById = new Map(covers.map((cover) => [cover.id, cover.url]));
  const results: AnnounceableCourse[] = [];
  for (const row of rows) {
    const availability = await courseAvailability(row.id, now);
    if (availability === "unavailable") continue;
    results.push({
      id: row.id,
      title: row.translations[0]?.title ?? row.id,
      track: row.track,
      difficulty: row.difficulty,
      availability,
      scheduledFor: availability === "scheduled" ? row.scheduledFor : null,
      coverUrl: row.coverAssetId ? (coverById.get(row.coverAssetId) ?? null) : null,
    });
  }
  return results;
}

/** One course as the Content step shows it, whatever its state (the editor warns). */
export async function announceableCourseById(
  actor: Subject,
  id: string,
  now: Date = new Date(),
): Promise<
  (Omit<AnnounceableCourse, "availability"> & { availability: TargetAvailability }) | null
> {
  requireKey(actor, "announcements.view");
  const { defaultLocale } = await loadLocales();
  const row = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      track: true,
      difficulty: true,
      scheduledFor: true,
      coverAssetId: true,
      deletedAt: true,
      translations: { where: { locale: defaultLocale }, select: { title: true } },
    },
  });
  if (!row || row.deletedAt) return null;
  const [availability, cover] = await Promise.all([
    courseAvailability(row.id, now),
    row.coverAssetId
      ? db.mediaAsset.findUnique({ where: { id: row.coverAssetId }, select: { url: true } })
      : null,
  ]);
  return {
    id: row.id,
    title: row.translations[0]?.title ?? row.id,
    track: row.track,
    difficulty: row.difficulty,
    availability,
    scheduledFor: availability === "scheduled" ? row.scheduledFor : null,
    coverUrl: cover?.url ?? null,
  };
}

/** Earlier sends about the same course (plan §8.1's warning), newest first. */
export async function previousAnnouncementsOf(
  actor: Subject,
  targetId: string,
  exceptId?: string,
): Promise<{ id: string; startedAt: Date | null; recipientCount: number }[]> {
  requireKey(actor, "announcements.view");
  return db.emailCampaign.findMany({
    where: {
      targetId,
      status: { in: ["SENDING", "SENT"] },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, startedAt: true, recipientCount: true },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
}

/** The English titles of courses picked for the Learners of a course card. */
export async function announcementCourseTitles(
  actor: Subject,
  ids: string[],
): Promise<{ id: string; title: string }[]> {
  requireKey(actor, "announcements.view");
  if (ids.length === 0) return [];
  const titles = await englishTitles(ids);
  return ids.map((id) => ({ id, title: titles.get(id) ?? id }));
}

export interface AnnouncementComposeContext {
  /** The template's own subject in the default language, for the placeholder. */
  templateSubject: string;
  fromName: string;
  fromEmail: string;
}

/** What the Subject & message step shows read-only (plan §10.3). */
export async function announcementComposeContext(
  actor: Subject,
  kind: AnnouncementKindInput = "COURSE",
): Promise<AnnouncementComposeContext> {
  requireKey(actor, "announcements.view");
  const key = templateKeyFor(kind);
  const { defaultLocale } = await loadLocales();
  const [stored, fromName, fromEmail, siteName] = await Promise.all([
    db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey: key, locale: defaultLocale } },
      select: { subject: true },
    }),
    loadSetting("email.fromName"),
    loadSetting("email.fromEmail"),
    loadSetting("site.name"),
  ]);
  return {
    templateSubject: stored?.subject ?? emailTemplateDefault(key)?.subject ?? "",
    fromName: fromName ?? siteName ?? "",
    fromEmail: fromEmail ?? "",
  };
}

export interface AudienceSummary {
  /** Every card's own count, picked or not, so the cards can show them. */
  cards: Partial<Record<AnnouncementAudienceKey, number>>;
  /** The current selection, when there is one. */
  selection: AudienceCounts | null;
}

/**
 * The Audience step's numbers. They reveal the size of the user base, which
 * the dashboard gates too, so they need `announcements.create` (plan §11).
 */
export async function summariseAudience(
  actor: Subject,
  targetCourseId: string | null,
  audience: AnnouncementAudience | null,
  now: Date = new Date(),
  kind: CampaignKind = "COURSE",
): Promise<AudienceSummary> {
  requireKey(actor, "announcements.create");
  const context = await audienceContext(targetCourseId, now);
  const plainKeys = audiencesForKind(kind).filter(
    (key) => key !== "course_learners" && key !== "custom",
  );
  const cards = await countEachCard(
    { courseIds: audience?.courseIds, userIds: audience?.userIds },
    context,
    [
      ...plainKeys,
      ...((audience?.courseIds?.length ?? 0) > 0 ? (["course_learners"] as const) : []),
      ...((audience?.userIds?.length ?? 0) > 0 ? (["custom"] as const) : []),
    ],
  );
  return { cards, selection: audience ? await countAudience(audience, context) : null };
}

export interface AnnouncementUserOption {
  id: string;
  name: string;
  email: string;
}

/**
 * The Select users picker (plan §10.3): LEARNERS only (owner, D3), 20 a query.
 * It also needs `users.view`, because without it the picker would be a way to
 * read the user list.
 */
export async function searchAnnouncementUsers(
  actor: Subject,
  query: string,
): Promise<AnnouncementUserOption[]> {
  requireKey(actor, "announcements.create");
  requireKey(actor, "users.view");
  const trimmed = query.trim();
  if (trimmed === "") return [];
  return db.user.findMany({
    where: {
      userType: "LEARNER",
      deletedAt: null,
      OR: [{ email: { contains: trimmed } }, { name: { contains: trimmed } }],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

/** The chosen users' names for a saved draft (the picker's chips). */
export async function announcementUsersById(
  actor: Subject,
  ids: string[],
): Promise<AnnouncementUserOption[]> {
  requireKey(actor, "announcements.view");
  requireKey(actor, "users.view");
  if (ids.length === 0) return [];
  return db.user.findMany({
    where: { id: { in: ids }, userType: "LEARNER" },
    select: { id: true, name: true, email: true },
  });
}

// ─── Starting a campaign ─────────────────────────────────────

/**
 * Snapshot the audience into recipient rows and mark the campaign SENDING, in
 * one transaction under a lock on the campaign row, so two starters (the
 * action and a cron tick) cannot both snapshot it. `ReadCommitted`, ADR-056's
 * lesson: the insert must see rows committed by the other half of the union.
 *
 * Returns the number of recipients, or null when another starter won.
 */
export async function startCampaign(
  campaignId: string,
  actorId: string | null,
  now: Date,
): Promise<number | null> {
  const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new AnnouncementNotFoundError(campaignId);
  const audience = parseStoredAudience(campaign.audience);
  if (!audience) throw new AnnouncementRefusedError("no_audience");
  const context = await audienceContext(campaign.targetId, now);

  const started = await db.$transaction(
    async (tx) => {
      const locked = await tx.$queryRawUnsafe<{ status: string }[]>(
        "SELECT status FROM email_campaigns WHERE id = ? FOR UPDATE",
        campaignId,
      );
      const status = locked[0]?.status;
      if (status !== "DRAFT" && status !== "SCHEDULED") return false;
      await snapshotRecipients(tx, campaignId, audience, context);
      await tx.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: "SENDING",
          snapshotAt: now,
          startedAt: now,
          sentById: actorId ?? campaign.sentById,
        },
      });
      return true;
    },
    { isolationLevel: "ReadCommitted", timeout: 60_000 },
  );
  if (!started) return null;
  await refreshAnnouncementCounters(campaignId);
  const { recipientCount } = await db.emailCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { recipientCount: true },
  });
  if (recipientCount === 0) {
    // Nobody to mail — finished, not stuck in SENDING forever.
    await db.emailCampaign.updateMany({
      where: { id: campaignId, status: "SENDING" },
      data: { status: "SENT", finishedAt: now },
    });
  }
  return recipientCount;
}

export type QueueOutcome =
  | { state: "sending"; recipients: number }
  | { state: "waiting_for_target"; scheduledFor: Date | null };

/**
 * Send now (plan §8.1). Refuses with the FIRST blocker; the Review step shows
 * them all. A course that is SCHEDULED is not a refusal (owner, D5): the
 * campaign waits, sending nothing, until the course is live.
 */
export async function queueAnnouncement(
  actor: Subject,
  id: string,
  now: Date = new Date(),
): Promise<QueueOutcome> {
  requireKey(actor, "announcements.send");
  const campaign = await db.emailCampaign.findUnique({ where: { id } });
  // A direct email is queued by `sendDirectEmail`, never from a Review step.
  if (!campaign || campaign.kind === "DIRECT") throw new AnnouncementNotFoundError(id);
  if (campaign.status !== "DRAFT") throw new AnnouncementRefusedError("not_draft");
  const { blockers, availability } = await announcementBlockers(campaign, now);
  if (blockers[0]) throw new AnnouncementRefusedError(blockers[0]);

  if (availability === "scheduled") {
    await db.emailCampaign.update({
      where: { id },
      data: { status: "SCHEDULED", sendWhenLive: true, scheduledFor: null, sentById: actor.id },
    });
    await recordAudit({
      userId: actor.id,
      action: "announcements.schedule",
      entityType: "announcement",
      entityId: id,
      changes: {
        after: { sendWhenLive: true, audience: parseStoredAudience(campaign.audience)?.keys },
      },
    });
    const course = campaign.targetId
      ? await db.course.findUnique({
          where: { id: campaign.targetId },
          select: { scheduledFor: true },
        })
      : null;
    return { state: "waiting_for_target", scheduledFor: course?.scheduledFor ?? null };
  }

  const context = await audienceContext(campaign.targetId, now);
  const audience = parseStoredAudience(campaign.audience);
  if (!audience || (await countAudience(audience, context)).unique === 0) {
    throw new AnnouncementRefusedError("no_recipients");
  }
  const recipients = (await startCampaign(id, actor.id, now)) ?? 0;
  await recordAudit({
    userId: actor.id,
    action: "announcements.send",
    entityType: "announcement",
    entityId: id,
    // Keys and a count, never the addresses.
    changes: { after: { audience: audience.keys, recipients } },
  });
  return { state: "sending", recipients };
}

/**
 * Send later, at a time the editor chose in their own clock (ADR-071). A
 * SCHEDULED course sets `sendWhenLive` too, so the email waits for whichever
 * is later.
 */
export async function scheduleAnnouncement(
  actor: Subject,
  id: string,
  scheduledFor: Date,
  now: Date = new Date(),
): Promise<void> {
  requireKey(actor, "announcements.send");
  if (scheduledFor.getTime() <= now.getTime()) {
    throw new AnnouncementRefusedError("schedule_in_past");
  }
  const campaign = await db.emailCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.kind === "DIRECT") throw new AnnouncementNotFoundError(id);
  if (campaign.status !== "DRAFT") throw new AnnouncementRefusedError("not_draft");
  const { blockers, availability } = await announcementBlockers(campaign, now);
  if (blockers[0]) throw new AnnouncementRefusedError(blockers[0]);

  await db.emailCampaign.update({
    where: { id },
    data: {
      status: "SCHEDULED",
      scheduledFor,
      sendWhenLive: availability === "scheduled",
      sentById: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "announcements.schedule",
    entityType: "announcement",
    entityId: id,
    changes: {
      after: {
        scheduledFor: scheduledFor.toISOString(),
        sendWhenLive: availability === "scheduled",
        audience: parseStoredAudience(campaign.audience)?.keys,
      },
    },
  });
}

/** Back to DRAFT: a scheduled send that has not started yet, unscheduled. */
export async function unscheduleAnnouncement(actor: Subject, id: string): Promise<void> {
  requireKey(actor, "announcements.send");
  const updated = await db.emailCampaign.updateMany({
    where: { id, status: "SCHEDULED" },
    data: { status: "DRAFT", scheduledFor: null, sendWhenLive: false },
  });
  if (updated.count === 0) throw new AnnouncementRefusedError("not_draft");
  await recordAudit({
    userId: actor.id,
    action: "announcements.unschedule",
    entityType: "announcement",
    entityId: id,
  });
}

// ─── Cancel and retry ────────────────────────────────────────

/**
 * Stop: every PENDING row becomes SKIPPED and the campaign CANCELLED. Rows a
 * runner already holds finish — a message half-handed to the provider cannot
 * be recalled, and pretending otherwise would lie on the detail screen.
 */
export async function cancelAnnouncement(actor: Subject, id: string): Promise<void> {
  requireKey(actor, "announcements.send");
  const row = await db.emailCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new AnnouncementNotFoundError(id);
  if (row.status !== "SENDING" && row.status !== "SCHEDULED") {
    throw new AnnouncementRefusedError("not_draft");
  }
  const now = new Date();
  await db.$transaction([
    db.emailCampaignRecipient.updateMany({
      where: { campaignId: id, status: "PENDING" },
      data: { status: "SKIPPED" },
    }),
    db.emailCampaign.update({
      where: { id },
      data: { status: "CANCELLED", cancelledById: actor.id, finishedAt: now },
    }),
  ]);
  await refreshAnnouncementCounters(id);
  await recordAudit({
    userId: actor.id,
    action: "announcements.cancel",
    entityType: "announcement",
    entityId: id,
    changes: { before: { status: row.status } },
  });
}

/**
 * Retry the FAILED rows (plan §8.2). The `@@unique` still means one row per
 * address, so a retry can only reach people who have not been sent it.
 */
export async function retryFailedRecipients(actor: Subject, id: string): Promise<number> {
  requireKey(actor, "announcements.send");
  const row = await db.emailCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new AnnouncementNotFoundError(id);
  if (row.status !== "SENT" && row.status !== "SENDING") {
    throw new AnnouncementRefusedError("not_draft");
  }
  const [retried] = await db.$transaction([
    db.emailCampaignRecipient.updateMany({
      where: { campaignId: id, status: "FAILED" },
      data: {
        status: "PENDING",
        attempts: 0,
        runAfter: new Date(),
        claimToken: null,
        claimedAt: null,
        lastError: null,
      },
    }),
    db.emailCampaign.update({
      where: { id },
      data: { status: "SENDING", finishedAt: null },
    }),
  ]);
  await refreshAnnouncementCounters(id);
  await recordAudit({
    userId: actor.id,
    action: "announcements.retry",
    entityType: "announcement",
    entityId: id,
    changes: { after: { retried: retried.count } },
  });
  return retried.count;
}

// ─── Test send ───────────────────────────────────────────────

/**
 * The address a test send is prefilled with: the acting admin's own. The
 * dialog lets them change it, so this is a default, not a rule.
 */
export async function ownTestAddress(actor: Subject): Promise<string> {
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { email: true } });
  return me?.email ?? "";
}

/**
 * "Send me a test" (plan §10.3): one message to the acting admin's own
 * address — or to `to`, when the admin typed another one in the dialog — with
 * the real course variables, through the same session a campaign uses. It
 * writes NO recipient row and ignores the template's on/off switch — never
 * `email.enabled` (the email skill, invariant #6).
 */
export async function sendAnnouncementTest(
  actor: Subject,
  id: string,
  options: { locale?: string | undefined; to?: string | undefined } = {},
  now: Date = new Date(),
): Promise<DeliveryResult> {
  const { locale } = options;
  requireKey(actor, "announcements.create");
  const campaign = await db.emailCampaign.findUnique({ where: { id } });
  // A custom email's test is `sendCustomEmailTest`: it has no course.
  if (!campaign || !isContentKind(campaign.kind) || !campaign.targetId) {
    throw new AnnouncementNotFoundError(id);
  }
  const kind = campaign.kind;
  if (!hasLinkSecret()) throw new AnnouncementRefusedError("no_link_secret");
  const [me, target, locales] = await Promise.all([
    db.user.findUnique({ where: { id: actor.id }, select: { email: true, name: true } }),
    loadCourseTarget(campaign.targetId, now),
    loadLocales(),
  ]);
  if (!me) throw new AnnouncementNotFoundError(actor.id);
  if (!target) throw new AnnouncementRefusedError("target_unavailable");
  const words = await courseEmailWords(
    target,
    locale ?? locales.defaultLocale,
    locales,
    campaign.message,
  );
  if (!words) throw new AnnouncementRefusedError("target_unavailable");
  const unsubscribe = await unsubscribeLinks({ kind: "u", id: actor.id }, words.locale);

  const session = await createSendSession(templateKeyFor(kind), {
    isTest: true,
    triggeredById: actor.id,
  });
  try {
    return await session.send({
      to: options.to || me.email,
      locale: words.locale,
      recipientName: me.name,
      subject: campaign.subject ?? undefined,
      variables: { ...words.variables, "unsubscribe.url": unsubscribe.url },
      unsubscribe,
      campaignId: campaign.id,
    });
  } finally {
    session.close();
  }
}

/**
 * The Subject & message step's preview (plan §10.3): the saved announcement
 * rendered with its REAL course variables in `locale`, through the same
 * renderer a send uses. Served by the isolated preview route, never inlined
 * into the admin page (ADR-078 #8). The unsubscribe link is a placeholder —
 * a preview must not mint a working token for anyone.
 */
export async function renderAnnouncementPreview(
  actor: Subject,
  input: { campaignId: string; locale: string; scheme?: EmailScheme | undefined },
  now: Date = new Date(),
): Promise<RenderedEmail | null> {
  requireKey(actor, "announcements.view");
  const campaign = await db.emailCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign || !isContentKind(campaign.kind) || !campaign.targetId) return null;
  const kind = campaign.kind;
  const [target, locales] = await Promise.all([
    loadCourseTarget(campaign.targetId, now),
    loadLocales(),
  ]);
  if (!target) return null;
  const words = await courseEmailWords(target, input.locale, locales, campaign.message);
  if (!words) return null;

  const key = templateKeyFor(kind);
  const template = await db.emailTemplate.findUnique({
    where: { key },
    include: { translations: true },
  });
  const stored =
    template?.translations.find((row) => row.locale === words.locale) ??
    template?.translations.find((row) => row.locale === locales.defaultLocale);
  const fallback = emailTemplateDefault(key);
  const mode = stored?.mode ?? "RICH";
  const bodyHtml = stored?.bodyHtml ?? fallback?.bodyHtml;
  const subject = campaign.subject ?? stored?.subject ?? fallback?.subject;
  if (!bodyHtml || !subject) return null;

  const context = await loadLocalizedEmailContext(words.locale, undefined, {
    scheme: input.scheme,
  });
  const placeholder = `${siteOrigin().replace(/\/+$/, "")}/email/unsubscribe?t=preview`;
  const label = (await catalogMessage(words.locale, "announcements.unsubscribe.footerLink")) ?? "";
  return renderEmail({
    key,
    mode,
    subject,
    preheader: stored?.preheader ?? fallback?.preheader ?? undefined,
    bodyHtml: sanitizeEmailHtml(bodyHtml, mode),
    variables: {
      ...context.globals,
      "recipient.email": "",
      "recipient.name": "",
      ...words.variables,
      "unsubscribe.url": placeholder,
    },
    palette: context.palette,
    shell: { ...context.shell, unsubscribe: { url: placeholder, label } },
  });
}

/** The page link, the one-click handler and the footer word, for one recipient. */
export async function unsubscribeLinks(
  subject: { kind: UnsubscribeSubjectKind; id: string },
  locale: string,
): Promise<{ url: string; oneClickUrl: string; label: string }> {
  const token = signUnsubscribeToken(subject);
  const { defaultLocale } = await loadLocales();
  const urls = announcementUnsubscribeUrls(token, siteOrigin(), locale, defaultLocale);
  const label = (await catalogMessage(locale, "announcements.unsubscribe.footerLink")) ?? "";
  return { url: urls.page, oneClickUrl: urls.oneClick, label };
}

// ─── Suppression (ADR-171 #5) ────────────────────────────────

export interface SuppressionView {
  reason: "UNSUBSCRIBED" | "ADMIN" | "BOUNCE" | "COMPLAINT";
  createdAt: Date;
}

export async function getAnnouncementSuppression(
  actor: Subject,
  email: string,
): Promise<SuppressionView | null> {
  requireKey(actor, "users.view");
  return db.emailSuppression.findUnique({
    where: { email_scope: { email: normaliseEmail(email), scope: ANNOUNCEMENT_SUPPRESSION_SCOPE } },
    select: { reason: true, createdAt: true },
  });
}

/** Staff stop announcements to an address. Idempotent. */
export async function addAnnouncementSuppression(actor: Subject, email: string): Promise<void> {
  requireKey(actor, "announcements.send");
  const address = normaliseEmail(email);
  const existing = await db.emailSuppression.findUnique({
    where: { email_scope: { email: address, scope: ANNOUNCEMENT_SUPPRESSION_SCOPE } },
    select: { id: true },
  });
  if (existing) return;
  await db.emailSuppression.create({
    data: {
      email: address,
      scope: ANNOUNCEMENT_SUPPRESSION_SCOPE,
      reason: "ADMIN",
      createdById: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "email.suppression.add",
    entityType: "email_suppression",
    entityId: address,
  });
}

/**
 * Staff undo ONLY a suppression staff added. A person's own unsubscribe is
 * their decision, and staff cannot reverse it (ADR-171 #5).
 */
export async function removeAnnouncementSuppression(
  actor: Subject,
  email: string,
): Promise<boolean> {
  requireKey(actor, "announcements.send");
  const address = normaliseEmail(email);
  const removed = await db.emailSuppression.deleteMany({
    where: { email: address, scope: ANNOUNCEMENT_SUPPRESSION_SCOPE, reason: "ADMIN" },
  });
  if (removed.count === 0) return false;
  await recordAudit({
    userId: actor.id,
    action: "email.suppression.remove",
    entityType: "email_suppression",
    entityId: address,
  });
  return true;
}

// ─── The public unsubscribe (ADR-171 #9) ─────────────────────

async function addressForSubject(subject: {
  kind: UnsubscribeSubjectKind;
  id: string;
}): Promise<string | null> {
  if (subject.kind === "u") {
    const user = await db.user.findUnique({ where: { id: subject.id }, select: { email: true } });
    return user ? normaliseEmail(user.email) : null;
  }
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { id: subject.id },
    select: { email: true },
  });
  return subscriber ? normaliseEmail(subscriber.email) : null;
}

export interface UnsubscribeState {
  /** Whether the address is also an ACTIVE newsletter subscriber (offer the second button). */
  newsletterActive: boolean;
}

/**
 * The one-click and the page's POST. Idempotent (an upsert that never
 * overwrites a staff suppression's reason), and it answers the SAME for a
 * valid, unknown or already-suppressed token: the route must not be an oracle.
 * Returns the newsletter state only for a real token, for the page's second
 * button; the route handler discards it.
 */
export async function unsubscribeFromAnnouncements(
  token: string,
): Promise<UnsubscribeState | null> {
  const subject = verifyUnsubscribeToken(token);
  if (!subject) return null;
  const email = await addressForSubject(subject);
  if (!email) return null;
  await db.emailSuppression.upsert({
    where: { email_scope: { email, scope: ANNOUNCEMENT_SUPPRESSION_SCOPE } },
    update: {},
    create: { email, scope: ANNOUNCEMENT_SUPPRESSION_SCOPE, reason: "UNSUBSCRIBED" },
  });
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { email },
    select: { status: true },
  });
  return { newsletterActive: subscriber?.status === SubscriberStatus.ACTIVE };
}

/**
 * Undo, from the confirmation page. Removes only a suppression the PERSON
 * made (`UNSUBSCRIBED`); a staff suppression stays.
 */
export async function resubscribeToAnnouncements(token: string): Promise<boolean> {
  const subject = verifyUnsubscribeToken(token);
  if (!subject) return false;
  const email = await addressForSubject(subject);
  if (!email) return false;
  const removed = await db.emailSuppression.deleteMany({
    where: { email, scope: ANNOUNCEMENT_SUPPRESSION_SCOPE, reason: "UNSUBSCRIBED" },
  });
  return removed.count > 0;
}

/**
 * "Also unsubscribe from the newsletter" — a separate, explicit button, since
 * the two lists are separate (owner, D6). The same fields the newsletter's own
 * unsubscribe writes.
 */
export async function unsubscribeNewsletterByAnnouncementToken(token: string): Promise<boolean> {
  const subject = verifyUnsubscribeToken(token);
  if (!subject) return false;
  const email = await addressForSubject(subject);
  if (!email) return false;
  const updated = await db.newsletterSubscriber.updateMany({
    where: { email, status: { not: SubscriberStatus.UNSUBSCRIBED } },
    data: {
      status: SubscriberStatus.UNSUBSCRIBED,
      unsubscribedAt: new Date(),
      unsubscribedVia: "subscriber",
      confirmTokenHash: null,
      confirmExpiresAt: null,
    },
  });
  return updated.count > 0;
}
