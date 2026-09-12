// Newsletter contracts (Module 17, ADR-080, changes-21 F7).
//
// Signup is the ONE anonymous public mutation in this repo (ADR-080 #3).
// There is no subject, so `requirePermission()` cannot apply — security.md #1
// assumes one — and its place is taken by a stack that must be present in
// full: the `newsletter` flag, THIS schema, a honeypot field, a per-IP limit
// and a per-email limit. That makes this file load-bearing in a way the other
// contract modules are not: it is the only validation between an unknown
// caller and a write.
//
// No words live here (code-style #2). The admin's filter labels and every
// message a visitor reads come from the catalog.
import { z } from "zod";

/**
 * Where an address came from. It is a closed set rather than free text
 * because the four values ARE the four placements (ADR-080 #5) and the admin
 * screen filters on them — a fifth placement is a code change that lands
 * here, its setting key and its render site together.
 */
export const NEWSLETTER_SOURCES = ["footer", "home", "news", "analysis"] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

export const SUBSCRIBER_STATUSES = ["PENDING", "ACTIVE", "UNSUBSCRIBED"] as const;
export type SubscriberStatusValue = (typeof SUBSCRIBER_STATUSES)[number];

/**
 * The honeypot field's name. A real visitor never sees it, so a filled value
 * is a bot; the name is deliberately plausible ("website" is what a
 * comment-spam bot expects to find) rather than `honeypot`.
 *
 * Exported so the form and the action cannot disagree about which field to
 * check — the failure mode of a hard-coded string on both sides is a honeypot
 * that silently stops working.
 */
export const NEWSLETTER_HONEYPOT_FIELD = "website";

/**
 * What the public form submits.
 *
 * `email` is lower-cased HERE rather than in the service, so the unique
 * constraint and the per-email rate-limit bucket see the same string — an
 * address normalised in only one of those two places gives a caller two
 * budgets for one mailbox.
 */
export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
  locale: z.string().min(2).max(10),
  source: z.enum(NEWSLETTER_SOURCES),
  /** Absent or empty for a human. Any value refuses the write. */
  [NEWSLETTER_HONEYPOT_FIELD]: z.string().max(255).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

/**
 * A confirm or unsubscribe token as it arrives from a URL.
 *
 * 64 hex characters: `randomBytes(32).toString("hex")`. Bounded and
 * character-classed so a token is rejected before it reaches a `findUnique`,
 * which keeps an oversized query string out of the database entirely.
 */
export const newsletterTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const newsletterConfirmSchema = z.object({ token: newsletterTokenSchema });
export const newsletterUnsubscribeSchema = z.object({ token: newsletterTokenSchema });

/**
 * The admin list's filters. `limit` clamps here, the ADR-067 shape shared with
 * the media library and the delivery log: there is no way to ask this for the
 * whole table, and every row is an email address.
 */
export const subscriberFilterSchema = z.object({
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
  source: z.enum(NEWSLETTER_SOURCES).optional(),
  /** Matches the address. */
  q: z.string().trim().max(255).optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type SubscriberFilter = z.infer<typeof subscriberFilterSchema>;

/**
 * The CSV export's filters — the list's, without paging. A cursor would make
 * an export of "everything that matches" depend on where a reader had
 * scrolled to.
 */
export const subscriberExportSchema = subscriberFilterSchema.omit({
  cursor: true,
  limit: true,
});

export type SubscriberExportFilter = z.infer<typeof subscriberExportSchema>;

/** A row action on the admin screen. */
export const subscriberIdSchema = z.object({ id: z.string().min(1).max(64) });
