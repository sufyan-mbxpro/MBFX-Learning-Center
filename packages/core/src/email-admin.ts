// The admin's door to the email tables (Module 17, ADR-078 / changes-21 F5).
//
// Server actions never touch Prisma (architecture.md #2), so everything the
// four email screens need is here. Three properties this file is responsible
// for, none of which a screen can be trusted to remember:
//
//   1. **The password leaves by no route.** `EmailTransportView` has no
//      password property at all, so a leak has to get past the TYPE, not just
//      past a reviewer (ADR-078 #3). `loadTransportDriver()` in @repo/email
//      stays the one reader of `passwordCipher`; nothing here selects it,
//      `saveEmailTransport` only ever writes it.
//   2. **A body is sanitised on save** (security.md #8), not only on render —
//      and with the SAME allowlist the renderer uses, so what an admin sees in
//      the preview is what a recipient can receive.
//   3. **A source edit flips its siblings OUTDATED**, the rule ADR-069 gave the
//      glossary, applied to the one other translated entity that has a
//      `sourceHash` column.
import { createHash, randomUUID } from "node:crypto";
import {
  EMAIL_TEMPLATES,
  isEmailTemplateKey,
  type EmailAudience,
  type EmailBodyMode,
  type EmailDeliveryFilter,
  type EmailPreviewInput,
  type EmailTemplateKey,
  type EmailTemplateSaveInput,
  type EmailTransportSaveInput,
} from "@repo/contracts";
import { db, emailTemplateDefault, TranslationStatus, type Prisma } from "@repo/db";
import {
  DEFAULT_EMAIL_LOCALE,
  hasEmailSecretKey,
  loadEmailRenderContext,
  renderEmail,
  sanitizeEmailHtml,
  sealSecret,
  sendTemplatedEmail,
  TRANSPORT_ID,
  verifyTransport,
  type RenderedEmail,
} from "@repo/email";
import { isTranslationOutdated } from "@repo/i18n";
import type { Subject } from "@repo/rbac";
import { recordAudit } from "./index.ts";

// ─── The transport ───────────────────────────────────────────

export type EmailDriver = "SMTP" | "LOG";
export type SmtpSecurityValue = "NONE" | "STARTTLS" | "TLS";

/**
 * What the Delivery section renders. Note what is NOT here: there is no
 * `password`, and no `passwordCipher`. `hasPassword` is the only thing the
 * screen is told, which is enough to say "saved — replace" and nothing more.
 */
export interface EmailTransportView {
  driver: EmailDriver;
  host: string | null;
  port: number | null;
  security: SmtpSecurityValue;
  username: string | null;
  hasPassword: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  /** False means a saved password cannot be opened — the seal's key is absent. */
  secretKeyPresent: boolean;
}

export async function loadEmailTransportView(): Promise<EmailTransportView> {
  const row = await db.emailTransport.findUnique({
    where: { id: TRANSPORT_ID },
    // `passwordCipher` is selected as a BOOLEAN and never as a value: the
    // cipher text is not secret in itself, but a reader that hands it to a
    // screen is the second reader ADR-078 #3 forbids, and the honest way to
    // make that impossible is to never put it in a variable.
    select: {
      driver: true,
      host: true,
      port: true,
      security: true,
      username: true,
      lastVerifiedAt: true,
      lastError: true,
      passwordCipher: true,
    },
  });

  return {
    driver: row?.driver ?? "LOG",
    host: row?.host ?? null,
    port: row?.port ?? null,
    security: row?.security ?? "STARTTLS",
    username: row?.username ?? null,
    hasPassword: Boolean(row?.passwordCipher),
    lastVerifiedAt: row?.lastVerifiedAt ?? null,
    lastError: row?.lastError ?? null,
    secretKeyPresent: hasEmailSecretKey(),
  };
}

/**
 * Write the singleton transport row.
 *
 * An EMPTY password keeps the stored one (the field is write-only, so the form
 * cannot round-trip the current value back to us). That is also why clearing a
 * password is a separate intent rather than "submit the form blank" — blank is
 * what every save sends.
 *
 * The audit row records the host and driver and never the password, not even
 * as a length: security.md #5 wants the change recorded, not reproducible.
 */
export async function saveEmailTransport(
  actor: Subject,
  input: EmailTransportSaveInput & { clearPassword?: boolean },
): Promise<void> {
  const before = await db.emailTransport.findUnique({
    where: { id: TRANSPORT_ID },
    select: { driver: true, host: true, port: true, security: true, username: true },
  });

  const password = input.password?.trim() ?? "";
  const cipher: Prisma.EmailTransportUpdateInput["passwordCipher"] = input.clearPassword
    ? null
    : password
      ? sealSecret(password)
      : undefined;

  const data = {
    driver: input.driver,
    host: input.host || null,
    port: input.port ?? null,
    security: input.security,
    username: input.username || null,
    updatedBy: actor.id,
    // A new host or username invalidates what the last verify proved.
    ...(before &&
    before.host === (input.host || null) &&
    before.username === (input.username || null)
      ? {}
      : { lastVerifiedAt: null, lastError: null }),
    ...(cipher === undefined ? {} : { passwordCipher: cipher }),
  };

  await db.emailTransport.upsert({
    where: { id: TRANSPORT_ID },
    update: data,
    create: { id: TRANSPORT_ID, ...data },
  });

  await recordAudit({
    userId: actor.id,
    action: "email.transport.update",
    entityType: "EmailTransport",
    entityId: TRANSPORT_ID,
    changes: {
      before,
      after: {
        driver: input.driver,
        host: input.host || null,
        port: input.port ?? null,
        security: input.security,
        username: input.username || null,
        // The intent, never the value.
        passwordChanged: cipher !== undefined,
      },
    },
  });
}

/** "Test connection". Records what it learned on the row, for the screen. */
export async function testEmailTransport(
  actor: Subject,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await verifyTransport();
  await recordAudit({
    userId: actor.id,
    action: "email.transport.verify",
    entityType: "EmailTransport",
    entityId: TRANSPORT_ID,
    changes: { after: { ok: result.ok } },
  });
  return result;
}

// ─── Templates ───────────────────────────────────────────────

export type EmailTranslationState = "current" | "outdated" | "missing" | "draft";

export interface EmailTemplateLocaleState {
  locale: string;
  state: EmailTranslationState;
}

export interface EmailTemplateRow {
  key: EmailTemplateKey;
  audience: EmailAudience;
  critical: boolean;
  isActive: boolean;
  /** The default locale's subject — what the list shows as the template's name. */
  subject: string;
  fromEmail: string | null;
  updatedAt: Date | null;
  locales: EmailTemplateLocaleState[];
}

export interface EmailTemplateTranslationDetail {
  locale: string;
  subject: string;
  preheader: string | null;
  mode: EmailBodyMode;
  bodyHtml: string;
  state: EmailTranslationState;
  updatedAt: Date | null;
}

export interface EmailTemplateDetail {
  key: EmailTemplateKey;
  audience: EmailAudience;
  critical: boolean;
  isActive: boolean;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  updatedAt: Date | null;
  variables: string[];
  required: string[];
  translations: EmailTemplateTranslationDetail[];
}

/** The material a translator works from — all of it, so any edit is visible. */
function templateSourceMaterial(row: {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
}): string {
  // JSON rather than a join on some separator: a template body can contain
  // any character, so any separator could be forged, and two different field
  // splits would hash identically. The array form cannot collide.
  return JSON.stringify([row.subject, row.preheader ?? "", row.bodyHtml]);
}

function computeTemplateHash(row: {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
}): string {
  return createHash("sha256").update(templateSourceMaterial(row), "utf8").digest("hex");
}

function translationState(
  row: { translationStatus: TranslationStatus; sourceHash: string | null; locale: string },
  sourceHash: string | null,
  defaultLocale: string,
): EmailTranslationState {
  if (row.locale === defaultLocale) return "current";
  if (row.translationStatus === TranslationStatus.OUTDATED) return "outdated";
  if (row.translationStatus === TranslationStatus.DRAFT) return "draft";
  if (sourceHash && isTranslationOutdated(sourceHash, row.sourceHash)) return "outdated";
  return "current";
}

/**
 * ADR-043 #2, for email: a STAFF-audience template is English only; anything a
 * member of the public can receive is translated.
 *
 * `any` counts as translated, and that is the case worth naming —
 * `auth.password_reset` reaches learners and staff through the same template,
 * so a learner must get it in their own language even though an admin may get
 * the same mail. No template is `staff` today, which is why this is a function
 * rather than an inline comparison: the registry's literal types would narrow
 * the comparison away and the rule would silently stop being expressed.
 */
export function isTranslatedAudience(audience: EmailAudience): boolean {
  return audience !== "staff";
}

async function defaultLocaleCode(): Promise<string> {
  const row = await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } });
  return row?.code ?? DEFAULT_EMAIL_LOCALE;
}

/**
 * Every template the registry declares, whether or not it has a row.
 *
 * Registry-driven rather than table-driven on purpose: a key with no row is
 * the interesting case (someone has not run the seed), and a table-driven list
 * would hide it by showing four templates where there are five.
 */
export async function listEmailTemplates(locales?: string[]): Promise<EmailTemplateRow[]> {
  const [rows, defaultLocale] = await Promise.all([
    db.emailTemplate.findMany({
      include: {
        translations: {
          select: {
            locale: true,
            subject: true,
            preheader: true,
            bodyHtml: true,
            translationStatus: true,
            sourceHash: true,
            updatedAt: true,
          },
        },
      },
    }),
    defaultLocaleCode(),
  ]);
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return Object.entries(EMAIL_TEMPLATES).map(([key, definition]) => {
    const row = byKey.get(key);
    const source = row?.translations.find((t) => t.locale === defaultLocale);
    const sourceHash = source ? computeTemplateHash(source) : null;
    const wanted = isTranslatedAudience(definition.audience)
      ? (locales ?? [defaultLocale])
      : [defaultLocale];

    return {
      key: key as EmailTemplateKey,
      audience: definition.audience,
      critical: definition.critical,
      isActive: row?.isActive ?? true,
      subject: source?.subject ?? "",
      fromEmail: row?.fromEmail ?? null,
      updatedAt: row?.updatedAt ?? null,
      locales: wanted.map((locale) => {
        const translation = row?.translations.find((t) => t.locale === locale);
        return {
          locale,
          state: translation
            ? translationState(translation, sourceHash, defaultLocale)
            : ("missing" as const),
        };
      }),
    };
  });
}

export async function loadEmailTemplate(key: string): Promise<EmailTemplateDetail | null> {
  if (!isEmailTemplateKey(key)) return null;
  const [row, defaultLocale] = await Promise.all([
    db.emailTemplate.findUnique({
      where: { key },
      include: { translations: { orderBy: { locale: "asc" } } },
    }),
    defaultLocaleCode(),
  ]);
  if (!row) return null;

  const definition = EMAIL_TEMPLATES[key];
  const source = row.translations.find((t) => t.locale === defaultLocale);
  const sourceHash = source ? computeTemplateHash(source) : null;

  return {
    key,
    audience: definition.audience,
    critical: definition.critical,
    isActive: row.isActive,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
    updatedAt: row.updatedAt,
    variables: [...definition.variables],
    required: [...definition.required],
    translations: row.translations.map((t) => ({
      locale: t.locale,
      subject: t.subject,
      preheader: t.preheader,
      mode: t.mode as EmailBodyMode,
      bodyHtml: t.bodyHtml,
      state: translationState(t, sourceHash, defaultLocale),
      updatedAt: t.updatedAt,
    })),
  };
}

/**
 * One locale's content plus the template's sender overrides, in ONE
 * transaction — the ADR-069 shape. Saving the default locale re-hashes it and
 * flips the siblings OUTDATED, so an example-only edit still marks the
 * translations stale.
 */
export async function saveEmailTemplate(
  actor: Subject,
  input: EmailTemplateSaveInput,
): Promise<void> {
  const key = input.key as EmailTemplateKey;
  const defaultLocale = await defaultLocaleCode();
  const isSource = input.locale === defaultLocale;

  // Sanitise BEFORE the hash, so the hash describes what is stored rather than
  // what was submitted — otherwise a save that the sanitiser changed would
  // report its siblings stale against markup no row ever held.
  const bodyHtml = sanitizeEmailHtml(input.bodyHtml, input.mode);
  const preheader = input.preheader?.trim() || null;
  const content = { subject: input.subject, preheader, bodyHtml };

  const sourceHash = isSource
    ? computeTemplateHash(content)
    : await (async () => {
        const source = await db.emailTemplateTranslation.findUnique({
          where: { templateKey_locale: { templateKey: key, locale: defaultLocale } },
          select: { subject: true, preheader: true, bodyHtml: true },
        });
        return source ? computeTemplateHash(source) : null;
      })();

  const before = await db.emailTemplateTranslation.findUnique({
    where: { templateKey_locale: { templateKey: key, locale: input.locale } },
    select: { subject: true, mode: true },
  });

  await db.$transaction(async (tx) => {
    await tx.emailTemplate.update({
      where: { key },
      data: {
        fromName: input.fromName?.trim() || null,
        fromEmail: input.fromEmail?.trim() || null,
        replyTo: input.replyTo?.trim() || null,
        updatedBy: actor.id,
      },
    });

    const translationData = {
      ...content,
      mode: input.mode,
      sourceHash,
      translationStatus: TranslationStatus.TRANSLATED,
    };
    await tx.emailTemplateTranslation.upsert({
      where: { templateKey_locale: { templateKey: key, locale: input.locale } },
      update: translationData,
      create: { templateKey: key, locale: input.locale, ...translationData },
    });

    if (isSource && sourceHash) {
      const siblings = await tx.emailTemplateTranslation.findMany({
        where: { templateKey: key, locale: { not: defaultLocale } },
        select: { id: true, sourceHash: true },
      });
      const stale = siblings.filter((s) => isTranslationOutdated(sourceHash, s.sourceHash));
      if (stale.length > 0) {
        await tx.emailTemplateTranslation.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: { translationStatus: TranslationStatus.OUTDATED },
        });
      }
    }
  });

  await recordAudit({
    userId: actor.id,
    action: "email.template.update",
    entityType: "EmailTemplate",
    entityId: `${key}:${input.locale}`,
    // Subjects and modes, never bodies: the log is for "who changed this", and
    // a template body is retrievable from the template.
    changes: { before, after: { subject: input.subject, mode: input.mode } },
  });
}

export async function setEmailTemplateActive(
  actor: Subject,
  key: string,
  isActive: boolean,
): Promise<void> {
  if (!isEmailTemplateKey(key)) throw new UnknownEmailTemplateError(key);
  await db.emailTemplate.update({ where: { key }, data: { isActive, updatedBy: actor.id } });
  await recordAudit({
    userId: actor.id,
    action: isActive ? "email.template.activate" : "email.template.deactivate",
    entityType: "EmailTemplate",
    entityId: key,
    changes: { after: { isActive, critical: EMAIL_TEMPLATES[key].critical } },
  });
}

export class UnknownEmailTemplateError extends Error {
  constructor(key: string) {
    super(`${key} is not a template this product sends.`);
    this.name = "UnknownEmailTemplateError";
  }
}

export class NoEmailTemplateDefaultError extends Error {
  constructor(key: string) {
    super(`${key} has no seeded default content.`);
    this.name = "NoEmailTemplateDefaultError";
  }
}

/**
 * Back to the words the seed writes (`@repo/db`'s `EMAIL_TEMPLATE_DEFAULTS`).
 *
 * Only the default locale has defaults — a translation's default IS the
 * English source, so resetting a non-default locale deletes the row and leaves
 * the template falling back, which is the honest state for "never translated"
 * rather than an English body filed under `es`.
 */
export async function resetEmailTemplate(
  actor: Subject,
  key: string,
  locale: string,
): Promise<void> {
  if (!isEmailTemplateKey(key)) throw new UnknownEmailTemplateError(key);
  const defaultLocale = await defaultLocaleCode();

  if (locale !== defaultLocale) {
    await db.emailTemplateTranslation.deleteMany({ where: { templateKey: key, locale } });
  } else {
    const fallback = emailTemplateDefault(key);
    if (!fallback) throw new NoEmailTemplateDefaultError(key);
    const content = {
      subject: fallback.subject,
      preheader: fallback.preheader,
      bodyHtml: fallback.bodyHtml,
    };
    const data = {
      ...content,
      mode: "RICH" as const,
      sourceHash: computeTemplateHash({ ...content, preheader: fallback.preheader }),
      translationStatus: TranslationStatus.TRANSLATED,
    };
    await db.emailTemplateTranslation.upsert({
      where: { templateKey_locale: { templateKey: key, locale } },
      update: data,
      create: { templateKey: key, locale, ...data },
    });
  }

  await recordAudit({
    userId: actor.id,
    action: "email.template.reset",
    entityType: "EmailTemplate",
    entityId: `${key}:${locale}`,
  });
}

/**
 * The preview (ADR-078 #8), rendered through the same `renderEmail` a real send
 * uses, with the registry's sample values standing in for real ones.
 *
 * A DRAFT wins over the stored row so the editor shows what is on screen. It is
 * still sanitised here — the preview is served to a browser, and an unsanitised
 * preview is an XSS on the admin surface even inside a sandboxed frame.
 */
export async function renderEmailPreview(input: EmailPreviewInput): Promise<RenderedEmail | null> {
  const key = input.key as EmailTemplateKey;
  const detail = await loadEmailTemplate(key);
  if (!detail) return null;

  const defaultLocale = await defaultLocaleCode();
  const stored =
    detail.translations.find((t) => t.locale === input.locale) ??
    detail.translations.find((t) => t.locale === defaultLocale);

  const mode = input.mode ?? stored?.mode ?? "RICH";
  const bodyHtml = input.bodyHtml ?? stored?.bodyHtml;
  const subject = input.subject ?? stored?.subject;
  if (!bodyHtml || !subject) return null;

  const context = await loadEmailRenderContext();
  const definition = EMAIL_TEMPLATES[key];

  return renderEmail({
    key,
    mode,
    subject,
    preheader: input.preheader ?? stored?.preheader ?? undefined,
    bodyHtml: sanitizeEmailHtml(bodyHtml, mode),
    // The registry's samples UNDER the live globals: a preview should show the
    // real site name and logo, and invent only what a send would supply.
    variables: { ...definition.sample, ...context.globals },
    palette: context.palette,
    shell: context.shell,
  });
}

/**
 * Send one template to a chosen address, ignoring `isActive` but not
 * `email.enabled` (ADR-078 #9). Sample variables, so the test exercises the
 * real render rather than a body with holes in it.
 */
export async function sendTestEmail(
  actor: Subject,
  input: { key: string; locale: string; to: string },
): Promise<{ status: string; reason?: string }> {
  if (!isEmailTemplateKey(input.key)) throw new UnknownEmailTemplateError(input.key);
  const definition = EMAIL_TEMPLATES[input.key];

  // The template's OWN variables only — not the whole sample. The sample also
  // carries `recipient.email`, `site.name` and friends, and letting those
  // through would send a test to a real address that greets "alex@example.com"
  // from a site called "MBX Learning Center" whatever this install is named.
  // The globals come from the live settings; only what a send would supply is
  // invented.
  const sample: Readonly<Record<string, string>> = definition.sample;
  const variables: Record<string, string> = {};
  for (const name of definition.variables) {
    const value = sample[name];
    if (value !== undefined) variables[name] = value;
  }

  const result = await sendTemplatedEmail({
    key: input.key,
    to: input.to,
    locale: input.locale,
    variables,
    triggeredById: actor.id,
    isTest: true,
    // A newsletter template's shell renders an unsubscribe line, and a test
    // send that omits it would be a preview of a different email. The token is
    // nonsense on purpose: nothing should be unsubscribable by a test.
    ...(input.key.startsWith("newsletter.")
      ? {
          unsubscribe: {
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"}/newsletter/unsubscribe?token=test-${randomUUID()}`,
            label: "Unsubscribe",
          },
        }
      : {}),
  });

  await recordAudit({
    userId: actor.id,
    action: "email.template.test",
    entityType: "EmailTemplate",
    entityId: input.key,
    changes: { after: { to: input.to, locale: input.locale, status: result.status } },
  });

  return result.reason === undefined
    ? { status: result.status }
    : { status: result.status, reason: result.reason };
}

// ─── The delivery log ────────────────────────────────────────

export interface EmailDeliveryRow {
  id: string;
  templateKey: string;
  to: string;
  locale: string;
  subject: string;
  status: string;
  reason: string | null;
  isTest: boolean;
  createdAt: Date;
}

export interface EmailDeliveriesPage {
  items: EmailDeliveryRow[];
  /** Opaque; pass back as `cursor`. Null means this was the last page. */
  nextCursor: string | null;
}

/** `createdAt|id`, base64url — the ADR-067 cursor. A burst of sends shares a millisecond. */
export function encodeDeliveryCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

export function decodeDeliveryCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [timestamp, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!timestamp || !id) return null;
  const createdAt = new Date(timestamp);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

/**
 * One page of the log, newest first. Keyset, like the media library: the table
 * is append-only under the reader, and offset paging would repeat rows around
 * every send that lands while someone is scrolling.
 */
export async function listEmailDeliveries(
  filter: EmailDeliveryFilter,
): Promise<EmailDeliveriesPage> {
  const cursor = filter.cursor ? decodeDeliveryCursor(filter.cursor) : null;
  const conditions: Record<string, unknown>[] = [];
  if (filter.q) conditions.push({ to: { contains: filter.q } });
  if (cursor) {
    conditions.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  const rows = await db.emailDelivery.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.templateKey ? { templateKey: filter.templateKey } : {}),
      ...(filter.isTest === undefined ? {} : { isTest: filter.isTest }),
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.limit + 1, // the extra row answers "is there a next page" without a count
  });

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map((row) => ({
      id: row.id,
      templateKey: row.templateKey,
      to: row.to,
      locale: row.locale,
      subject: row.subject,
      status: row.status,
      reason: row.reason,
      isTest: row.isTest,
      createdAt: row.createdAt,
    })),
    nextCursor: hasMore && last ? encodeDeliveryCursor(last) : null,
  };
}

export interface EmailDeliveryCounts {
  sent: number;
  failed: number;
  suppressed: number;
}

export async function countEmailDeliveries(since?: Date): Promise<EmailDeliveryCounts> {
  const grouped = await db.emailDelivery.groupBy({
    by: ["status"],
    ...(since ? { where: { createdAt: { gte: since } } } : {}),
    _count: { _all: true },
  });
  const at = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  return { sent: at("SENT"), failed: at("FAILED"), suppressed: at("SUPPRESSED") };
}
