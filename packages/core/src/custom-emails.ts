// Custom and direct emails (ADR-172, changes-55): designs, the composer's
// draft, its test, its preview, and the one-to-one "Send email" dialog.
//
// A custom email is an `EmailCampaign` of kind CUSTOM and rides everything
// ADR-171 built — audiences, dedupe, suppression, the queue, the runner — so
// this file only adds what differs: the words are the author's, stored per
// locale in `EmailCampaignContent`, sanitised on every save, and a bulk send
// waits for a test since the last edit (owner, E5).
//
// A direct email is a CUSTOM-shaped campaign with exactly one recipient,
// created already SENDING, so it gets the delivery log, the audit row, retry
// and at-most-once delivery with no second send path (ADR-172 #1).
//
// Every mutation checks its own key behind the action's `requirePermission`
// (security.md #1) and audits ids and counts — never an address, never a body.
import {
  CUSTOM_EMAIL_AUDIENCES,
  DIRECT_SEND_LIMIT_PER_HOUR,
  EMAIL_BODY_MAX,
  normaliseEmail,
  type AnnouncementAudience,
  type CampaignContent,
  type CustomEmailSave,
  type DirectEmail,
  type DirectEmailRefusal,
  type DirectRecipientKind,
  type EmailDesignSave,
} from "@repo/contracts";
import { SubscriberStatus, db, type EmailBodyMode } from "@repo/db";
import {
  createSendSession,
  hasLinkSecret,
  loadEmailRenderContext,
  renderEmail,
  sanitizeEmailHtml,
  type DeliveryResult,
  type RenderedEmail,
} from "@repo/email";
import { catalogMessage } from "@repo/i18n";
import { can, type Subject } from "@repo/rbac";
import { loadSetting } from "@repo/settings";
import { siteOrigin } from "@repo/utils";
import { loadLocales } from "./announcement-target.ts";
import {
  ANNOUNCEMENT_SUPPRESSION_SCOPE,
  AnnouncementNotFoundError,
  AnnouncementPermissionError,
  AnnouncementRefusedError,
  unsubscribeLinks,
} from "./announcements.ts";
import {
  hashCampaignContents,
  loadCampaignContents,
  pickCampaignContent,
  type StoredCampaignContent,
} from "./campaign-content.ts";
import { recordAudit } from "./index.ts";

// ─── Errors and keys ─────────────────────────────────────────

export class EmailDesignNotFoundError extends Error {
  constructor(id: string) {
    super(`Email design ${id} not found`);
    this.name = "EmailDesignNotFoundError";
  }
}

/** Why a direct email was refused; the dialog names it (ADR-172 #6, #7). */
export class DirectEmailRefusedError extends Error {
  constructor(readonly reason: DirectEmailRefusal) {
    super(`Direct email refused: ${reason}`);
    this.name = "DirectEmailRefusedError";
  }
}

/** A body that sanitising left empty or still too large. */
export class EmailBodyInvalidError extends Error {
  constructor(readonly reason: "empty" | "too_large") {
    super(`Email body refused: ${reason}`);
    this.name = "EmailBodyInvalidError";
  }
}

function requireKey(actor: Subject, permission: string): void {
  if (!can(actor, permission)) throw new AnnouncementPermissionError(permission);
}

function requireAnyKey(actor: Subject, permissions: readonly string[]): void {
  if (!permissions.some((permission) => can(actor, permission))) {
    throw new AnnouncementPermissionError(permissions.join(" | "));
  }
}

/**
 * Who may READ designs: the Templates screen's viewers, and anyone who can
 * start an email from one (the composer's and the dialog's pickers).
 */
const DESIGN_READERS = ["email.templates.view", "announcements.create", "announcements.direct"];

/**
 * The server-side sanitiser, then the size cap again: the schema measured
 * what was typed, and this measures what will be stored and sent.
 */
function cleanBody(bodyHtml: string, mode: EmailBodyMode): string {
  const clean = sanitizeEmailHtml(bodyHtml, mode).trim();
  if (clean === "") throw new EmailBodyInvalidError("empty");
  if (Buffer.byteLength(clean, "utf8") > EMAIL_BODY_MAX) {
    throw new EmailBodyInvalidError("too_large");
  }
  return clean;
}

// ─── Designs (ADR-172 #3) ────────────────────────────────────

export interface EmailDesignRow {
  id: string;
  name: string;
  description: string | null;
  mode: EmailBodyMode;
  subject: string | null;
  preheader: string | null;
  bodyHtml: string;
  archivedAt: Date | null;
  updatedAt: Date;
  updatedByName: string | null;
}

export async function listEmailDesigns(
  actor: Subject,
  options: { includeArchived?: boolean } = {},
): Promise<EmailDesignRow[]> {
  requireAnyKey(actor, DESIGN_READERS);
  const rows = await db.emailDesign.findMany({
    where: options.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    take: 200,
  });
  const editorIds = [
    ...new Set(rows.map((row) => row.updatedById ?? row.createdById).filter(Boolean)),
  ];
  const editors = await db.user.findMany({
    where: { id: { in: editorIds } },
    select: { id: true, name: true },
  });
  const names = new Map(editors.map((user) => [user.id, user.name]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    mode: row.mode,
    subject: row.subject,
    preheader: row.preheader,
    bodyHtml: row.bodyHtml,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
    updatedByName: names.get(row.updatedById ?? row.createdById) ?? null,
  }));
}

export async function getEmailDesign(actor: Subject, id: string): Promise<EmailDesignRow> {
  requireAnyKey(actor, DESIGN_READERS);
  const row = await db.emailDesign.findUnique({ where: { id } });
  if (!row) throw new EmailDesignNotFoundError(id);
  return { ...row, updatedByName: null };
}

export async function saveEmailDesign(actor: Subject, input: EmailDesignSave): Promise<string> {
  requireKey(actor, "email.templates.update");
  const data = {
    name: input.name,
    description: input.description,
    mode: input.mode,
    subject: input.subject,
    preheader: input.preheader,
    bodyHtml: cleanBody(input.bodyHtml, input.mode),
  };
  let id: string;
  if (input.id) {
    const existing = await db.emailDesign.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new EmailDesignNotFoundError(input.id);
    await db.emailDesign.update({
      where: { id: input.id },
      data: { ...data, updatedById: actor.id },
    });
    id = input.id;
  } else {
    const row = await db.emailDesign.create({
      data: { ...data, createdById: actor.id },
      select: { id: true },
    });
    id = row.id;
  }
  await recordAudit({
    userId: actor.id,
    action: input.id ? "email.design.update" : "email.design.create",
    entityType: "email_design",
    entityId: id,
    changes: { after: { name: input.name, mode: input.mode } },
  });
  return id;
}

export async function duplicateEmailDesign(actor: Subject, id: string): Promise<string> {
  requireKey(actor, "email.templates.update");
  const row = await db.emailDesign.findUnique({ where: { id } });
  if (!row) throw new EmailDesignNotFoundError(id);
  const copy = await db.emailDesign.create({
    data: {
      name: row.name.slice(0, 120),
      description: row.description,
      mode: row.mode,
      subject: row.subject,
      preheader: row.preheader,
      bodyHtml: row.bodyHtml,
      createdById: actor.id,
    },
    select: { id: true },
  });
  await recordAudit({
    userId: actor.id,
    action: "email.design.create",
    entityType: "email_design",
    entityId: copy.id,
    changes: { after: { duplicateOf: id } },
  });
  return copy.id;
}

/** Archive hides a design from the pickers; restore is the undo (code-style #7). */
export async function setEmailDesignArchived(
  actor: Subject,
  id: string,
  archived: boolean,
): Promise<void> {
  requireKey(actor, "email.templates.update");
  const updated = await db.emailDesign.updateMany({
    where: { id },
    data: { archivedAt: archived ? new Date() : null, updatedById: actor.id },
  });
  if (updated.count === 0) throw new EmailDesignNotFoundError(id);
  await recordAudit({
    userId: actor.id,
    action: archived ? "email.design.archive" : "email.design.restore",
    entityType: "email_design",
    entityId: id,
  });
}

// ─── Rendering (preview and test) ────────────────────────────

/**
 * A preview never mints a working unsubscribe token for anyone (the
 * announcement preview's rule): the link is a placeholder on this site.
 */
async function renderWords(
  key: "campaign.custom" | "campaign.direct",
  content: { subject: string; preheader?: string | null; mode: EmailBodyMode; bodyHtml: string },
  locale: string,
  recipient: { name: string; email: string },
): Promise<RenderedEmail> {
  const context = await loadEmailRenderContext();
  const placeholder = `${siteOrigin().replace(/\/+$/, "")}/email/unsubscribe?t=preview`;
  const label = (await catalogMessage(locale, "announcements.unsubscribe.footerLink")) ?? "";
  return renderEmail({
    key,
    mode: content.mode,
    subject: content.subject,
    preheader: content.preheader ?? undefined,
    bodyHtml: content.bodyHtml,
    variables: {
      ...context.globals,
      "recipient.name": recipient.name,
      "recipient.email": recipient.email,
      "unsubscribe.url": placeholder,
    },
    palette: context.palette,
    shell: { ...context.shell, unsubscribe: { url: placeholder, label } },
  });
}

/** The design editor's preview, through the isolated preview route. */
export async function renderEmailDesignPreview(
  actor: Subject,
  input: {
    designId?: string;
    draft?: Pick<EmailDesignSave, "mode" | "subject" | "preheader" | "bodyHtml">;
  },
): Promise<RenderedEmail | null> {
  requireAnyKey(actor, DESIGN_READERS);
  const source = input.draft
    ? input.draft
    : input.designId
      ? await db.emailDesign.findUnique({ where: { id: input.designId } })
      : null;
  if (!source) return null;
  const { defaultLocale } = await loadLocales();
  return renderWords(
    "campaign.custom",
    {
      subject: source.subject ?? "",
      preheader: source.preheader,
      mode: source.mode,
      bodyHtml: sanitizeEmailHtml(source.bodyHtml, source.mode),
    },
    defaultLocale,
    { name: "Alex Morgan", email: "alex@example.com" },
  );
}

// ─── A custom email (ADR-172 #1, #2) ─────────────────────────

/**
 * Create or update a CUSTOM draft. The Content step sends one locale's words;
 * the Audience step sends the audience. Words are sanitised here, the locale
 * must be ACTIVE, and the Staff card needs `employees.view` (ADR-172 #5), the
 * hand-picked one `users.view` (ADR-171 #11).
 */
export async function saveCustomEmail(actor: Subject, input: CustomEmailSave): Promise<string> {
  requireKey(actor, "announcements.create");
  if (input.audience) assertAudienceAllowed(actor, input.audience);
  let content: CampaignContent | undefined;
  if (input.content) {
    const { active } = await loadLocales();
    if (!active.includes(input.content.locale)) throw new AnnouncementRefusedError("no_content");
    content = { ...input.content, bodyHtml: cleanBody(input.content.bodyHtml, input.content.mode) };
  }

  const id = await db.$transaction(async (tx) => {
    let campaignId: string;
    if (input.id) {
      const existing = await tx.emailCampaign.findUnique({
        where: { id: input.id },
        select: { status: true, kind: true },
      });
      if (!existing || existing.kind !== "CUSTOM") throw new AnnouncementNotFoundError(input.id);
      // Words are frozen once a campaign leaves DRAFT (ADR-172 #2).
      if (existing.status !== "DRAFT") throw new AnnouncementRefusedError("not_draft");
      await tx.emailCampaign.update({
        where: { id: input.id },
        data: {
          name: input.name,
          ...(input.designId !== undefined ? { designId: input.designId } : {}),
          ...(input.audience ? { audience: input.audience } : {}),
        },
      });
      campaignId = input.id;
    } else {
      const row = await tx.emailCampaign.create({
        data: {
          kind: "CUSTOM",
          targetId: null,
          name: input.name,
          designId: input.designId ?? null,
          audience: input.audience ?? { keys: [] },
          createdById: actor.id,
        },
        select: { id: true },
      });
      campaignId = row.id;
    }
    if (content) {
      const words = {
        subject: content.subject,
        preheader: content.preheader,
        mode: content.mode,
        bodyHtml: content.bodyHtml,
      };
      await tx.emailCampaignContent.upsert({
        where: { campaignId_locale: { campaignId, locale: content.locale } },
        update: words,
        create: { campaignId, locale: content.locale, ...words },
      });
    }
    return campaignId;
  });

  await recordAudit({
    userId: actor.id,
    action: input.id ? "announcements.update" : "announcements.create",
    entityType: "announcement",
    entityId: id,
    changes: {
      after: {
        kind: "CUSTOM",
        name: input.name,
        locale: content?.locale ?? null,
        audience: input.audience?.keys ?? null,
      },
    },
  });
  return id;
}

function assertAudienceAllowed(actor: Subject, audience: AnnouncementAudience): void {
  for (const key of audience.keys) {
    if (!(CUSTOM_EMAIL_AUDIENCES as readonly string[]).includes(key)) {
      throw new AnnouncementRefusedError("no_audience");
    }
  }
  if (audience.keys.includes("staff")) requireKey(actor, "employees.view");
  if (audience.keys.includes("custom")) requireKey(actor, "users.view");
}

export interface CustomEmailDraft {
  id: string;
  name: string;
  designId: string | null;
  contents: StoredCampaignContent[];
  /** A test went out since the last edit (the Review step's tick, E5). */
  tested: boolean;
  lastTestedAt: Date | null;
}

export async function getCustomEmailDraft(actor: Subject, id: string): Promise<CustomEmailDraft> {
  requireKey(actor, "announcements.view");
  const row = await db.emailCampaign.findUnique({ where: { id } });
  // A direct email's words are read the same way (its detail page); only a
  // CUSTOM draft is ever saved through the composer.
  if (!row || (row.kind !== "CUSTOM" && row.kind !== "DIRECT")) {
    throw new AnnouncementNotFoundError(id);
  }
  const contents = await loadCampaignContents(id);
  return {
    id: row.id,
    name: row.name,
    designId: row.designId,
    contents,
    tested: contents.length > 0 && row.testedHash === hashCampaignContents(contents),
    lastTestedAt: row.lastTestedAt,
  };
}

/**
 * "Send me a test" (owner, E5): one message to the acting admin — or to `to`,
 * when they typed another address in the dialog — in `locale` (default: the
 * default locale), with no recipient row. On delivery it records the hash of
 * EVERY locale's words, which is what the Review step compares. A test ignores
 * nothing a real send obeys except the audience.
 */
export async function sendCustomEmailTest(
  actor: Subject,
  id: string,
  options: { locale?: string | undefined; to?: string | undefined } = {},
): Promise<DeliveryResult> {
  const { locale } = options;
  requireKey(actor, "announcements.create");
  const row = await db.emailCampaign.findUnique({ where: { id } });
  if (!row || row.kind !== "CUSTOM") throw new AnnouncementNotFoundError(id);
  if (!hasLinkSecret()) throw new AnnouncementRefusedError("no_link_secret");
  const [me, contents, locales] = await Promise.all([
    db.user.findUnique({ where: { id: actor.id }, select: { email: true, name: true } }),
    loadCampaignContents(id),
    loadLocales(),
  ]);
  if (!me) throw new AnnouncementNotFoundError(actor.id);
  const content = pickCampaignContent(contents, locale ?? locales.defaultLocale, locales);
  if (!content || !contents.some((c) => c.locale === locales.defaultLocale)) {
    throw new AnnouncementRefusedError("no_content");
  }
  const unsubscribe = await unsubscribeLinks({ kind: "u", id: actor.id }, content.locale);
  const session = await createSendSession("campaign.custom", {
    isTest: true,
    triggeredById: actor.id,
  });
  let result: DeliveryResult;
  try {
    result = await session.send({
      to: options.to || me.email,
      locale: content.locale,
      recipientName: me.name,
      content,
      variables: { "unsubscribe.url": unsubscribe.url },
      unsubscribe,
      campaignId: id,
    });
  } finally {
    session.close();
  }
  if (result.status === "SENT") {
    // Only a DRAFT can still change; a test of a sent campaign records nothing.
    await db.emailCampaign.updateMany({
      where: { id, status: "DRAFT" },
      data: { lastTestedAt: new Date(), testedHash: hashCampaignContents(contents) },
    });
  }
  await recordAudit({
    userId: actor.id,
    action: "announcements.test",
    entityType: "announcement",
    entityId: id,
    changes: {
      after: { locale: content.locale, status: result.status, to: options.to || me.email },
    },
  });
  return result;
}

/** The composer's live preview, served by the isolated preview route. */
export async function renderCustomEmailPreview(
  actor: Subject,
  input: { campaignId: string; locale: string },
): Promise<RenderedEmail | null> {
  requireKey(actor, "announcements.view");
  const row = await db.emailCampaign.findUnique({
    where: { id: input.campaignId },
    select: { kind: true },
  });
  if (!row || (row.kind !== "CUSTOM" && row.kind !== "DIRECT")) return null;
  const [contents, locales] = await Promise.all([
    loadCampaignContents(input.campaignId),
    loadLocales(),
  ]);
  const content = pickCampaignContent(contents, input.locale, locales);
  if (!content) return null;
  return renderWords(
    row.kind === "DIRECT" ? "campaign.direct" : "campaign.custom",
    content,
    content.locale,
    { name: "Alex Morgan", email: "alex@example.com" },
  );
}

// ─── A direct email (ADR-172 #6, #7) ─────────────────────────

export interface DirectRecipientView {
  kind: DirectRecipientKind;
  id: string;
  name: string;
  email: string;
  locale: string;
  /** The address has unsubscribed from campaign emails. */
  suppressed: boolean;
  /** When set, the dialog refuses and says why; nothing else is shown. */
  refusal: Extract<DirectEmailRefusal, "recipient_unavailable" | "recipient_unsubscribed"> | null;
}

/** The view key a recipient kind needs, besides `announcements.direct`. */
const VIEW_KEY: Record<DirectRecipientKind, string> = {
  user: "users.view",
  subscriber: "newsletter.view",
};

/**
 * Who a direct email would reach, and whether it may (ADR-172 #6):
 * - an ACCOUNT (learner or staff, banned or suspended included) that is not
 *   deleted — a campaigns suppression only warns;
 * - a SUBSCRIPTION that is ACTIVE and not suppressed. A pending address never
 *   proved it is theirs, and an unsubscribed one asked to stop.
 */
export async function directRecipient(
  actor: Subject,
  recipient: { kind: DirectRecipientKind; id: string },
): Promise<DirectRecipientView> {
  requireKey(actor, "announcements.direct");
  requireKey(actor, VIEW_KEY[recipient.kind]);
  if (recipient.kind === "user") {
    const user = await db.user.findUnique({
      where: { id: recipient.id },
      select: { id: true, name: true, email: true, locale: true, deletedAt: true },
    });
    if (!user) throw new AnnouncementNotFoundError(recipient.id);
    const suppressed = await isSuppressed(user.email);
    return {
      kind: "user",
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      suppressed,
      refusal: user.deletedAt ? "recipient_unavailable" : null,
    };
  }
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { id: recipient.id },
    select: { id: true, email: true, locale: true, status: true },
  });
  if (!subscriber) throw new AnnouncementNotFoundError(recipient.id);
  const suppressed = await isSuppressed(subscriber.email);
  return {
    kind: "subscriber",
    id: subscriber.id,
    name: "",
    email: subscriber.email,
    locale: subscriber.locale,
    suppressed,
    refusal:
      subscriber.status === SubscriberStatus.PENDING
        ? "recipient_unavailable"
        : subscriber.status === SubscriberStatus.UNSUBSCRIBED || suppressed
          ? "recipient_unsubscribed"
          : null,
  };
}

async function isSuppressed(email: string): Promise<boolean> {
  const row = await db.emailSuppression.findUnique({
    where: {
      email_scope: { email: normaliseEmail(email), scope: ANNOUNCEMENT_SUPPRESSION_SCOPE },
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Send one email to one person (ADR-172 #1, #6, #7): refuse what the dialog
 * would refuse, hold the per-author hourly brake, then write the campaign, its
 * words and its single recipient in ONE transaction, already SENDING. The
 * action kicks the runner in `after()`; the minute cron picks it up otherwise.
 */
export async function sendDirectEmail(
  actor: Subject,
  input: DirectEmail,
  now: Date = new Date(),
): Promise<{ campaignId: string }> {
  requireKey(actor, "announcements.direct");
  requireKey(actor, VIEW_KEY[input.recipient.kind]);
  if ((await loadSetting("email.enabled")) === false) {
    throw new DirectEmailRefusedError("email_disabled");
  }
  if (!hasLinkSecret()) throw new DirectEmailRefusedError("no_link_secret");

  const person = await directRecipient(actor, input.recipient);
  if (person.refusal) throw new DirectEmailRefusedError(person.refusal);

  const sentLastHour = await db.emailCampaign.count({
    where: {
      kind: "DIRECT",
      createdById: actor.id,
      createdAt: { gte: new Date(now.getTime() - 3_600_000) },
    },
  });
  if (sentLastHour >= DIRECT_SEND_LIMIT_PER_HOUR) {
    throw new DirectEmailRefusedError("rate_limited");
  }

  const bodyHtml = cleanBody(input.bodyHtml, input.mode);
  const { defaultLocale } = await loadLocales();
  const campaign = await db.emailCampaign.create({
    data: {
      kind: "DIRECT",
      targetId: null,
      name: input.subject.slice(0, 160),
      audience: { keys: [] },
      status: "SENDING",
      snapshotAt: now,
      startedAt: now,
      recipientCount: 1,
      designId: input.designId ?? null,
      replyToSelf: input.replyToSelf,
      createdById: actor.id,
      sentById: actor.id,
      // The author writes in one language; it is stored as the default
      // locale's words, which every recipient locale falls back to.
      contents: {
        create: {
          locale: defaultLocale,
          subject: input.subject,
          preheader: null,
          mode: input.mode,
          bodyHtml,
        },
      },
      recipients: {
        create: {
          email: normaliseEmail(person.email),
          userId: person.kind === "user" ? person.id : null,
          subscriberId: person.kind === "subscriber" ? person.id : null,
          name: person.name ? person.name.slice(0, 255) : null,
          locale: person.locale.slice(0, 10),
        },
      },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.id,
    action: "announcements.direct.send",
    entityType: "announcement",
    entityId: campaign.id,
    // The recipient's id, never the address or the words.
    changes: {
      after: {
        recipientKind: person.kind,
        recipientId: person.id,
        replyToSelf: input.replyToSelf,
        suppressed: person.suppressed,
      },
    },
  });
  return { campaignId: campaign.id };
}

// ─── A person's email history (the user record's Emails tab) ─

export interface SentEmailRow {
  campaignId: string;
  kind: "COURSE" | "CUSTOM" | "DIRECT";
  name: string;
  status: string;
  sentAt: Date | null;
  lastError: string | null;
}

/**
 * Every campaign that reached — or tried to reach — this account, newest
 * first, for as long as the recipient rows exist (90 days, ADR-171). It lists
 * addresses' outcomes, so it needs the delivery log's own key.
 */
export async function listEmailsSentToUser(
  actor: Subject,
  userId: string,
): Promise<SentEmailRow[]> {
  requireKey(actor, "users.view");
  requireKey(actor, "email.log.view");
  const rows = await db.emailCampaignRecipient.findMany({
    where: { userId },
    select: {
      campaignId: true,
      status: true,
      sentAt: true,
      lastError: true,
      campaign: { select: { kind: true, name: true, startedAt: true } },
    },
    orderBy: { id: "desc" },
    take: 100,
  });
  return rows
    .map((row) => ({
      campaignId: row.campaignId,
      kind: row.campaign.kind,
      name: row.campaign.name,
      status: row.status,
      sentAt: row.sentAt ?? row.campaign.startedAt,
      lastError: row.lastError,
    }))
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
}
