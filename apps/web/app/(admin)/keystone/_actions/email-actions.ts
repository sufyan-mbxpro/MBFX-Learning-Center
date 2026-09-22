"use server";

// Email admin actions (Module 17, ADR-078 / changes-21 F5).
//
// Gate order per security.md #1: `requirePermission()` first, then the
// `@repo/contracts` parse, then the `@repo/core` service. Nothing here touches
// Prisma (architecture.md #2).
//
// **Two permission levels, not one.** The transport actions need
// `email.settings.manage`, which only `super_admin` holds (ADR-078 #4 — an
// editable SMTP host captures the next password-reset link, which is the
// escalation `canAssignRole`'s strict `<` cannot see). Everything else —
// editing a template, switching one off, sending a test, reading the log —
// stays with `admin`. The screen hides what it cannot do, and these checks are
// what make that true rather than decorative.
import { rateLimit } from "@repo/auth";
import {
  emailTemplateActiveSchema,
  emailTemplateResetSchema,
  emailTemplateSaveSchema,
  emailTestSendSchema,
  emailTransportSaveSchema,
} from "@repo/contracts";
import {
  resetEmailTemplate,
  saveEmailTemplate,
  saveEmailTransport,
  sendTestEmail,
  setEmailTemplateActive,
  testEmailTransport,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { z } from "zod";

/**
 * The transport form submits an empty password on every save, because the field
 * is write-only. `clearPassword` is therefore a separate INTENT — without it,
 * "blank" would be indistinguishable from "leave it alone" and an admin could
 * never remove a stored credential.
 */
const transportActionSchema = emailTransportSaveSchema.and(
  z.object({ clearPassword: z.boolean().optional() }),
);

export async function saveEmailTransportAction(input: unknown): Promise<void> {
  const subject = await requirePermission("email.settings.manage");
  const parsed = transportActionSchema.parse(input);
  await saveEmailTransport(subject, parsed);
}

export async function testEmailConnectionAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const subject = await requirePermission("email.settings.manage");
  return testEmailTransport(subject);
}

export async function saveEmailTemplateAction(input: unknown): Promise<void> {
  const subject = await requirePermission("email.templates.update");
  await saveEmailTemplate(subject, emailTemplateSaveSchema.parse(input));
}

export async function setEmailTemplateActiveAction(input: unknown): Promise<void> {
  const subject = await requirePermission("email.templates.update");
  const parsed = emailTemplateActiveSchema.parse(input);
  await setEmailTemplateActive(subject, parsed.key, parsed.isActive);
}

export async function resetEmailTemplateAction(input: unknown): Promise<void> {
  const subject = await requirePermission("email.templates.update");
  const parsed = emailTemplateResetSchema.parse(input);
  await resetEmailTemplate(subject, parsed.key, parsed.locale);
}

/**
 * A test send, limited to 10 per hour per actor.
 *
 * The limit is per ACTOR rather than per IP: this endpoint needs a staff
 * session to reach at all, so the account is the identity that matters, and an
 * unlimited "send this template to any address" button is an open relay with a
 * permission check in front of it.
 */
export async function sendTestEmailAction(
  input: unknown,
): Promise<{ status: string; reason?: string }> {
  const subject = await requirePermission("email.templates.test");
  const parsed = emailTestSendSchema.parse(input);

  const limit = await rateLimit(`email:test:${subject.id}`, 10, 60 * 60);
  if (!limit.ok) throw new Error(`Too many test sends. Try again in ${limit.retryAfterSeconds}s.`);

  return sendTestEmail(subject, { key: parsed.key, locale: parsed.locale, to: parsed.to });
}
