// The announcement job runner (ADR-171 #1–#3, changes-54 §8.2), on ADR-162's
// pattern: rows are claimed atomically, sent at the provider's pace, and
// settled one by one. Two runners exist — an `after()` kick from the Send
// action and `POST /api/cron/announcements` every minute — and the atomic
// claim is why they cannot collide.
//
// **At-most-once, deliberately.** A row whose runner died holding it becomes
// FAILED `lease_expired`, never PENDING again: its message may have gone out
// before the crash, and the owner's one hard rule is no duplicates. A missed
// email shows on the detail screen and a person can retry it; a duplicate
// cannot be recalled.
import { randomUUID } from "node:crypto";
import {
  ANNOUNCEMENT_TEMPLATE_KEYS,
  CAMPAIGN_EMAIL_KEY_FOR_KIND,
  isContentKind,
  type AnnouncementSendError,
  type UnsubscribeSubjectKind,
} from "@repo/contracts";
import { db } from "@repo/db";
import {
  createSendSession,
  hasLinkSecret,
  type DeliveryResult,
  type MessageContent,
  type SendSession,
} from "@repo/email";
import { loadSetting } from "@repo/settings";
import {
  courseAvailability,
  courseEmailWords,
  loadCourseTarget,
  loadLocales,
  type CourseEmailWords,
  type Locales,
} from "./announcement-target.ts";
import {
  ANNOUNCEMENT_SUPPRESSION_SCOPE,
  refreshAnnouncementCounters,
  startCampaign,
  unsubscribeLinks,
} from "./announcements.ts";
import {
  loadCampaignContents,
  pickCampaignContent,
  type StoredCampaignContent,
} from "./campaign-content.ts";

/** A claimed row older than this is presumed dead (plan §8.2). */
export const ANNOUNCEMENT_LEASE_MS = 10 * 60_000;
/** Retry after 1 minute, then 5, then give up (ADR-162 #6). */
export const ANNOUNCEMENT_RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;
/** Recipient rows are a list of addresses: purged like the delivery log. */
export const ANNOUNCEMENT_RECIPIENT_RETENTION_DAYS = 90;

export interface DrainOptions {
  /** Stop claiming once this much time has passed (the translate route's 240 s). */
  budgetMs?: number;
  /** Only this campaign's rows — the `after()` kick right after Send. */
  campaignId?: string;
  now?: () => Date;
  /** Injected so a test does not wait out the pacing. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DrainResult {
  started: number;
  cancelled: number;
  sent: number;
  failed: number;
  retried: number;
  suppressed: number;
  leaseExpired: number;
  /** `email.enabled` is off: nothing was claimed, and nothing was burned. */
  paused: boolean;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// ─── Starting scheduled campaigns ────────────────────────────

/**
 * Start every SCHEDULED campaign that is due (plan §8.1). "Due" is the
 * editor's chosen time having passed AND, for `sendWhenLive` (owner, D5), the
 * course being live by its module's own rule — so this does not depend on
 * `/api/cron/publish-due` having run. A course that left SCHEDULED without
 * going live cancels the campaign rather than mailing a link to a 404.
 */
export async function startDueAnnouncements(
  now: Date,
): Promise<{ started: number; cancelled: number }> {
  let started = 0;
  let cancelled = 0;
  // Sending needs a way to unsubscribe; with no secret, a due campaign waits.
  if (!hasLinkSecret()) return { started, cancelled };
  const due = await db.emailCampaign.findMany({
    where: {
      status: "SCHEDULED",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    select: { id: true, kind: true, targetId: true, sendWhenLive: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const campaign of due) {
    // A custom email is about no content: its time having come is enough.
    const availability = !isContentKind(campaign.kind)
      ? "live"
      : campaign.targetId
        ? await courseAvailability(campaign.targetId, now)
        : "unavailable";
    if (availability === "scheduled" && campaign.sendWhenLive) continue;
    if (availability !== "live") {
      const updated = await db.emailCampaign.updateMany({
        where: { id: campaign.id, status: "SCHEDULED" },
        data: { status: "CANCELLED", cancelReason: "target_unavailable", finishedAt: now },
      });
      cancelled += updated.count;
      continue;
    }
    if ((await startCampaign(campaign.id, null, now)) !== null) started += 1;
  }
  return { started, cancelled };
}

// ─── Leases and completion ───────────────────────────────────

/** Rows held past the lease: FAILED `lease_expired`, never PENDING (at-most-once). */
async function expireLeases(now: Date): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ANNOUNCEMENT_LEASE_MS);
  const stale = await db.emailCampaignRecipient.findMany({
    where: { status: "SENDING", claimedAt: { lt: cutoff } },
    select: { id: true, campaignId: true },
    take: 1000,
  });
  if (stale.length === 0) return [];
  await db.emailCampaignRecipient.updateMany({
    where: { id: { in: stale.map((row) => row.id) }, status: "SENDING" },
    data: {
      status: "FAILED",
      lastError: "lease_expired" satisfies AnnouncementSendError,
      claimToken: null,
    },
  });
  return [...new Set(stale.map((row) => row.campaignId))];
}

/**
 * SENT once nothing is PENDING or SENDING — decided in ONE statement, so two
 * runners finishing the last rows at once cannot both finish the campaign.
 */
async function completeIfDone(campaignId: string, now: Date): Promise<void> {
  await db.$executeRawUnsafe(
    "UPDATE email_campaigns SET status = 'SENT', finishedAt = ?, updatedAt = NOW(3)" +
      " WHERE id = ? AND status = 'SENDING' AND NOT EXISTS (" +
      "SELECT 1 FROM email_campaign_recipients r WHERE r.campaignId = ?" +
      " AND r.status IN ('PENDING', 'SENDING'))",
    now,
    campaignId,
    campaignId,
  );
}

// ─── Claiming ────────────────────────────────────────────────

interface ClaimedRecipient {
  id: string;
  campaignId: string;
  email: string;
  userId: string | null;
  subscriberId: string | null;
  name: string | null;
  locale: string;
  attempts: number;
}

/** One UPDATE stamps the token; only rows carrying it are returned (ADR-162 #3). */
async function claimRecipients(limit: number, campaignId?: string): Promise<ClaimedRecipient[]> {
  const token = randomUUID();
  const scope = campaignId
    ? "campaignId = ?"
    : "campaignId IN (SELECT c.id FROM email_campaigns c WHERE c.status = 'SENDING')";
  await db.$executeRawUnsafe(
    "UPDATE email_campaign_recipients SET status = 'SENDING', claimToken = ?, claimedAt = NOW(3)" +
      ` WHERE status = 'PENDING' AND runAfter <= NOW(3) AND ${scope}` +
      " ORDER BY id LIMIT ?",
    token,
    ...(campaignId ? [campaignId] : []),
    limit,
  );
  const rows = await db.emailCampaignRecipient.findMany({
    where: { claimToken: token },
    select: {
      id: true,
      campaignId: true,
      email: true,
      userId: true,
      subscriberId: true,
      name: true,
      locale: true,
      attempts: true,
      campaign: { select: { status: true } },
    },
  });
  // A campaign-scoped claim does not check the campaign's status in SQL; one
  // that was cancelled between the kick and the claim gives its rows back.
  const live = rows.filter((row) => row.campaign.status === "SENDING");
  const dead = rows.filter((row) => row.campaign.status !== "SENDING");
  if (dead.length > 0) {
    await db.emailCampaignRecipient.updateMany({
      where: { id: { in: dead.map((row) => row.id) } },
      data: { status: "SKIPPED", claimToken: null },
    });
  }
  return live.map(({ campaign: _campaign, ...row }) => row);
}

// ─── Settling one row ────────────────────────────────────────

type Settlement = "sent" | "failed" | "retried" | "suppressed" | "released";

async function settle(
  row: ClaimedRecipient,
  result: DeliveryResult,
  now: Date,
): Promise<Settlement> {
  if (result.status === "SENT") {
    await db.emailCampaignRecipient.update({
      where: { id: row.id },
      data: { status: "SENT", sentAt: now, deliveryId: result.deliveryId, claimToken: null },
    });
    return "sent";
  }
  if (result.status === "SUPPRESSED") {
    // The global switch or the template's went off after the session opened.
    // The row is not burned: it goes back to wait (plan §8.2).
    await db.emailCampaignRecipient.update({
      where: { id: row.id },
      data: { status: "PENDING", claimToken: null, claimedAt: null },
    });
    return "released";
  }
  const attempts = row.attempts + 1;
  const delay = ANNOUNCEMENT_RETRY_DELAYS_MS[attempts - 1];
  if (result.failure === "transient" && delay !== undefined) {
    await db.emailCampaignRecipient.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        attempts,
        runAfter: new Date(now.getTime() + delay),
        claimToken: null,
        claimedAt: null,
        lastError: "transient" satisfies AnnouncementSendError,
        deliveryId: result.deliveryId,
      },
    });
    return "retried";
  }
  const code: AnnouncementSendError =
    result.failure === "render"
      ? "render_failed"
      : result.failure === "config"
        ? "template_missing"
        : result.failure === "permanent"
          ? "permanent"
          : "transient";
  await db.emailCampaignRecipient.update({
    where: { id: row.id },
    data: {
      status: "FAILED",
      attempts,
      lastError: code,
      claimToken: null,
      deliveryId: result.deliveryId,
    },
  });
  return "failed";
}

async function failRow(row: ClaimedRecipient, code: AnnouncementSendError): Promise<void> {
  await db.emailCampaignRecipient.update({
    where: { id: row.id },
    data: { status: "FAILED", attempts: row.attempts + 1, lastError: code, claimToken: null },
  });
}

// ─── One campaign's share of a batch ─────────────────────────

interface CampaignBatchContext {
  rows: ClaimedRecipient[];
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  deadline: number;
  gapMs: number;
  tally: DrainResult;
}

/**
 * What one recipient's message needs beyond the address: the locale it renders
 * in, the words (a campaign's own, or null for the template's), the variables
 * and a subject override. Null when it cannot be rendered.
 */
interface PreparedMessage {
  locale: string;
  content?: MessageContent;
  subject?: string;
  variables: Record<string, string>;
}

interface MessageSource {
  session: SendSession;
  prepare(row: ClaimedRecipient): Promise<PreparedMessage | null>;
  /** Whether this row's address is checked against the suppression list. */
  checksSuppression(row: ClaimedRecipient): boolean;
  replyTo?: string;
}

async function courseSource(
  campaign: {
    id: string;
    kind: "COURSE";
    targetId: string | null;
    subject: string | null;
    message: string | null;
    sentById: string | null;
  },
  now: Date,
  locales: Locales,
): Promise<MessageSource | "target_unavailable"> {
  const target = campaign.targetId ? await loadCourseTarget(campaign.targetId, now) : null;
  if (!target || target.availability !== "live") return "target_unavailable";
  const wordsByLocale = new Map<string, CourseEmailWords | null>();
  const session = await createSendSession(ANNOUNCEMENT_TEMPLATE_KEYS[campaign.kind], {
    pool: true,
    triggeredById: campaign.sentById ?? undefined,
  });
  return {
    session,
    checksSuppression: () => true,
    async prepare(row) {
      if (!wordsByLocale.has(row.locale)) {
        wordsByLocale.set(
          row.locale,
          await courseEmailWords(target, row.locale, locales, campaign.message),
        );
      }
      const words = wordsByLocale.get(row.locale) ?? null;
      if (!words) return null;
      return {
        locale: words.locale,
        ...(campaign.subject ? { subject: campaign.subject } : {}),
        variables: words.variables,
      };
    },
  };
}

/**
 * A CUSTOM or DIRECT campaign renders its own stored words (ADR-172 #2), in the
 * recipient's locale when that locale is active and has words, otherwise the
 * default locale's. A direct email to an ACCOUNT holder is correspondence, and
 * an announcements suppression does not stop it (ADR-172 #6); one to a
 * subscriber-only contact is checked like any campaign.
 */
async function contentSource(
  campaign: {
    id: string;
    kind: "CUSTOM" | "DIRECT";
    sentById: string | null;
    createdById: string;
    replyToSelf: boolean;
  },
  locales: Locales,
): Promise<MessageSource | "no_content"> {
  const contents: StoredCampaignContent[] = await loadCampaignContents(campaign.id);
  if (!contents.some((row) => row.locale === locales.defaultLocale)) return "no_content";
  const author =
    campaign.kind === "DIRECT" && campaign.replyToSelf
      ? await db.user.findUnique({ where: { id: campaign.createdById }, select: { email: true } })
      : null;
  const session = await createSendSession(CAMPAIGN_EMAIL_KEY_FOR_KIND[campaign.kind], {
    pool: campaign.kind === "CUSTOM",
    triggeredById: campaign.sentById ?? campaign.createdById,
  });
  return {
    session,
    ...(author ? { replyTo: author.email } : {}),
    checksSuppression: (row) => !(campaign.kind === "DIRECT" && row.userId),
    async prepare(row) {
      const content = pickCampaignContent(contents, row.locale, locales);
      if (!content) return null;
      return {
        locale: content.locale,
        content: {
          subject: content.subject,
          preheader: content.preheader,
          mode: content.mode,
          bodyHtml: content.bodyHtml,
        },
        variables: {},
      };
    },
  };
}

async function sendCampaignRows(campaignId: string, context: CampaignBatchContext): Promise<void> {
  const { rows, tally } = context;
  const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: campaignId } });
  const now = context.now();
  const locales = await loadLocales();

  const source =
    campaign.kind === "COURSE"
      ? await courseSource({ ...campaign, kind: campaign.kind }, now, locales)
      : await contentSource({ ...campaign, kind: campaign.kind }, locales);

  // The course went away mid-campaign, or a custom email lost its words: stop
  // rather than mail a link to a 404 or an empty message.
  if (typeof source === "string") {
    await db.$transaction([
      db.emailCampaignRecipient.updateMany({
        where: { campaignId, status: { in: ["PENDING", "SENDING"] } },
        data: { status: "SKIPPED", claimToken: null },
      }),
      db.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "CANCELLED", cancelReason: source, finishedAt: now },
      }),
    ]);
    tally.cancelled += 1;
    return;
  }

  // Suppression is re-checked just before sending, in one query for the batch:
  // an unsubscribe that lands mid-campaign is honoured (plan §8.2).
  const suppressed = new Set(
    (
      await db.emailSuppression.findMany({
        where: {
          scope: ANNOUNCEMENT_SUPPRESSION_SCOPE,
          email: { in: rows.map((row) => row.email) },
        },
        select: { email: true },
      })
    ).map((row) => row.email),
  );

  const { session } = source;
  try {
    for (const [index, row] of rows.entries()) {
      // Out of time: give the rest back untouched, for the next tick.
      if (Date.now() >= context.deadline) {
        await db.emailCampaignRecipient.updateMany({
          where: { id: { in: rows.slice(index).map((rest) => rest.id) }, status: "SENDING" },
          data: { status: "PENDING", claimToken: null, claimedAt: null },
        });
        break;
      }
      if (source.checksSuppression(row) && suppressed.has(row.email)) {
        await db.emailCampaignRecipient.update({
          where: { id: row.id },
          data: { status: "SUPPRESSED", claimToken: null },
        });
        tally.suppressed += 1;
        continue;
      }

      const message = await source.prepare(row);
      const subject: { kind: UnsubscribeSubjectKind; id: string } | null = row.userId
        ? { kind: "u", id: row.userId }
        : row.subscriberId
          ? { kind: "s", id: row.subscriberId }
          : null;
      if (!message || !subject) {
        await failRow(row, "render_failed");
        tally.failed += 1;
        continue;
      }

      const unsubscribe = await unsubscribeLinks(subject, message.locale);
      const result = await session.send({
        to: row.email,
        locale: message.locale,
        recipientName: row.name ?? "",
        subject: message.subject,
        content: message.content,
        replyTo: source.replyTo,
        variables: { ...message.variables, "unsubscribe.url": unsubscribe.url },
        unsubscribe,
        campaignId,
      });
      const outcome = await settle(row, result, context.now());
      if (outcome === "released") {
        // Sending is off now: give back every row still held, and stop.
        await db.emailCampaignRecipient.updateMany({
          where: { id: { in: rows.slice(index + 1).map((rest) => rest.id) }, status: "SENDING" },
          data: { status: "PENDING", claimToken: null, claimedAt: null },
        });
        tally.paused = true;
        break;
      }
      tally[outcome] += 1;
      if (context.gapMs > 0 && index < rows.length - 1) await context.sleep(context.gapMs);
    }
  } finally {
    session.close();
  }
}

// ─── The drain ───────────────────────────────────────────────

/**
 * Start what is due, expire dead leases, then claim and send batches until
 * the queue is empty or the budget runs out.
 */
export async function drainAnnouncementQueue(options: DrainOptions = {}): Promise<DrainResult> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const deadline = Date.now() + (options.budgetMs ?? 240_000);
  const tally: DrainResult = {
    started: 0,
    cancelled: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    suppressed: 0,
    leaseExpired: 0,
    paused: false,
  };

  const touched = new Set<string>(await expireLeases(now()));
  tally.leaseExpired = touched.size;

  // Switched off: nothing is claimed, so nothing is burned as SUPPRESSED
  // (plan §8.2). Rows stay PENDING and the detail screen says "Paused".
  if ((await loadSetting("email.enabled")) === false) {
    tally.paused = true;
    for (const id of touched) {
      await refreshAnnouncementCounters(id);
      await completeIfDone(id, now());
    }
    return tally;
  }

  if (!options.campaignId) {
    const due = await startDueAnnouncements(now());
    tally.started = due.started;
    tally.cancelled = due.cancelled;
  }

  const batchSize = (await loadSetting("email.campaignBatchSize")) ?? 50;
  const perMinute = (await loadSetting("email.campaignRatePerMinute")) ?? 120;
  const gapMs = Math.ceil(60_000 / Math.max(1, perMinute));

  while (Date.now() < deadline && !tally.paused) {
    const claimed = await claimRecipients(batchSize, options.campaignId);
    if (claimed.length === 0) break;
    const byCampaign = new Map<string, ClaimedRecipient[]>();
    for (const row of claimed) {
      byCampaign.set(row.campaignId, [...(byCampaign.get(row.campaignId) ?? []), row]);
    }
    for (const [campaignId, rows] of byCampaign) {
      touched.add(campaignId);
      await sendCampaignRows(campaignId, { rows, now, sleep, deadline, gapMs, tally });
      if (tally.paused) break;
    }
  }

  // Every campaign this drain touched, plus any still SENDING with nothing
  // left (all its rows expired or were settled by another runner).
  const open = await db.emailCampaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
    take: 200,
  });
  for (const { id } of open) touched.add(id);
  for (const id of touched) {
    await refreshAnnouncementCounters(id);
    await completeIfDone(id, now());
  }
  return tally;
}

// ─── Housekeeping ────────────────────────────────────────────

/**
 * Recipient rows go 90 days after their campaign finished — the delivery
 * log's rule, because they are a list of addresses. The campaign and its
 * counters stay; so does every suppression (ADR-171 #5).
 */
export async function purgeAnnouncementRecipients(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ANNOUNCEMENT_RECIPIENT_RETENTION_DAYS * 86_400_000);
  const finished = await db.emailCampaign.findMany({
    where: { finishedAt: { lt: cutoff }, status: { in: ["SENT", "CANCELLED"] } },
    select: { id: true },
  });
  if (finished.length === 0) return 0;
  const removed = await db.emailCampaignRecipient.deleteMany({
    where: { campaignId: { in: finished.map((row) => row.id) } },
  });
  return removed.count;
}
