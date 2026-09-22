// The transport seam (ADR-078 #2). Three implementations today — SMTP,
// SendGrid's v3 Web API (ADR-152) and the log driver Module 04's `logEmail()`
// becomes — so another provider, or the changes-12 worker, replaces an
// implementation and nothing else.
import { createTransport } from "nodemailer";
import { db } from "@repo/db";
import { openSecret } from "./secret.ts";

/** The singleton row's id. There is one transport, not one per anything. */
export const TRANSPORT_ID = "default";

export interface OutgoingEmail {
  to: string;
  from: { name: string; address: string };
  replyTo?: string | undefined;
  subject: string;
  html: string;
  text: string;
  /** List-Unsubscribe and friends (ADR-080 #4). */
  headers?: Record<string, string> | undefined;
}

export interface SentEmail {
  messageId: string;
  /**
   * True when the provider VALIDATED the message and delivered nothing
   * (SendGrid sandbox mode, ADR-152). The delivery log says so, because a SENT
   * row that reached no inbox is otherwise indistinguishable from one that did.
   */
  sandbox?: boolean;
}

export interface EmailTransportDriver {
  readonly kind: "smtp" | "sendgrid" | "log" | "memory";
  send(message: OutgoingEmail): Promise<SentEmail>;
  /** Throws when the transport cannot be reached or authenticated. */
  verify(): Promise<void>;
}

export type SmtpSecurity = "NONE" | "STARTTLS" | "TLS";

export interface SmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username?: string | null;
  password?: string | null;
}

/**
 * Pure config mapping, exported for its test.
 *
 * `secure` is TLS-on-connect (port 465). STARTTLS is the opposite shape:
 * connect in the clear, then upgrade — and `requireTLS` is what makes the
 * upgrade mandatory. Without it nodemailer will happily continue unencrypted
 * when a server declines, which is the difference between "encrypted" and
 * "encrypted when convenient".
 */
export function smtpTransportOptions(config: SmtpConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: config.security === "TLS",
    requireTLS: config.security === "STARTTLS",
    auth: config.username ? { user: config.username, pass: config.password ?? "" } : undefined,
  };
}

export function smtpDriver(config: SmtpConfig): EmailTransportDriver {
  const transporter = createTransport(smtpTransportOptions(config));
  return {
    kind: "smtp",
    async send(message) {
      const info = await transporter.sendMail({
        to: message.to,
        from: { name: message.from.name, address: message.from.address },
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      });
      return { messageId: info.messageId };
    },
    async verify() {
      await transporter.verify();
    },
  };
}

// ─── SendGrid (ADR-152) ─────────────────────────────────────

const SENDGRID_API = "https://api.sendgrid.com/v3";

export interface SendgridConfig {
  apiKey: string;
  /** `mail_settings.sandbox_mode` — validated by SendGrid, delivered to nobody. */
  sandbox: boolean;
}

/**
 * The v3 Mail Send body, exported for its test. Pure: the whole reason this
 * driver exists is one field in it, and that field is checked here rather
 * than through a network call.
 *
 * `text/plain` must precede `text/html` — SendGrid rejects the other order.
 * `reply_to` and `headers` are omitted rather than sent empty: SendGrid 400s
 * on an empty `reply_to.email`.
 */
export function sendgridMailBody(message: OutgoingEmail, sandbox: boolean) {
  return {
    personalizations: [{ to: [{ email: message.to }] }],
    from: { email: message.from.address, name: message.from.name },
    ...(message.replyTo ? { reply_to: { email: message.replyTo } } : {}),
    subject: message.subject,
    content: [
      { type: "text/plain", value: message.text },
      { type: "text/html", value: message.html },
    ],
    ...(message.headers ? { headers: message.headers } : {}),
    mail_settings: { sandbox_mode: { enable: sandbox } },
  };
}

/**
 * SendGrid over HTTPS rather than SMTP, because `sandbox_mode` exists on the
 * v3 Mail Send API and nowhere else. Plain `fetch`: one POST does not earn an
 * SDK in the dependency graph.
 */
export function sendgridDriver(config: SendgridConfig): EmailTransportDriver {
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  return {
    kind: "sendgrid",
    async send(message) {
      const response = await fetch(`${SENDGRID_API}/mail/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(sendgridMailBody(message, config.sandbox)),
      });
      // 202 = queued for delivery; 200 = accepted in sandbox mode.
      if (!response.ok) throw new Error(await sendgridError(response));
      const id = response.headers.get("x-message-id");
      return config.sandbox
        ? { messageId: id ?? `sandbox-${randomId()}`, sandbox: true }
        : { messageId: id ?? `sendgrid-${randomId()}` };
    },
    async verify() {
      // A key can authenticate and still be unable to send (a read-only key),
      // so "Test connection" asks what the key may DO, not merely whether it
      // is accepted. Sends nothing, so it is safe with sandbox mode off.
      const response = await fetch(`${SENDGRID_API}/scopes`, { headers });
      if (!response.ok) throw new Error(await sendgridError(response));
      const body = (await response.json()) as { scopes?: unknown };
      const scopes = Array.isArray(body.scopes) ? body.scopes : [];
      if (!scopes.includes("mail.send")) {
        throw new Error("SendGrid: this API key has no Mail Send permission.");
      }
    },
  };
}

/** SendGrid's own message, never the raw body — it can echo the request. */
async function sendgridError(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { errors?: { message?: unknown }[] };
    detail = (body.errors ?? [])
      .map((error) => (typeof error.message === "string" ? error.message : ""))
      .filter(Boolean)
      .join("; ");
  } catch {
    // Not JSON — the status line is all there is.
  }
  return `SendGrid ${response.status}${detail ? `: ${detail}` : ""}`;
}

/**
 * What runs until SMTP is configured. It is how a developer reads a reset
 * link, and it is the reason an unconfigured install degrades to "no mail"
 * rather than to an exception on every sign-up.
 */
export function logDriver(): EmailTransportDriver {
  return {
    kind: "log",
    send(message) {
      // The plain-text alternative, not just the subject: this driver exists
      // so a developer with no SMTP server can still follow a reset or
      // verification link, and `htmlToText` spells every URL out. It is also
      // what the auth integration tests read the token from — the real
      // rendered message, rather than a mock of one.
      console.log(`[email → ${message.to}] ${message.subject}\n${message.text}`);
      return Promise.resolve({ messageId: `log-${randomId()}` });
    },
    verify() {
      return Promise.resolve();
    },
  };
}

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * The ONE reader of `passwordCipher` (ADR-078 #3). Everything else reads
 * `EmailTransportView`, which has no password property at all.
 */
export async function loadTransportDriver(): Promise<EmailTransportDriver> {
  const row = await db.emailTransport.findUnique({ where: { id: TRANSPORT_ID } });
  // An incomplete row falls back to the log driver rather than throwing:
  // a half-filled form must not take sign-up down with it.
  if (!row || row.driver === "LOG") return logDriver();
  if (row.driver === "SENDGRID") {
    if (!row.passwordCipher) return logDriver();
    return sendgridDriver({ apiKey: openSecret(row.passwordCipher), sandbox: row.sandboxMode });
  }
  if (!row.host || !row.port) return logDriver();
  return smtpDriver({
    host: row.host,
    port: row.port,
    security: row.security,
    username: row.username,
    password: row.passwordCipher ? openSecret(row.passwordCipher) : null,
  });
}
