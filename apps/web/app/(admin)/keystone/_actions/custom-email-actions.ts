"use server";

// Custom and direct email actions (ADR-172, changes-55).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse
// through `@repo/contracts`, then the `@repo/core` service, which re-checks
// its own key (and the SECOND key some paths need: `users.view` to email an
// account, `employees.view` for the Staff card) and writes the audit row.
//
// Refusals come back as a RESULT, not a throw, for the reason the announcement
// actions give: a thrown message is replaced in production builds, and the
// screen has to say which check failed.
//
// **A direct email is not sent here either.** `sendDirectEmail` writes one
// campaign with one recipient, already SENDING; the runner sends it in
// `after()`, and the minute cron picks it up if that did not finish.
import { after } from "next/server";
import { z } from "zod";
import {
  AnnouncementNotFoundError,
  AnnouncementPermissionError,
  AnnouncementRefusedError,
  DirectEmailRefusedError,
  EmailBodyInvalidError,
  EmailDesignNotFoundError,
  directRecipient,
  drainAnnouncementQueue,
  duplicateEmailDesign,
  listEmailDesigns,
  saveCustomEmail,
  saveEmailDesign,
  sendCustomEmailTest,
  sendDirectEmail,
  setEmailDesignArchived,
  summariseAudience,
  type AudienceSummary,
  type DirectRecipientView,
} from "@repo/core";
import {
  announcementAudienceSchema,
  customEmailSaveSchema,
  directEmailSchema,
  directRecipientSchema,
  emailDesignIdSchema,
  emailDesignSaveSchema,
  type AnnouncementRefusal,
  type DirectEmailRefusal,
  type EmailBodyMode,
} from "@repo/contracts";
import { requireAnyPermission, requirePermission } from "@repo/rbac";

export type CustomEmailRefusal =
  | AnnouncementRefusal
  | DirectEmailRefusal
  | "forbidden"
  | "not_found"
  | "body_empty"
  | "body_too_large";

export type CustomEmailRefused = { ok: false; reason: CustomEmailRefusal };

async function refusals<T extends { ok: true }>(
  work: () => Promise<T>,
): Promise<T | CustomEmailRefused> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AnnouncementRefusedError) return { ok: false, reason: error.reason };
    if (error instanceof DirectEmailRefusedError) return { ok: false, reason: error.reason };
    if (error instanceof EmailBodyInvalidError) {
      return { ok: false, reason: error.reason === "empty" ? "body_empty" : "body_too_large" };
    }
    // The action's own gate passed, so this is a SECOND key the service needs.
    if (error instanceof AnnouncementPermissionError) return { ok: false, reason: "forbidden" };
    if (error instanceof AnnouncementNotFoundError || error instanceof EmailDesignNotFoundError) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

// ─── Designs ─────────────────────────────────────────────────

export async function saveEmailDesignAction(
  input: unknown,
): Promise<{ ok: true; id: string } | CustomEmailRefused> {
  const subject = await requirePermission("email.templates.update");
  const parsed = emailDesignSaveSchema.parse(input);
  return refusals(async () => ({ ok: true as const, id: await saveEmailDesign(subject, parsed) }));
}

export async function duplicateEmailDesignAction(
  id: unknown,
): Promise<{ ok: true; id: string } | CustomEmailRefused> {
  const subject = await requirePermission("email.templates.update");
  const parsed = emailDesignIdSchema.parse({ id });
  return refusals(async () => ({
    ok: true as const,
    id: await duplicateEmailDesign(subject, parsed.id),
  }));
}

export async function setEmailDesignArchivedAction(
  input: unknown,
): Promise<{ ok: true } | CustomEmailRefused> {
  const subject = await requirePermission("email.templates.update");
  const parsed = emailDesignIdSchema.extend({ archived: z.boolean() }).parse(input);
  return refusals(async () => {
    await setEmailDesignArchived(subject, parsed.id, parsed.archived);
    return { ok: true as const };
  });
}

/** A picker's options: the active designs, with the words a pick copies in. */
export interface DesignOption {
  id: string;
  name: string;
  description: string | null;
  mode: EmailBodyMode;
  subject: string | null;
  preheader: string | null;
  bodyHtml: string;
}

export async function listDesignOptionsAction(): Promise<DesignOption[]> {
  const subject = await requireAnyPermission([
    "email.templates.view",
    "announcements.create",
    "announcements.direct",
  ]);
  const rows = await listEmailDesigns(subject);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    mode: row.mode,
    subject: row.subject,
    preheader: row.preheader,
    bodyHtml: row.bodyHtml,
  }));
}

// ─── A custom email ──────────────────────────────────────────

/** Create (no id) or update a CUSTOM draft; returns the id for the editor's address. */
export async function saveCustomEmailAction(
  input: unknown,
): Promise<{ ok: true; id: string } | CustomEmailRefused> {
  const subject = await requirePermission("announcements.create");
  const parsed = customEmailSaveSchema.parse(input);
  return refusals(async () => ({ ok: true as const, id: await saveCustomEmail(subject, parsed) }));
}

/** The Audience step's live counts, for a custom email's cards. */
export async function summariseCustomAudienceAction(input: unknown): Promise<AudienceSummary> {
  const subject = await requirePermission("announcements.create");
  const parsed = z.object({ audience: announcementAudienceSchema.nullable() }).parse(input);
  return summariseAudience(subject, null, parsed.audience, new Date(), "CUSTOM");
}

/** "Send me a test" — the one gate a bulk custom email has to pass (owner, E5). */
export async function sendCustomEmailTestAction(
  input: unknown,
): Promise<{ ok: true; status: string } | CustomEmailRefused> {
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
    const result = await sendCustomEmailTest(subject, parsed.id, {
      locale: parsed.locale,
      to: parsed.to,
    });
    return { ok: true as const, status: result.status };
  });
}

// ─── A direct email ──────────────────────────────────────────

/** What the dialog shows before anything is written: who, and whether it may. */
export async function directRecipientAction(
  input: unknown,
): Promise<{ ok: true; recipient: DirectRecipientView } | CustomEmailRefused> {
  const subject = await requirePermission("announcements.direct");
  const parsed = directRecipientSchema.parse(input);
  return refusals(async () => ({
    ok: true as const,
    recipient: await directRecipient(subject, parsed),
  }));
}

/** Send one email to one person, then kick the runner after the response. */
export async function sendDirectEmailAction(
  input: unknown,
): Promise<{ ok: true } | CustomEmailRefused> {
  const subject = await requirePermission("announcements.direct");
  const parsed = directEmailSchema.parse(input);
  return refusals(async () => {
    const { campaignId } = await sendDirectEmail(subject, parsed);
    after(() => drainAnnouncementQueue({ campaignId, budgetMs: 30_000 }).then(() => undefined));
    return { ok: true as const };
  });
}
