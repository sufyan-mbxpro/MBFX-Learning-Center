// Support contact form contracts (Module 12, ADR-113).
//
// This is the SECOND anonymous public mutation in this repo. ADR-080 #3 said
// newsletter signup was the one, and that sentence was load-bearing: it meant
// "there is exactly one place where an unknown caller can write, and you can
// read all of its defences in one file". A second one does not repeal that so
// much as raise the bar for a third — so this file is deliberately the same
// shape as `newsletter.ts`, and the action beside it carries the same five
// parts, because the thing worth protecting is that both are auditable by
// reading one file each rather than by remembering which one was the careful
// one.
//
// `requirePermission()` cannot be the first line of a mutation with no
// subject (security.md #1 assumes one). Its replacement here:
//
//   1. a recorded support inbox — no destination means the endpoint refuses,
//      which is this feature's equivalent of the `newsletter` flag;
//   2. a honeypot field;
//   3. THIS schema, which also bounds every field;
//   4. a per-IP limit;
//   5. a per-email limit (security.md #13 wants both, not one).
//
// **What this endpoint does NOT do is as important as what it does.** It
// stores nothing, so there is no table for an attacker to fill; it sends to
// ONE address that the caller cannot influence, so it is not an open relay;
// and the visitor's words reach that address as escaped template variables
// (ADR-078 #6), never as markup.
//
// No words live here (code-style #2).
import { z } from "zod";

/**
 * The honeypot field's name. Deliberately NOT shared with
 * `NEWSLETTER_HONEYPOT_FIELD`: a bot that learns to leave "website" alone on
 * the footer form should not thereby pass this one too, and the cost of a
 * second constant is one line.
 *
 * "company" is what a contact-form spam bot expects to find, which is the
 * property that makes a honeypot work — it has to look worth filling.
 */
export const SUPPORT_HONEYPOT_FIELD = "company";

/** Matches the reference form's `rows={6}` textarea without being a novel. */
export const SUPPORT_MESSAGE_MAX = 5000;

/**
 * What the public form submits.
 *
 * `email` is lower-cased HERE rather than in the service, for the reason
 * `newsletterSubscribeSchema` states: an address normalised in only one of
 * the two places gives a caller two rate-limit budgets for one mailbox.
 *
 * Every field is `.trim()`ed and bounded before it can reach a template
 * variable. `name` and `subject` additionally refuse CR/LF — they are the two
 * values a template author is most likely to put in a SUBJECT line, and a
 * newline in a header is how the rest of it becomes a Bcc
 * (`emailTemplateSaveSchema` guards the admin-authored half of the same
 * hazard; this guards the visitor-supplied half).
 */
export const supportRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => !/[\r\n]/.test(value)),
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value)),
  // Newlines ARE allowed here: this one is a body, and the reference's own
  // placeholder invites a description "in detail".
  message: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX),
  locale: z.string().min(2).max(10),
  /** Absent or empty for a human. Any value refuses the send. */
  [SUPPORT_HONEYPOT_FIELD]: z.string().max(255).optional(),
});

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
