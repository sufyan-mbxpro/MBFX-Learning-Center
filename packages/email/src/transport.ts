// The transport seam (ADR-078 #2). Two implementations today — SMTP and the
// log driver Module 04's `logEmail()` becomes — so a provider API driver, or
// the changes-12 worker, replaces an implementation and nothing else.
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

export interface EmailTransportDriver {
  readonly kind: "smtp" | "log" | "memory";
  send(message: OutgoingEmail): Promise<{ messageId: string }>;
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

/**
 * What runs until SMTP is configured. It is how a developer reads a reset
 * link, and it is the reason an unconfigured install degrades to "no mail"
 * rather than to an exception on every sign-up.
 */
export function logDriver(): EmailTransportDriver {
  return {
    kind: "log",
    send(message) {
      console.log(`[email → ${message.to}] ${message.subject}`);
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
  // An incomplete SMTP row falls back to the log driver rather than throwing:
  // a half-filled form must not take sign-up down with it.
  if (!row || row.driver === "LOG" || !row.host || !row.port) return logDriver();
  return smtpDriver({
    host: row.host,
    port: row.port,
    security: row.security,
    username: row.username,
    password: row.passwordCipher ? openSecret(row.passwordCipher) : null,
  });
}
