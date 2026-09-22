"use server";

// The support contact form — the SECOND anonymous public mutation in this
// repo (ADR-113), and deliberately built to the same pattern as the first.
//
// `_actions/newsletter.ts` opens by explaining why `requirePermission()`
// (security.md #1) cannot be the first line of a mutation with no subject,
// and what replaces it. That argument is not repeated here; what matters is
// that the SAME five parts are present, with one substitution:
//
//   1. a recorded support inbox (`site.supportEmail`, Settings → General,
//      ADR-131) — this feature's equivalent of the `newsletter` flag. A
//      `/support` page with no address recorded renders
//      no form at all (ADR-047 §2), and this refuses even if one is posted
//      anyway, because the button not being drawn is UX and this is the
//      boundary;
//   2. a honeypot field;
//   3. a per-IP limit;
//   4. a per-email limit (security.md #13 wants both, not one — one attacker
//      and a distributed mail-bomb aimed at one inbox are different attacks);
//   5. `supportRequestSchema`, which bounds every field and lower-cases the
//      address so the limit bucket and the send agree on it.
//
// **This is not an open relay and cannot become one.** The destination is
// the `site.supportEmail` setting, which only STAFF can edit; no submitted
// value reaches `to`. That is the property to preserve above all others if
// this file is ever edited.
//
// A third endpoint of this shape needs its own ADR. Two is a pattern; three
// without one is how a repo ends up with an anonymous write nobody audited.
import { after } from "next/server";
import { headers } from "next/headers";
import { rateLimit } from "@repo/auth";
import { SUPPORT_HONEYPOT_FIELD, supportRequestSchema } from "@repo/contracts";
import { sendSupportRequest } from "@repo/core";
import { getSetting } from "@repo/settings";
import { clientIp } from "../../../_lib/client-ip.ts";

/**
 * What the form renders. Four states, the same four the newsletter form has,
 * and for the same reason: they are the ones that say something true about
 * THIS submission without saying anything about anybody else.
 */
export type SupportRequestState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; values?: SupportFormValues }
  | { status: "limited"; values?: SupportFormValues }
  | { status: "failed"; values?: SupportFormValues };

/**
 * What the visitor typed, handed back on a refusal. React resets a form after
 * its action settles, so without this a "try again later" would also wipe the
 * message the visitor is being asked to try again with. It is their own input
 * echoed to their own browser, never anybody else's.
 */
export interface SupportFormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function echo(formData: FormData): SupportFormValues {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    email: text("email"),
    subject: text("subject"),
    message: text("message"),
  };
}

/** Per IP: a household behind one address can ask twice; nobody can farm it. */
const IP_LIMIT = 5;
const IP_WINDOW_SECONDS = 3600;

/** Per address: three messages an hour from one sender is already generous. */
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_SECONDS = 3600;

export async function sendSupportRequestAction(
  _previous: SupportRequestState,
  formData: FormData,
): Promise<SupportRequestState> {
  // 1. A destination. Checked FIRST so that an unconfigured install answers
  //    the same way whether or not the caller got past anything else — there
  //    is nothing to rate-limit if there is nowhere to send.
  //    changes-49 (owner): the form delivers to Settings → General → Contact
  //    email, the inbox staff actually read; the Support email stays the
  //    address the page PRINTS. An install with no contact address recorded
  //    still delivers, to the printed one, rather than losing the message.
  const to = (await getSetting("site.contactEmail")) || (await getSetting("site.supportEmail"));
  if (!to) return { status: "failed", values: echo(formData) };

  // 2. The honeypot, before anything is parsed or counted. A bot that fills
  //    it gets the SUCCESS message and no send: telling it that it was
  //    detected is how it learns to stop filling the field.
  const honeypot = formData.get(SUPPORT_HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return { status: "sent" };

  const parsed = supportRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    locale: formData.get("locale"),
  });
  // One state for every shape of bad input. The form marks its four fields
  // `required` and types the address, so a submission that reaches here
  // malformed is a tampered form rather than a typo, and naming the field
  // would only help whoever tampered.
  if (!parsed.success) return { status: "invalid", values: echo(formData) };

  // 3. Per IP. An unidentifiable caller falls into one shared bucket, which
  //    throttles the header-less case harder rather than exempting it.
  const ip = clientIp(await headers()) ?? "anonymous";
  const byIp = await rateLimit(`support:ip:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS);
  if (!byIp.ok) return { status: "limited", values: echo(formData) };

  // 4. Per address, so a botnet cannot flood the support inbox from a
  //    thousand IPs while each one stays inside its own budget.
  const byEmail = await rateLimit(
    `support:email:${parsed.data.email}`,
    EMAIL_LIMIT,
    EMAIL_WINDOW_SECONDS,
  );
  if (!byEmail.ok) return { status: "limited", values: echo(formData) };

  const { name, email, subject, message, locale } = parsed.data;

  // The send runs after the response (ADR-078 #11's `after()`, no queue), so
  // the visitor is not held on an SMTP handshake. The trade is stated rather
  // than hidden: the form reports "sent" for a message that has not yet left,
  // and a delivery failure lands as a FAILED row in the log instead of on the
  // screen. The log is what makes it answerable — which is why there is a
  // delivery row for a message this repo deliberately does not store.
  after(async () => {
    await sendSupportRequest({ to, name, email, subject, message, locale });
  });

  return { status: "sent" };
}
