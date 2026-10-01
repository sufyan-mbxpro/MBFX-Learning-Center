// Announcement emails (ADR-171, changes-54): one email about one piece of
// content, sent once to a deduplicated set of recipients through a job queue.
//
// Two registries live here and nowhere else: the AUDIENCES an admin may pick
// and the content KINDS an announcement may be about. Both are code, not
// admin options (the ADR-042 split): which people exist to be emailed is a
// question about the data model, and a card with no column behind it would
// count zero or count something it does not say (plan §1).
//
// No words live here (code-style #2). Card labels, descriptions and every
// refusal an admin reads come from the catalog.
import { z } from "zod";

const idSchema = z.string().min(1).max(191);

// ─── Vocabulary (mirrors the Prisma enums) ───────────────────

/**
 * The kinds that are ABOUT a piece of content (they have a `targetId`).
 * Phase 1 is courses only; Phase 2 adds VIDEO_TOPIC, ARTICLE, GLOSSARY_TERM.
 */
export const ANNOUNCEMENT_KINDS = ["COURSE"] as const;
export const announcementKindSchema = z.enum(ANNOUNCEMENT_KINDS);
export type AnnouncementKindInput = z.infer<typeof announcementKindSchema>;

/**
 * Every kind of campaign the queue sends (mirrors the Prisma enum). CUSTOM and
 * DIRECT carry their own words and are about no content (ADR-172).
 */
export const CAMPAIGN_KINDS = ["COURSE", "CUSTOM", "DIRECT"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export function isContentKind(kind: CampaignKind): kind is AnnouncementKindInput {
  return (ANNOUNCEMENT_KINDS as readonly string[]).includes(kind);
}

export const ANNOUNCEMENT_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "CANCELLED",
] as const;
export type AnnouncementStatusValue = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_RECIPIENT_STATUSES = [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
  "SUPPRESSED",
  "SKIPPED",
] as const;
export type AnnouncementRecipientStatusValue = (typeof ANNOUNCEMENT_RECIPIENT_STATUSES)[number];

/** The email template each kind renders with (ADR-171 #8). */
export const ANNOUNCEMENT_TEMPLATE_KEYS = {
  COURSE: "announcement.course",
} as const satisfies Record<AnnouncementKindInput, string>;

// ─── Audiences (ADR-171 #6, plan §4) ─────────────────────────

/**
 * The cards the Audience step draws, in the order it draws them. Every one
 * starts from the eligible base (a live, unbanned, unsuspended LEARNER, or an
 * ACTIVE newsletter subscriber) and has suppressed addresses removed. STAFF are
 * in none of them, `custom` included (owner, D3).
 */
export const ANNOUNCEMENT_AUDIENCES = [
  "all_learners",
  "active",
  "verified",
  "inactive",
  "subscribers",
  "course_learners",
  "custom",
] as const;

/**
 * A custom email's cards: every announcement card, plus every live STAFF
 * account (owner, E3; ADR-172 #5 amends ADR-171 #6 for this kind only). A
 * course announcement never offers `staff`.
 */
export const CUSTOM_EMAIL_AUDIENCES = [...ANNOUNCEMENT_AUDIENCES, "staff"] as const;

export const announcementAudienceKeySchema = z.enum(CUSTOM_EMAIL_AUDIENCES);
export type AnnouncementAudienceKey = (typeof CUSTOM_EMAIL_AUDIENCES)[number];

/** Which cards a campaign of `kind` may use. A DIRECT email has no audience. */
export function audiencesForKind(kind: CampaignKind): readonly AnnouncementAudienceKey[] {
  if (kind === "CUSTOM") return CUSTOM_EMAIL_AUDIENCES;
  if (kind === "DIRECT") return [];
  return ANNOUNCEMENT_AUDIENCES;
}

/** The cards that need ids beside the key, and the cap on each. */
export const MAX_AUDIENCE_COURSES = 20;
export const MAX_AUDIENCE_USERS = 500;

/**
 * The `EmailCampaign.audience` JSON.
 *
 * Keys are a SET: a repeat is refused rather than silently collapsed, so the
 * form and the stored row cannot disagree about what was picked. Ids are
 * required exactly when their card is picked, and refused otherwise — a
 * stored `userIds` list with no `custom` key is a list of people nobody chose
 * to email.
 */
export const announcementAudienceSchema = z
  .object({
    keys: z.array(announcementAudienceKeySchema).min(1).max(CUSTOM_EMAIL_AUDIENCES.length),
    courseIds: z.array(idSchema).max(MAX_AUDIENCE_COURSES).optional(),
    userIds: z.array(idSchema).max(MAX_AUDIENCE_USERS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.keys).size !== value.keys.length) {
      ctx.addIssue({ code: "custom", path: ["keys"], message: "duplicate" });
    }
    const hasCourses = value.keys.includes("course_learners");
    const hasUsers = value.keys.includes("custom");
    if (hasCourses && (value.courseIds?.length ?? 0) === 0) {
      ctx.addIssue({ code: "custom", path: ["courseIds"], message: "required" });
    }
    if (!hasCourses && value.courseIds !== undefined && value.courseIds.length > 0) {
      ctx.addIssue({ code: "custom", path: ["courseIds"], message: "unexpected" });
    }
    if (hasUsers && (value.userIds?.length ?? 0) === 0) {
      ctx.addIssue({ code: "custom", path: ["userIds"], message: "required" });
    }
    if (!hasUsers && value.userIds !== undefined && value.userIds.length > 0) {
      ctx.addIssue({ code: "custom", path: ["userIds"], message: "unexpected" });
    }
  });
export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>;

// ─── The draft ───────────────────────────────────────────────

/** Strip CR/LF so an override can never inject a header (ADR-078 #6). */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export const ANNOUNCEMENT_MESSAGE_MAX = 500;

/**
 * What the four-step editor saves. `subject` and `message` are the ONLY
 * per-campaign words (ADR-171 #8): an empty value means "the template's own".
 * The audience may be absent while a draft is still on step 1 or 2.
 */
export const announcementSaveSchema = z.object({
  id: idSchema.optional(),
  kind: announcementKindSchema,
  targetId: idSchema,
  name: z.string().transform(singleLine).pipe(z.string().min(1).max(160)),
  subject: z
    .string()
    .transform(singleLine)
    .pipe(z.string().max(200))
    .optional()
    .transform((value) => (value ? value : null)),
  message: z
    .string()
    .trim()
    .max(ANNOUNCEMENT_MESSAGE_MAX)
    .optional()
    .transform((value) => (value ? value : null)),
  // Staff are never announced to (ADR-171 #6); only a custom email has them.
  audience: announcementAudienceSchema
    .refine((value) => !value.keys.includes("staff"), { path: ["keys"] })
    .optional(),
});
export type AnnouncementSaveInput = z.input<typeof announcementSaveSchema>;
export type AnnouncementSave = z.output<typeof announcementSaveSchema>;

/** Schedule: a future instant, entered in the editor's own clock (ADR-071). */
export const announcementScheduleSchema = z.object({
  id: idSchema,
  scheduledFor: z.coerce.date(),
});

export const announcementIdSchema = z.object({ id: idSchema });

/** The isolated preview route's announcement mode (plan §10.3). */
export const announcementPreviewSchema = z.object({
  campaignId: idSchema,
  locale: z.string().min(2).max(10),
});

/** The admin's "Select users" search box. */
export const announcementUserSearchSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

// ─── Suppression ─────────────────────────────────────────────

/** The one normalisation every address passes through (ADR-171 #2). */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const emailSuppressionSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
});

// ─── The unsubscribe token (ADR-171 #9, plan §9.1) ───────────

/**
 * `v1.<payload>.<signature>`, both base64url. The shape only: whether the
 * signature is RIGHT is `@repo/email`'s `links.ts`, the one reader of
 * `EMAIL_LINK_SECRET`. A 256-bit HMAC is 43 characters; a cuid payload
 * (`u:` + ≤191) stays under 260.
 */
export const unsubscribeTokenSchema = z
  .string()
  .max(400)
  .regex(/^v1\.[A-Za-z0-9_-]{4,260}\.[A-Za-z0-9_-]{43}$/);

/**
 * What the unsubscribe route is asked to do (ADR-171 #9). A mail client's
 * RFC 8058 one-click sends no `op`, which is the unsubscribe; the page's
 * Undo and "also the newsletter" buttons name theirs.
 */
export const ANNOUNCEMENT_UNSUBSCRIBE_OPS = ["unsubscribe", "undo", "newsletter"] as const;
export const announcementUnsubscribeOpSchema = z
  .enum(ANNOUNCEMENT_UNSUBSCRIBE_OPS)
  .catch("unsubscribe");
export type AnnouncementUnsubscribeOp = (typeof ANNOUNCEMENT_UNSUBSCRIBE_OPS)[number];

/** Who a token names: an account (`u`) or a subscription (`s`). */
export const UNSUBSCRIBE_SUBJECT_KINDS = ["u", "s"] as const;
export type UnsubscribeSubjectKind = (typeof UNSUBSCRIBE_SUBJECT_KINDS)[number];

// ─── Refusals ────────────────────────────────────────────────

/**
 * Why `queueAnnouncement` will not start, each with its own catalog message
 * and fix-it link on the Review step (plan §8.1). A code, never prose.
 */
export const ANNOUNCEMENT_REFUSALS = [
  "not_draft",
  "target_unavailable",
  "email_disabled",
  "template_inactive",
  "no_postal_address",
  "no_link_secret",
  "no_audience",
  "no_recipients",
  "schedule_in_past",
  // ADR-172: a custom email with no words, or edited since its last test.
  "no_content",
  "test_required",
] as const;
export type AnnouncementRefusal = (typeof ANNOUNCEMENT_REFUSALS)[number];

/** A recipient's `lastError`: a taxonomy, never a provider message (ADR-162 #1). */
export const ANNOUNCEMENT_SEND_ERRORS = [
  "transient",
  "permanent",
  "lease_expired",
  "render_failed",
  "template_missing",
] as const;
export type AnnouncementSendError = (typeof ANNOUNCEMENT_SEND_ERRORS)[number];
