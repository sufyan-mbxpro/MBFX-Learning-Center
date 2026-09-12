"use server";

// Newsletter signup — the one anonymous public mutation in this repo
// (ADR-080 #3), and the first server action under `app/(public)`.
//
// `requirePermission()` is the first line of every mutation (security.md #1),
// and it cannot be the first line here: there is no subject to check. That is
// not an exemption, it is a swap, and the replacement has five parts which
// must ALL be present:
//
//   1. the `newsletter` feature flag — an off flag is a 404, not a disabled
//      button, so the endpoint does not exist when the feature does not;
//   2. a honeypot field, which costs a bot nothing to fill and a human
//      nothing to leave alone;
//   3. a per-IP limit — one attacker;
//   4. a per-email limit — a distributed mail-bomb aimed at one address
//      (security.md #13 wants both, not one);
//   5. `newsletterSubscribeSchema`, which is also where the address is
//      lower-cased, so the rate-limit bucket and the unique constraint agree.
//
// Anything else in this app that wants to write without a subject needs its
// own ADR saying why these five are enough for it too.
import { after } from "next/server";
import { headers } from "next/headers";
import { rateLimit } from "@repo/auth";
import {
  NEWSLETTER_HONEYPOT_FIELD,
  newsletterSubscribeSchema,
  newsletterTokenSchema,
} from "@repo/contracts";
import { confirmSubscription, subscribe, unsubscribe } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";
import { clientIp } from "../../../_lib/client-ip.ts";

/**
 * What the form renders. Deliberately NOT "already subscribed" or "new
 * subscriber" — the four outcomes a visitor can distinguish are the four
 * that tell them nothing about anyone else's mailbox (ADR-080 #1).
 */
export type NewsletterState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid" }
  | { status: "limited" }
  | { status: "failed" };

/** Per IP: enough for a household behind one address, not enough to farm. */
const IP_LIMIT = 5;
const IP_WINDOW_SECONDS = 600;

/** Per address: three confirmation emails an hour is already generous. */
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_SECONDS = 3600;

export async function subscribeAction(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  // 1. The flag. Checked with a null subject on purpose: the seeded
  //    visibility is PUBLIC, and an anonymous visitor is exactly who this is
  //    for — evaluating it against a session would make signup depend on
  //    being signed in.
  if (!(await isFeatureVisible("newsletter", null))) return { status: "failed" };

  // 2. The honeypot, before anything is parsed or counted. A bot that fills
  //    it gets the SUCCESS message and no write: telling it that it was
  //    detected is how it learns to stop filling the field.
  const honeypot = formData.get(NEWSLETTER_HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return { status: "sent" };

  const parsed = newsletterSubscribeSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
    source: formData.get("source"),
  });
  // An invalid `source` or `locale` is a tampered form, not a typo, so it
  // answers the same way a bad address does rather than naming the field.
  if (!parsed.success) return { status: "invalid" };

  // 3. Per IP. An unidentifiable caller falls into one shared bucket, which
  //    throttles the header-less case harder rather than exempting it.
  const ip = clientIp(await headers()) ?? "anonymous";
  const byIp = await rateLimit(`newsletter:ip:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS);
  if (!byIp.ok) return { status: "limited" };

  // 4. Per address, so a botnet cannot mail-bomb one inbox from a thousand
  //    IPs. `subscribe()` additionally holds a 10-minute cooldown on the row
  //    itself, which is what survives a Redis outage — `rateLimit` fails
  //    OPEN, and this endpoint sends email.
  const byEmail = await rateLimit(
    `newsletter:email:${parsed.data.email}`,
    EMAIL_LIMIT,
    EMAIL_WINDOW_SECONDS,
  );
  if (!byEmail.ok) return { status: "limited" };

  const { email, locale, source } = parsed.data;

  // The write and its email both run after the response (ADR-078 #11's
  // `after()`, no queue). It also means a known address and an unknown one
  // answer in the same time — the same reason the auth package sends its
  // reset mail from a background task.
  after(async () => {
    await subscribe({ email, locale, source });
  });

  return { status: "sent" };
}

// ─── Confirm and unsubscribe ─────────────────────────────────
//
// **These mutate, and they are never reached by a GET** (ADR-080 #4). Mail
// security scanners fetch every link in a message before a human sees it, so a
// GET that confirmed a subscription would confirm people who never clicked,
// and a GET that unsubscribed would remove readers who never asked. The link
// in the email lands on a PAGE; the page renders a button; the button calls
// one of these.
//
// **They take the token as an argument, not a `FormData`**, because the token
// lives only in the browser's URL: reading it on the server would opt the
// whole route out of prerendering (architecture.md #6) for a value only the
// submit needs, so the client reads it at press time — exactly as
// `reset-password-form.tsx` does with `?token=`. That also means there is no
// no-JavaScript path here, unlike signup, and pretending otherwise with a
// hidden input populated by an effect would be a worse lie than saying so.
//
// **Neither is flag-gated.** Turning the newsletter off must not trap the
// people already on the list — an unsubscribe link in a message sent last
// month has to keep working whatever the flag says now — and a pending row's
// confirm link stays honourable until it expires.

export type TokenActionResult = "confirmed" | "unsubscribed" | "invalid" | "failed";

/** Shared by both: a malformed token never reaches a `findUnique`. */
async function guardToken(
  value: unknown,
  bucket: string,
): Promise<{ ok: true; token: string } | { ok: false; result: TokenActionResult }> {
  const parsed = newsletterTokenSchema.safeParse(value);
  if (!parsed.success) return { ok: false, result: "invalid" };

  // Bounded even though the token is unguessable: this is an unauthenticated
  // endpoint doing a unique lookup, and the limit is what keeps it from being
  // a free oracle to hammer.
  const ip = clientIp(await headers()) ?? "anonymous";
  const limited = await rateLimit(`newsletter:${bucket}:${ip}`, 10, 600);
  if (!limited.ok) return { ok: false, result: "failed" };

  return { ok: true, token: parsed.data };
}

export async function confirmSubscriptionAction(token: unknown): Promise<TokenActionResult> {
  const guard = await guardToken(token, "confirm");
  if (!guard.ok) return guard.result;
  return confirmSubscription(guard.token);
}

export async function unsubscribeAction(token: unknown): Promise<TokenActionResult> {
  const guard = await guardToken(token, "unsub");
  if (!guard.ok) return guard.result;
  return unsubscribe(guard.token);
}
