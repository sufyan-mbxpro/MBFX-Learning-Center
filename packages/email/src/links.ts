// The announcement unsubscribe token (ADR-171 #9, #10; changes-54 §9.1).
//
// Signed and STATELESS, unlike the newsletter's, and for one reason: the
// newsletter stores only a HASH of its token, so an existing subscriber's
// link cannot be rebuilt for a new message — and rotating it per send would
// break the link in every message already sent (ADR-080 #2).
//
//   t = "v1." + b64url(kind + ":" + id) + "." + b64url(HMAC-SHA256(secret,
//        "announce-unsub:v1:" + kind + ":" + id))
//
// - **No address in the URL.** The id is looked up, so an email address never
//   lands in an access log.
// - **It never expires.** One click months later still works, and all it can
//   do is suppress its own address.
// - **This file is the only reader of `EMAIL_LINK_SECRET`.** Verification also
//   accepts `EMAIL_LINK_SECRET_PREVIOUS`, so rotating the secret does not
//   break every earlier message's link.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UnsubscribeSubjectKind } from "@repo/contracts";

const VERSION = "v1";
const DOMAIN = "announce-unsub:v1:";

export interface UnsubscribeSubject {
  kind: UnsubscribeSubjectKind;
  id: string;
}

/** Thrown by `signUnsubscribeToken` when no secret is configured. */
export class LinkSecretMissingError extends Error {
  constructor() {
    super("EMAIL_LINK_SECRET is not set.");
    this.name = "LinkSecretMissingError";
  }
}

interface Secrets {
  current: string | undefined;
  previous: string | undefined;
}

function envSecrets(): Secrets {
  return {
    current: process.env.EMAIL_LINK_SECRET || undefined,
    previous: process.env.EMAIL_LINK_SECRET_PREVIOUS || undefined,
  };
}

/** Whether announcements can carry an unsubscribe link at all. */
export function hasLinkSecret(secrets: Secrets = envSecrets()): boolean {
  return secrets.current !== undefined;
}

function mac(secret: string, payload: string): Buffer {
  return createHmac("sha256", secret)
    .update(DOMAIN + payload)
    .digest();
}

export function signUnsubscribeToken(
  subject: UnsubscribeSubject,
  secrets: Secrets = envSecrets(),
): string {
  if (!secrets.current) throw new LinkSecretMissingError();
  const payload = `${subject.kind}:${subject.id}`;
  return [
    VERSION,
    Buffer.from(payload, "utf8").toString("base64url"),
    mac(secrets.current, payload).toString("base64url"),
  ].join(".");
}

/**
 * The subject a token names, or null for anything that is not a token this
 * site signed. Never throws: a malformed token is just "no".
 */
export function verifyUnsubscribeToken(
  token: string,
  secrets: Secrets = envSecrets(),
): UnsubscribeSubject | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, encodedPayload = "", encodedMac = ""] = parts;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  // Base64url decoding is lenient; re-encoding must round-trip, or two
  // spellings would verify as one token.
  if (Buffer.from(payload, "utf8").toString("base64url") !== encodedPayload) return null;

  const given = Buffer.from(encodedMac, "base64url");
  const candidates = [secrets.current, secrets.previous].filter(
    (secret): secret is string => typeof secret === "string" && secret.length > 0,
  );
  const valid = candidates.some((secret) => {
    const expected = mac(secret, payload);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!valid) return null;

  const separator = payload.indexOf(":");
  const kind = payload.slice(0, separator);
  const id = payload.slice(separator + 1);
  if (separator < 1 || (kind !== "u" && kind !== "s") || id.length === 0) return null;
  return { kind, id };
}

/**
 * The two URLs an announcement carries (ADR-171 #9): the page a person clicks
 * (static shell, island POSTs) and the RFC 8058 handler a mail client posts to.
 */
export function announcementUnsubscribeUrls(
  token: string,
  origin: string,
  locale: string,
  defaultLocale = "en",
): { page: string; oneClick: string } {
  const base = origin.replace(/\/+$/, "");
  const prefix = locale && locale !== defaultLocale ? `/${locale}` : "";
  const t = encodeURIComponent(token);
  return {
    page: `${base}${prefix}/email/unsubscribe?t=${t}`,
    oneClick: `${base}/api/email/unsubscribe?t=${t}`,
  };
}
