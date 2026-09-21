// The support contact form's one service (Module 12, ADR-113).
//
// Three properties, in the order a reader will want them:
//
//   1. **Nothing is stored.** A support message is delivered, not recorded.
//      There is no `SupportRequest` model, which means this anonymous
//      endpoint has no table an attacker can grow. What survives the send is
//      the `EmailDelivery` row `sendTemplatedEmail` writes — key, recipient,
//      status, timestamp, and deliberately no body and no variables
//      (ADR-078 #5) — so "did their message reach us?" is answerable from
//      the admin without the log becoming a second copy of everyone's words.
//   2. **`to` is an argument, and the caller may not choose it freely.** The
//      destination is the support inbox recorded in the app's own facts file,
//      which `@repo/core` sits upstream of and therefore cannot import. It
//      arrives as a parameter for that reason alone — never from the request.
//      A `to` that came off a form would make this an open relay.
//   3. **It never throws.** `sendTemplatedEmail` resolves with a FAILED
//      status rather than rejecting (ADR-078 #9), and this returns that
//      status through. The action above it decides what the visitor reads;
//      the one thing neither layer does is pretend a failure was a success.
//
// No audit row. There is no actor — writing `userId: null` rows would fill
// the trail that exists to answer "who did this?" with rows that cannot
// (`newsletter.ts` refuses one for the same reason).
import { sendTemplatedEmail, type DeliveryResult } from "@repo/email";

export interface SendSupportRequestInput {
  /**
   * The support inbox. Supplied by the caller from its own configuration,
   * NEVER from the submitted form (see #2 above).
   */
  to: string;
  /** All four already trimmed and bounded by `supportRequestSchema`. */
  name: string;
  email: string;
  subject: string;
  message: string;
  /**
   * The locale the visitor was reading. It is PRINTED in the message, not
   * used to choose a translation: the recipient is a staff member and staff
   * mail is English (ADR-043 #2), so rendering a Spanish visitor's report in
   * Spanish would translate it away from the person who has to read it. The
   * code is carried so support knows which language to reply in.
   */
  locale: string;
}

export async function sendSupportRequest(input: SendSupportRequestInput): Promise<DeliveryResult> {
  return sendTemplatedEmail({
    key: "support.request",
    to: input.to,
    // No `locale` — see the field's own note. Omitted rather than passed as
    // "en", so the one place that decides is `DEFAULT_EMAIL_LOCALE`.
    variables: {
      "contact.name": input.name,
      "contact.email": input.email,
      "contact.subject": input.subject,
      "contact.message": input.message,
      "contact.locale": input.locale,
    },
  });
}
