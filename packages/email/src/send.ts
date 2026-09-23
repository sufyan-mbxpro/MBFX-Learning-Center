// One message, end to end (ADR-078 #9, #10, #11).
//
// The order of the checks is the contract: global switch, then the template's
// own, then render, then transport — and EVERY outcome writes a delivery row,
// because "nothing arrived" is a question someone will ask later and the log
// is the only place that answers it.
//
// A delivery failure is RETURNED, never thrown. Sign-up must not fail because
// a mail server did.
import { EMAIL_TEMPLATES, type EmailBodyMode, type EmailTemplateKey } from "@repo/contracts";
import { db, emailTemplateDefault } from "@repo/db";
import { loadSetting } from "@repo/settings";
import { CURATED_FONTS, loadActiveThemeTokens } from "@repo/theme";
import { siteOrigin } from "@repo/utils";
import { absoluteUrl, type EmailPalette } from "./layout.ts";
import { renderEmail } from "./render.ts";
import { TRANSPORT_ID, loadTransportDriver } from "./transport.ts";

/** The locale every template is guaranteed to have (ADR-043 #3). */
export const DEFAULT_EMAIL_LOCALE = "en";

/** The delivery-log reason on a send SendGrid accepted in sandbox mode (ADR-152). */
export const SANDBOX_REASON = "SendGrid sandbox mode — validated, not delivered";

export type DeliveryStatus = "SENT" | "FAILED" | "SUPPRESSED";

export interface SendTemplatedEmailInput {
  key: EmailTemplateKey;
  to: string;
  locale?: string | undefined;
  /** Used for {{recipient.name}}; the address is filled in automatically. */
  recipientName?: string | undefined;
  variables?: Readonly<Record<string, string>> | undefined;
  /** The staff member who pressed the button, for the log. */
  triggeredById?: string | undefined;
  /** A test send ignores `isActive` — never the global switch. */
  isTest?: boolean | undefined;
  /** Both halves, because a package may not invent the word (code-style #2). */
  unsubscribe?: { url: string; label: string } | undefined;
}

export interface DeliveryResult {
  status: DeliveryStatus;
  reason?: string;
  deliveryId: string;
}

const SYSTEM_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

/** An email client cannot fetch a web font, so the brand face is a hint. */
function fontFamilyFor(fontSansKey: string): string {
  const label = CURATED_FONTS.find((font) => font.key === fontSansKey)?.label;
  return label && fontSansKey !== "system" ? `'${label}', ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function record(input: {
  key: string;
  to: string;
  locale: string;
  subject: string;
  status: DeliveryStatus;
  reason?: string | undefined;
  providerMessageId?: string | undefined;
  isTest: boolean;
  triggeredById?: string | undefined;
}): Promise<DeliveryResult> {
  const row = await db.emailDelivery.create({
    data: {
      templateKey: input.key,
      to: input.to,
      locale: input.locale,
      // Never the body, never the variables (ADR-078 #10).
      subject: input.subject.slice(0, 200),
      status: input.status,
      reason: input.reason?.slice(0, 500) ?? null,
      providerMessageId: input.providerMessageId ?? null,
      isTest: input.isTest,
      triggeredBy: input.triggeredById ?? null,
    },
    select: { id: true },
  });
  return {
    status: input.status,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    deliveryId: row.id,
  };
}

/**
 * Everything a render needs that is not the template row: the palette, the
 * shell's surrounding copy, and the global variables.
 *
 * Extracted so the admin's PREVIEW renders through the same code a real send
 * does (F5). A preview built from its own palette and its own globals is a
 * preview of something else — and the one thing an admin uses it to check is
 * what will actually arrive.
 */
export interface EmailRenderContext {
  palette: EmailPalette;
  shell: { siteName: string; logoUrl?: string; footerText?: string; postalAddress?: string };
  /** The globals, minus `recipient.*`, which only a send knows. */
  globals: Record<string, string>;
}

export async function loadEmailRenderContext(): Promise<EmailRenderContext> {
  // `siteOrigin()` is the one owner of this precedence (code-style.md #27).
  // A fourth copy of it lived here, with an EMPTY fallback — and an empty
  // origin is what `absoluteUrl()` refuses, so a deploy that had set neither
  // variable sent every message with no logo at all and `{{site.url}}` blank.
  const origin = siteOrigin();
  const [tokens, siteName, emailLogo, brandLogo, footerText, postalAddress] = await Promise.all([
    loadActiveThemeTokens("web"),
    loadSetting("site.name"),
    loadSetting("email.logo"),
    // The site's own light-ground logo, when no email-specific one is set:
    // an email is always read on a light ground (the palette below), and the
    // brand an admin uploaded in the theme editor should not need uploading
    // twice to appear in a message (changes-46 #4).
    db.brandAsset.findUnique({ where: { key: "logo_light" }, select: { url: true } }),
    loadSetting("email.footerText"),
    loadSetting("email.postalAddress"),
  ]);
  const fromless = origin;
  // ABSOLUTE, because a message has no page for a relative path to resolve
  // against — the stored value is the upload path (`/uploads/…`).
  const logo = absoluteUrl(emailLogo || brandLogo?.url || "", origin) ?? "";
  const resolvedSiteName = siteName ?? "";
  return {
    palette: {
      brand: tokens.brand,
      // Light surfaces always: an email is read on the client's ground, and
      // a dark-mode email is a different design problem.
      surface: tokens.light,
      fontFamily: fontFamilyFor(tokens.layout.fontSans),
    },
    shell: {
      siteName: resolvedSiteName,
      ...(logo ? { logoUrl: logo } : {}),
      ...(footerText ? { footerText } : {}),
      ...(postalAddress ? { postalAddress } : {}),
    },
    globals: {
      "site.name": resolvedSiteName,
      "site.url": fromless,
      "logo.url": logo || fromless,
      year: String(new Date().getFullYear()),
    },
  };
}

function findTemplate(key: string) {
  return db.emailTemplate.findUnique({ where: { key }, include: { translations: true } });
}

/**
 * The template row, restored from its code default when the row or its `en`
 * content is missing (ADR-131).
 *
 * A template key is CODE (ADR-078 #5), so the registry can add one — as
 * ADR-113 added `support.request` — on a database that was seeded before it
 * existed. Without this, that send was a FAILED row saying "run the seed", and
 * a visitor was told their message went. Restoring is create-only, exactly like
 * the seed: an admin's edited content is never touched, and a template an admin
 * switched OFF still exists and stays off.
 */
async function loadTemplate(key: EmailTemplateKey) {
  const template = await findTemplate(key);
  if (template?.translations.some((row) => row.locale === DEFAULT_EMAIL_LOCALE)) return template;

  const fallback = emailTemplateDefault(key);
  if (!fallback) return template;

  await db.emailTemplate.upsert({ where: { key }, update: {}, create: { key } });
  await db.emailTemplateTranslation.upsert({
    where: { templateKey_locale: { templateKey: key, locale: DEFAULT_EMAIL_LOCALE } },
    update: {},
    create: {
      templateKey: key,
      locale: DEFAULT_EMAIL_LOCALE,
      subject: fallback.subject,
      preheader: fallback.preheader,
      mode: "RICH",
      bodyHtml: fallback.bodyHtml,
      translationStatus: "TRANSLATED",
    },
  });
  return findTemplate(key);
}

export async function sendTemplatedEmail(input: SendTemplatedEmailInput): Promise<DeliveryResult> {
  const locale = input.locale ?? DEFAULT_EMAIL_LOCALE;
  const isTest = input.isTest ?? false;
  const base = { key: input.key, to: input.to, locale, isTest, triggeredById: input.triggeredById };

  // 1. The global switch. A test send does not get past this one either.
  if ((await loadSetting("email.enabled")) === false) {
    return record({ ...base, subject: "", status: "SUPPRESSED", reason: "email.enabled is off" });
  }

  const template = await loadTemplate(input.key);
  if (!template) {
    return record({
      ...base,
      subject: "",
      status: "FAILED",
      reason: `No template row for ${input.key} — run the seed.`,
    });
  }

  // 2. The template's own switch. A test IS allowed past this one: you have
  //    to be able to check a template before turning it on.
  if (!template.isActive && !isTest) {
    return record({ ...base, subject: "", status: "SUPPRESSED", reason: "template is inactive" });
  }

  // 3. Locale, then the default locale (ADR-078 #12).
  const content =
    template.translations.find((row) => row.locale === locale) ??
    template.translations.find((row) => row.locale === DEFAULT_EMAIL_LOCALE);
  if (!content) {
    return record({
      ...base,
      subject: "",
      status: "FAILED",
      reason: `Template ${input.key} has no ${DEFAULT_EMAIL_LOCALE} content.`,
    });
  }

  const [context, fromName, fromEmail, replyTo] = await Promise.all([
    loadEmailRenderContext(),
    loadSetting("email.fromName"),
    loadSetting("email.fromEmail"),
    loadSetting("email.replyTo"),
  ]);

  const resolvedSiteName = context.shell.siteName;
  const variables: Record<string, string> = {
    ...context.globals,
    "recipient.email": input.to,
    "recipient.name": input.recipientName ?? "",
    ...input.variables,
  };

  let rendered;
  try {
    rendered = renderEmail({
      key: input.key,
      mode: content.mode as EmailBodyMode,
      subject: content.subject,
      preheader: content.preheader ?? undefined,
      bodyHtml: content.bodyHtml,
      variables,
      palette: context.palette,
      shell: { ...context.shell, unsubscribe: input.unsubscribe },
    });
  } catch (error) {
    return record({
      ...base,
      subject: content.subject,
      status: "FAILED",
      reason: errorMessage(error),
    });
  }

  // 4. Send. The sender identity is the template's override, then the
  //    site-wide setting.
  try {
    const driver = await loadTransportDriver();
    const { messageId, sandbox } = await driver.send({
      to: input.to,
      from: {
        name: template.fromName ?? fromName ?? resolvedSiteName,
        address: template.fromEmail ?? fromEmail ?? "",
      },
      replyTo: template.replyTo ?? replyTo ?? undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: input.unsubscribe
        ? {
            // RFC 8058: a mail client's own one-click button (ADR-080 #4).
            "List-Unsubscribe": `<${input.unsubscribe.url}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });
    return record({
      ...base,
      subject: rendered.subject,
      status: "SENT",
      providerMessageId: messageId,
      // ADR-152: accepted and validated, delivered to nobody. Said on the row,
      // or the log would claim an inbox received it.
      ...(sandbox ? { reason: SANDBOX_REASON } : {}),
    });
  } catch (error) {
    // Not rethrown: a mail server being down must not fail the sign-up,
    // reset or subscription that triggered this.
    return record({
      ...base,
      subject: rendered.subject,
      status: "FAILED",
      reason: errorMessage(error),
    });
  }
}

/** For the admin's "Test connection" button. Records what it learned. */
export async function verifyTransport(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const driver = await loadTransportDriver();
    await driver.verify();
    await db.emailTransport.updateMany({
      where: { id: TRANSPORT_ID },
      data: { lastVerifiedAt: new Date(), lastError: null },
    });
    return { ok: true };
  } catch (error) {
    const message = errorMessage(error);
    await db.emailTransport.updateMany({
      where: { id: TRANSPORT_ID },
      data: { lastError: message.slice(0, 500) },
    });
    return { ok: false, error: message };
  }
}

/** Which templates exist, for a caller that wants to check before sending. */
export function emailTemplateKeys(): EmailTemplateKey[] {
  return Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];
}
