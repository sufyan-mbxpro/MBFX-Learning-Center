"use server";

// Announcement actions (ADR-171, changes-54 N6).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse
// through `@repo/contracts`, then the `@repo/core` service — which re-checks
// its own key (defence in depth) and writes the audit row.
//
// Refusals an admin can act on come back as a RESULT, not a throw: a thrown
// error's message is replaced by a generic one in production builds, and the
// Review step needs to say WHICH check failed ("add a postal address").
//
// **Sending never happens here.** Send writes recipient rows (the job queue,
// owner D8) and the first batches go out in `after()`; the cron route drains
// the rest.
import { after } from "next/server";
import { z } from "zod";
import {
  AnnouncementPermissionError,
  AnnouncementRefusedError,
  addAnnouncementSuppression,
  cancelAnnouncement,
  deleteAnnouncementDraft,
  drainAnnouncementQueue,
  duplicateAnnouncement,
  queueAnnouncement,
  removeAnnouncementSuppression,
  retryFailedRecipients,
  saveAnnouncementDraft,
  scheduleAnnouncement,
  searchAnnounceableCourses,
  searchAnnouncementUsers,
  sendAnnouncementTest,
  summariseAudience,
  unscheduleAnnouncement,
  type AnnounceableCourse,
  type AnnouncementUserOption,
  type AudienceSummary,
  type QueueOutcome,
} from "@repo/core";
import {
  announcementAudienceSchema,
  announcementIdSchema,
  announcementSaveSchema,
  announcementScheduleSchema,
  announcementUserSearchSchema,
  emailSuppressionSchema,
  type AnnouncementRefusal,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export type AnnouncementRefused = { ok: false; reason: AnnouncementRefusal | "forbidden" };

async function refusals<T extends { ok: true }>(
  work: () => Promise<T>,
): Promise<T | AnnouncementRefused> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AnnouncementRefusedError) return { ok: false, reason: error.reason };
    // The action's own gate passed, so this is a SECOND key the service needs
    // (the failures table's `email.log.view`, the picker's `users.view`).
    if (error instanceof AnnouncementPermissionError) return { ok: false, reason: "forbidden" };
    throw error;
  }
}

/** Kick the queue after the response, so the first batches leave in seconds. */
function drainSoon(campaignId: string): void {
  after(() => drainAnnouncementQueue({ campaignId, budgetMs: 50_000 }).then(() => undefined));
}

/** Create (no id) or update a DRAFT. Returns the id, so a new draft can open its editor. */
export async function saveAnnouncementDraftAction(
  input: unknown,
): Promise<{ ok: true; id: string } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.create");
  const parsed = announcementSaveSchema.parse(input);
  return refusals(async () => ({
    ok: true as const,
    id: await saveAnnouncementDraft(subject, parsed),
  }));
}

export async function deleteAnnouncementDraftAction(
  id: unknown,
): Promise<{ ok: true } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.create");
  const parsed = announcementIdSchema.parse({ id });
  return refusals(async () => {
    await deleteAnnouncementDraft(subject, parsed.id);
    return { ok: true as const };
  });
}

export async function duplicateAnnouncementAction(id: unknown): Promise<string> {
  const subject = await requirePermission("announcements.create");
  const parsed = announcementIdSchema.parse({ id });
  return duplicateAnnouncement(subject, parsed.id);
}

export async function searchAnnounceableCoursesAction(
  query: unknown,
): Promise<AnnounceableCourse[]> {
  const subject = await requirePermission("announcements.create");
  const parsed = z
    .string()
    .max(100)
    .parse(query ?? "");
  return searchAnnounceableCourses(subject, parsed);
}

export async function searchAnnouncementUsersAction(
  query: unknown,
): Promise<AnnouncementUserOption[]> {
  // Both keys: without `users.view` the picker would read the user list.
  const subject = await requirePermission("announcements.create");
  await requirePermission("users.view");
  const parsed = announcementUserSearchSchema.safeParse({ query });
  if (!parsed.success) return [];
  return searchAnnouncementUsers(subject, parsed.data.query);
}

/** The Audience step's live counts. */
export async function summariseAudienceAction(input: unknown): Promise<AudienceSummary> {
  const subject = await requirePermission("announcements.create");
  const parsed = z
    .object({
      targetId: z.string().min(1).max(191),
      audience: announcementAudienceSchema.nullable(),
    })
    .parse(input);
  return summariseAudience(subject, parsed.targetId, parsed.audience);
}

export async function sendAnnouncementTestAction(
  input: unknown,
): Promise<{ ok: true; status: string } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.create");
  const parsed = z
    .object({
      id: z.string().min(1).max(191),
      locale: z.string().min(2).max(10).optional(),
      // The dialog prefills the admin's own address and lets them change it.
      to: z.email().max(255).optional(),
    })
    .parse(input);
  return refusals(async () => {
    const result = await sendAnnouncementTest(subject, parsed.id, {
      locale: parsed.locale,
      to: parsed.to,
    });
    return { ok: true as const, status: result.status };
  });
}

/** Send now: queue the recipients, then kick the runner after the response. */
export async function queueAnnouncementAction(
  id: unknown,
): Promise<({ ok: true } & QueueOutcome) | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = announcementIdSchema.parse({ id });
  return refusals(async () => {
    const outcome = await queueAnnouncement(subject, parsed.id);
    if (outcome.state === "sending") drainSoon(parsed.id);
    return { ok: true as const, ...outcome };
  });
}

export async function scheduleAnnouncementAction(
  input: unknown,
): Promise<{ ok: true } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = announcementScheduleSchema.parse(input);
  return refusals(async () => {
    await scheduleAnnouncement(subject, parsed.id, parsed.scheduledFor);
    return { ok: true as const };
  });
}

export async function unscheduleAnnouncementAction(
  id: unknown,
): Promise<{ ok: true } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = announcementIdSchema.parse({ id });
  return refusals(async () => {
    await unscheduleAnnouncement(subject, parsed.id);
    return { ok: true as const };
  });
}

export async function cancelAnnouncementAction(
  id: unknown,
): Promise<{ ok: true } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = announcementIdSchema.parse({ id });
  return refusals(async () => {
    await cancelAnnouncement(subject, parsed.id);
    return { ok: true as const };
  });
}

export async function retryFailedAnnouncementAction(
  id: unknown,
): Promise<{ ok: true; retried: number } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = announcementIdSchema.parse({ id });
  return refusals(async () => {
    const retried = await retryFailedRecipients(subject, parsed.id);
    drainSoon(parsed.id);
    return { ok: true as const, retried };
  });
}

/** The user detail screen's "Stop announcements" switch (ADR-171 #5). */
export async function setAnnouncementSuppressionAction(
  input: unknown,
): Promise<{ ok: true; removed?: boolean } | AnnouncementRefused> {
  const subject = await requirePermission("announcements.send");
  const parsed = emailSuppressionSchema.extend({ suppressed: z.boolean() }).parse(input);
  return refusals(async () => {
    if (parsed.suppressed) {
      await addAnnouncementSuppression(subject, parsed.email);
      return { ok: true as const };
    }
    return {
      ok: true as const,
      removed: await removeAnnouncementSuppression(subject, parsed.email),
    };
  });
}
