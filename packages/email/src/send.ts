// One message, end to end (ADR-078 #9, #10, #11).
//
// The order of the checks is the contract: global switch, then the template's
// own, then render, then transport — and EVERY outcome writes a delivery row,
// because "nothing arrived" is a question someone will ask later and the log
// is the only place that answers it.
//
// A delivery failure is RETURNED, never thrown. Sign-up must not fail because
// a mail server did.
import {
  EMAIL_TEMPLATES,
  isCampaignEmailKey,
  type EmailBodyMode,
  type EmailTemplateKey,
} from "@repo/contracts";
import { db, emailTemplateDefault } from "@repo/db";
import { loadSetting } from "@repo/settings";
import { CURATED_FONTS, loadActiveThemeTokens } from "@repo/theme";
import { catalogMessage } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { siteOrigin } from "@repo/utils";
import { absoluteUrl, pickEmailLogo, type EmailPalette } from "./layout.ts";
import { renderEmail, type EmailShellOptions, type RenderableEmailKey } from "./render.ts";
import {
  TRANSPORT_ID,
  classifySendError,
  loadTransportDriver,
  type EmailTransportDriver,
} from "./transport.ts";
import { listUnsubscribeHeaders, type UnsubscribeLinks } from "./unsubscribe-headers.ts";

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
  /**
   * Both halves, because a package may not invent the word (code-style #2).
   * `oneClickUrl` is the RFC 8058 handler for the header; `url` is the page.
   */
  unsubscribe?: UnsubscribeLinks | undefined;
}

/**
 * Why a FAILED send failed, for a caller that decides whether to retry
 * (ADR-171): `transient` and `permanent` come from the transport
 * (`classifySendError`), `render` from the template and its variables, and
 * `config` from a missing template row or content.
 */
export type DeliveryFailure = "transient" | "permanent" | "render" | "config";

export interface DeliveryResult {
  status: DeliveryStatus;
  reason?: string;
  failure?: DeliveryFailure;
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
  campaignId?: string | undefined;
  failure?: DeliveryFailure | undefined;
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
      campaignId: input.campaignId ?? null,
    },
    select: { id: true },
  });
  return {
    status: input.status,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.failure === undefined ? {} : { failure: input.failure }),
    deliveryId: row.id,
  };
}

/** Which palette a render uses. A real send is always light (ADR-179 #5). */
export type EmailScheme = "light" | "dark";

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
  /** The language-free half of the shell; `localizeEmailShell` adds the words. */
  shell: EmailShellOptions;
  /** Where the footer's links and contact rows point (ADR-179 #2). */
  site: { origin: string; contactEmail?: string; privacyPath?: string };
  /** The globals, minus `recipient.*`, which only a send knows. */
  globals: Record<string, string>;
}

export async function loadEmailRenderContext(
  options: { scheme?: EmailScheme } = {},
): Promise<EmailRenderContext> {
  // `siteOrigin()` is the one owner of this precedence (code-style.md #27).
  // A fourth copy of it lived here, with an EMPTY fallback — and an empty
  // origin is what `absoluteUrl()` refuses, so a deploy that had set neither
  // variable sent every message with no logo at all and `{{site.url}}` blank.
  const origin = siteOrigin();
  const [
    tokens,
    siteName,
    brandLogos,
    footerText,
    postalAddress,
    tagline,
    contactEmail,
    privacyDocument,
  ] = await Promise.all([
    loadActiveThemeTokens("web"),
    loadSetting("site.name"),
    // The logos uploaded in Branding, and nothing else: the email carries the
    // same marks as the site. A separate `email.logo` upload drifted from them
    // and was retired (ADR-180).
    db.brandAsset.findMany({
      where: { key: { in: ["logo_dark", "logo_light"] } },
      select: { key: true, url: true },
    }),
    loadSetting("email.footerText"),
    loadSetting("email.postalAddress"),
    loadSetting("site.tagline"),
    loadSetting("site.contactEmail"),
    loadSetting("legal.privacyDocument"),
  ]);
  const palette: EmailPalette = {
    brand: tokens.brand,
    // Light surfaces for every send: an email is read on the client's
    // ground. Dark is a PREVIEW of a client's dark treatment (ADR-179 #5).
    surface: options.scheme === "dark" ? tokens.dark : tokens.light,
    // The bands are the brand's, not the client's: one set of inks in both
    // schemes, so a dark preview changes the card and nothing around it.
    band: tokens.light,
    fontFamily: fontFamilyFor(tokens.layout.fontSans),
  };
  const brandLogo = pickEmailLogo(palette, {
    light: brandLogos.find((row) => row.key === "logo_light")?.url,
    dark: brandLogos.find((row) => row.key === "logo_dark")?.url,
  });
  // ABSOLUTE, because a message has no page for a relative path to resolve
  // against — the stored value is the upload path (`/uploads/…`).
  const logo = absoluteUrl(brandLogo, origin) ?? "";
  const resolvedSiteName = siteName ?? "";
  return {
    palette,
    shell: {
      siteName: resolvedSiteName,
      ...(logo ? { logoUrl: logo } : {}),
      ...(tagline ? { tagline } : {}),
      ...(footerText ? { footerText } : {}),
      ...(postalAddress ? { postalAddress } : {}),
    },
    site: {
      origin,
      ...(contactEmail ? { contactEmail } : {}),
      // A link to a legal page with no file behind it is a link to a 404, so
      // the row is absent until a document is chosen (ADR-110).
      ...(privacyDocument ? { privacyPath: "/legal/privacy" } : {}),
    },
    globals: {
      "site.name": resolvedSiteName,
      "site.url": origin,
      "logo.url": logo || origin,
      year: String(new Date().getFullYear()),
    },
  };
}

/** The shell's words in one language (ADR-179 #4), from `emailShell.*`. */
export interface EmailShellWords {
  login: string;
  support: string;
  privacy: string;
  email: string;
  website: string;
  copyright: string;
  sentTo: string;
  unsubscribeLine: string;
}

const SHELL_WORD_KEYS: Record<keyof EmailShellWords, string> = {
  login: "emailShell.loginLink",
  support: "emailShell.supportLink",
  privacy: "emailShell.privacyLink",
  email: "emailShell.emailLabel",
  website: "emailShell.websiteLabel",
  copyright: "emailShell.copyright",
  sentTo: "emailShell.sentTo",
  unsubscribeLine: "emailShell.unsubscribeLine",
};

/**
 * Reads the words, falling back to English inside `catalogMessage`. A catalog
 * that cannot be read leaves every word empty, and an empty word removes its
 * line: a message must still go out when its footer cannot be translated.
 */
export async function loadEmailShellWords(locale: string): Promise<EmailShellWords> {
  const entries = await Promise.all(
    (Object.entries(SHELL_WORD_KEYS) as [keyof EmailShellWords, string][]).map(
      async ([name, key]) => {
        try {
          return [name, (await catalogMessage(locale, key)) ?? ""] as const;
        } catch {
          return [name, ""] as const;
        }
      },
    ),
  );
  return Object.fromEntries(entries) as unknown as EmailShellWords;
}

/** `{name}` arguments only — the catalog's ICU here is plain substitution. */
function fillArguments(message: string, values: Readonly<Record<string, string>>): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/** A site path in the reader's language: `as-needed` prefixes all but the default. */
function localizedUrl(origin: string, locale: string, path: string): string {
  const base = origin.replace(/\/+$/, "");
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${base}${prefix}${path}`;
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/**
 * The full shell for one message: the context's data, the reader's words, and
 * the recipient's address. Pure, so the preview and the send compose it the
 * same way.
 */
export function localizeEmailShell(
  context: Pick<EmailRenderContext, "shell" | "site" | "globals">,
  words: EmailShellWords,
  locale: string,
  recipientEmail?: string,
): EmailShellOptions {
  const { origin, contactEmail, privacyPath } = context.site;
  const links = origin
    ? [
        words.login ? { url: localizedUrl(origin, locale, "/sign-in"), label: words.login } : null,
        words.support
          ? { url: localizedUrl(origin, locale, "/support"), label: words.support }
          : null,
        words.privacy && privacyPath
          ? { url: localizedUrl(origin, locale, privacyPath), label: words.privacy }
          : null,
      ].filter((link): link is { url: string; label: string } => link !== null)
    : [];
  const contacts = [
    words.email && contactEmail
      ? { label: words.email, value: contactEmail, url: `mailto:${contactEmail}` }
      : null,
    words.website && origin ? { label: words.website, value: hostOf(origin), url: origin } : null,
  ].filter((row): row is { label: string; value: string; url: string } => row !== null);
  const values = {
    year: context.globals.year ?? String(new Date().getFullYear()),
    siteName: context.shell.siteName,
    email: recipientEmail ?? "",
  };
  // Copyright and "sent to" share ONE line, the unsubscribe sentence the next.
  const legalLine = [
    words.copyright && context.shell.siteName ? fillArguments(words.copyright, values) : null,
    words.sentTo && recipientEmail ? fillArguments(words.sentTo, values) : null,
  ]
    .filter((line): line is string => line !== null)
    .join(" ");
  return {
    ...context.shell,
    // An empty path, not "/": `/ar/` is a trailing-slash redirect away from
    // the page, and the default locale's home is the bare origin.
    ...(origin ? { homeUrl: localizedUrl(origin, locale, "") } : {}),
    links,
    contacts,
    legalLines: legalLine ? [legalLine] : [],
    ...(words.unsubscribeLine ? { unsubscribeLine: words.unsubscribeLine } : {}),
  };
}

/**
 * The context, the words and the recipient in one call — for a PREVIEW, which
 * renders one message in one language and has no session to cache in.
 */
export async function loadLocalizedEmailContext(
  locale: string,
  recipientEmail: string | undefined,
  options: { scheme?: EmailScheme } = {},
): Promise<EmailRenderContext> {
  const [context, words] = await Promise.all([
    loadEmailRenderContext(options),
    loadEmailShellWords(locale),
  ]);
  return { ...context, shell: localizeEmailShell(context, words, locale, recipientEmail) };
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

/** One recipient's message within a session. */
export interface SessionSendInput {
  to: string;
  locale?: string | undefined;
  /** Used for {{recipient.name}}; the address is filled in automatically. */
  recipientName?: string | undefined;
  variables?: Readonly<Record<string, string>> | undefined;
  /** `oneClickUrl` is the RFC 8058 handler for the header; `url` is the page. */
  unsubscribe?: UnsubscribeLinks | undefined;
  /**
   * Replaces the template's own subject for this message (ADR-171 #8: a
   * campaign's override). Variables are substituted into it the same way.
   */
  subject?: string | undefined;
  /** The announcement this message belongs to, for the delivery log. */
  campaignId?: string | undefined;
  /**
   * The message's own words, in place of the template's stored content
   * (ADR-172 #2). Required for a campaign key, which owns no stored body; the
   * caller has already sanitised it, and the renderer sanitises again.
   */
  content?: MessageContent | undefined;
  /** Replaces the sender's Reply-To for this message (a DIRECT email's author). */
  replyTo?: string | undefined;
}

export interface MessageContent {
  subject: string;
  preheader?: string | null | undefined;
  mode: EmailBodyMode;
  bodyHtml: string;
}

export interface SendSessionOptions {
  /** The staff member who pressed the button, for the log. */
  triggeredById?: string | undefined;
  /** A test send ignores `isActive` — never the global switch. */
  isTest?: boolean | undefined;
  /** Pool SMTP connections across the batch (ADR-171). */
  pool?: boolean | undefined;
}

/**
 * Many messages from one template, with the expensive reads done ONCE
 * (ADR-171, plan §8.2): the global switch, the template, the render context,
 * the sender settings and the transport. A one-shot send makes about eight
 * reads of its own, which is fine for a password reset and fifty times too
 * many for a batch of fifty.
 *
 * The switches are read when the session opens, so a batch sees one answer
 * for its whole run. The announcement runner re-reads `email.enabled` before
 * every batch, which is where "switched off mid-campaign" is decided.
 */
export interface SendSession {
  send(input: SessionSendInput): Promise<DeliveryResult>;
  /** Releases pooled connections. Safe to call twice. */
  close(): void;
}

interface SenderSettings {
  context: EmailRenderContext;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
}

async function loadSender(): Promise<SenderSettings> {
  const [context, fromName, fromEmail, replyTo] = await Promise.all([
    loadEmailRenderContext(),
    loadSetting("email.fromName"),
    loadSetting("email.fromEmail"),
    loadSetting("email.replyTo"),
  ]);
  return {
    context,
    fromName: fromName ?? null,
    fromEmail: fromEmail ?? null,
    replyTo: replyTo ?? null,
  };
}

/**
 * A campaign key owns no row: no stored body, no translations and no on/off
 * switch (ADR-172 #4). The sender is the site-wide one.
 */
const CAMPAIGN_TEMPLATE = {
  isActive: true,
  fromName: null,
  fromEmail: null,
  replyTo: null,
  translations: [] as {
    locale: string;
    subject: string;
    preheader: string | null;
    mode: string;
    bodyHtml: string;
  }[],
};

export async function createSendSession(
  key: RenderableEmailKey,
  options: SendSessionOptions = {},
): Promise<SendSession> {
  const isTest = options.isTest ?? false;
  const enabled = (await loadSetting("email.enabled")) !== false;
  const template = !enabled
    ? null
    : isCampaignEmailKey(key)
      ? CAMPAIGN_TEMPLATE
      : await loadTemplate(key);

  // Loaded on the first message that gets past the switches, then kept: a
  // session whose every message is suppressed never opens a connection.
  let sender: Promise<SenderSettings> | undefined;
  let driver: Promise<EmailTransportDriver> | undefined;
  // One catalog read per language per session, like the sender (ADR-171).
  const shellWords = new Map<string, Promise<EmailShellWords>>();
  let closed = false;

  async function send(input: SessionSendInput): Promise<DeliveryResult> {
    const locale = input.locale ?? DEFAULT_EMAIL_LOCALE;
    const base = {
      key,
      to: input.to,
      locale,
      isTest,
      triggeredById: options.triggeredById,
      campaignId: input.campaignId,
    };

    // 1. The global switch. A test send does not get past this one either.
    if (!enabled) {
      return record({ ...base, subject: "", status: "SUPPRESSED", reason: "email.enabled is off" });
    }
    if (!template) {
      return record({
        ...base,
        subject: "",
        status: "FAILED",
        reason: `No template row for ${key} — run the seed.`,
        failure: "config",
      });
    }

    // 2. The template's own switch. A test IS allowed past this one: you have
    //    to be able to check a template before turning it on.
    if (!template.isActive && !isTest) {
      return record({ ...base, subject: "", status: "SUPPRESSED", reason: "template is inactive" });
    }

    // 3. The message's own words (a campaign's), else the template's in the
    //    locale, then the default locale (ADR-078 #12).
    const content =
      input.content ??
      template.translations.find((row) => row.locale === locale) ??
      template.translations.find((row) => row.locale === DEFAULT_EMAIL_LOCALE);
    if (!content) {
      return record({
        ...base,
        subject: "",
        status: "FAILED",
        reason: `Template ${key} has no ${DEFAULT_EMAIL_LOCALE} content.`,
        failure: "config",
      });
    }

    sender ??= loadSender();
    const { context, fromName, fromEmail, replyTo } = await sender;
    let words = shellWords.get(locale);
    if (!words) {
      words = loadEmailShellWords(locale);
      shellWords.set(locale, words);
    }
    const shell = localizeEmailShell(context, await words, locale, input.to);

    const resolvedSiteName = context.shell.siteName;
    const variables: Record<string, string> = {
      ...context.globals,
      "recipient.email": input.to,
      "recipient.name": input.recipientName ?? "",
      ...input.variables,
    };
    const subjectSource = input.subject ?? content.subject;

    let rendered;
    try {
      rendered = renderEmail({
        key,
        mode: content.mode as EmailBodyMode,
        subject: subjectSource,
        preheader: content.preheader ?? undefined,
        bodyHtml: content.bodyHtml,
        variables,
        palette: context.palette,
        shell: {
          ...shell,
          unsubscribe: input.unsubscribe
            ? { url: input.unsubscribe.url, label: input.unsubscribe.label }
            : undefined,
        },
      });
    } catch (error) {
      return record({
        ...base,
        subject: subjectSource,
        status: "FAILED",
        reason: errorMessage(error),
        failure: "render",
      });
    }

    // 4. Send. The sender identity is the template's override, then the
    //    site-wide setting.
    try {
      driver ??= loadTransportDriver({ pool: options.pool ?? false });
      const transport = await driver;
      const { messageId, sandbox } = await transport.send({
        to: input.to,
        from: {
          name: template.fromName ?? fromName ?? resolvedSiteName,
          address: template.fromEmail ?? fromEmail ?? "",
        },
        replyTo: input.replyTo ?? template.replyTo ?? replyTo ?? undefined,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        // RFC 8058: a mail client's own one-click button (ADR-080 #4).
        headers: listUnsubscribeHeaders(input.unsubscribe),
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
        failure: classifySendError(error),
      });
    }
  }

  return {
    send,
    close() {
      if (closed) return;
      closed = true;
      // A driver that never loaded has nothing to release; one whose load
      // failed has nothing either, and that failure was already recorded.
      void driver?.then((loaded) => loaded.close?.()).catch(() => undefined);
    },
  };
}

export async function sendTemplatedEmail(input: SendTemplatedEmailInput): Promise<DeliveryResult> {
  const session = await createSendSession(input.key, {
    triggeredById: input.triggeredById,
    isTest: input.isTest,
  });
  try {
    return await session.send({
      to: input.to,
      locale: input.locale,
      recipientName: input.recipientName,
      variables: input.variables,
      unsubscribe: input.unsubscribe,
    });
  } finally {
    session.close();
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
