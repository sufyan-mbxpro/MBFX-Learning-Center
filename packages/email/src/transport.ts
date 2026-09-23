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
  /**
   * Refuse a key SendGrid cannot read as a Bearer token, rather than letting
   * it answer. An empty token and one containing a space both come back as
   * `400 authorization required` — the same words SendGrid uses for no
   * `Authorization` header at all, and the reason a `Bearer SG.xyz` paste was
   * unreadable as a diagnosis. A wrong but well-formed key still goes to
   * SendGrid, because `401 unauthorized` is its answer to give.
   *
   * `normalizeSendgridApiKey` stops a new save from reaching here; this stops
   * a row saved before it existed from reporting SendGrid's wording instead of
   * its own fault.
   */
  const assertUsableKey = () => {
    if (!config.apiKey) {
      throw new Error("SendGrid: no API key is stored. Enter one and save.");
    }
    if (/\s/u.test(config.apiKey)) {
      throw new Error(
        "SendGrid: the stored API key contains a space or line break. " +
          "Paste the key on its own — no `Bearer` prefix — and save it again.",
      );
    }
  };
  /**
   * SendGrid's answer, plus the one thing it cannot see. Only on 401: a 403
   * means the key authenticated, so its shape is not the fault and a note
   * about it would send the admin after the wrong one.
   */
  const refusal = async (response: Response): Promise<Error> => {
    const message = await sendgridError(response);
    const note = response.status === 401 ? sendgridKeyShapeNote(config.apiKey) : null;
    return new Error(note ? `${message} — ${note}` : message);
  };
  return {
    kind: "sendgrid",
    async send(message) {
      assertUsableKey();
      const response = await fetch(`${SENDGRID_API}/mail/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(sendgridMailBody(message, config.sandbox)),
      });
      // 202 = queued for delivery; 200 = accepted in sandbox mode.
      if (!response.ok) throw await refusal(response);
      const id = response.headers.get("x-message-id");
      return config.sandbox
        ? { messageId: id ?? `sandbox-${randomId()}`, sandbox: true }
        : { messageId: id ?? `sendgrid-${randomId()}` };
    },
    async verify() {
      // A key can authenticate and still be unable to send (a read-only key),
      // so "Test connection" asks what the key may DO, not merely whether it
      // is accepted. Sends nothing, so it is safe with sandbox mode off.
      assertUsableKey();
      const response = await fetch(`${SENDGRID_API}/scopes`, { headers });
      if (!response.ok) throw await refusal(response);
      const body = (await response.json()) as { scopes?: unknown };
      const scopes = Array.isArray(body.scopes) ? body.scopes : [];
      if (!scopes.includes("mail.send")) {
        throw new Error("SendGrid: this API key has no Mail Send permission.");
      }
    },
  };
}

/**
 * SendGrid's published key format: `SG.` + 22 + `.` + 43, 69 characters, and
 * the shape every secret scanner matches on. It is a guess about a vendor's
 * format, which is why nothing REFUSES on it — it only annotates a refusal
 * SendGrid has already made.
 */
const SENDGRID_KEY_SHAPE = /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/u;
const SENDGRID_KEY_LENGTH = 69;

/**
 * What we know about a refused key that SendGrid does not: its SHAPE.
 * Exported for its test. Returns no part of the key — the LENGTH is the whole
 * diagnosis, and a length is not a secret.
 *
 * `401 unauthorized` is the honest answer to a key SendGrid does not
 * recognise, and it is the same answer for a revoked key, a key from another
 * account, and a key eight characters longer than a key can be. Only the last
 * is visible from here, and it is the one an admin can fix without leaving the
 * screen: a paste that took in the neighbouring token, which
 * `normalizeSendgridApiKey` welds onto the tail rather than leaving a space
 * `assertUsableKey` could refuse. That welding is the cost of the ADR-152
 * follow-up that stopped `Bearer SG.xyz` reading as a rejected key, and this
 * is what pays it back — the artifact is still removed, and the key that comes
 * out the wrong length now says so instead of quoting SendGrid at the admin.
 */
export function sendgridKeyShapeNote(apiKey: string): string | null {
  if (SENDGRID_KEY_SHAPE.test(apiKey)) return null;
  const detail = !apiKey.startsWith("SG.")
    ? "the stored key does not begin with `SG.`"
    : apiKey.length === SENDGRID_KEY_LENGTH
      ? "the stored key is 69 characters but not the `SG.` + 22 + `.` + 43 shape"
      : `the stored key is ${apiKey.length} characters and a SendGrid key is ${SENDGRID_KEY_LENGTH}`;
  return `${detail}. Copy the key from SendGrid again — the whole key and nothing either side of it — and save it.`;
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
