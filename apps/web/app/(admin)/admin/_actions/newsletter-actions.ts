"use server";

// Subscriber admin actions (Module 17, ADR-080 #7 / changes-21 F7).
//
// Gate order per security.md #1: `requirePermission()` first, then the
// `@repo/contracts` parse, then the `@repo/core` service. Nothing here touches
// Prisma (architecture.md #2), and both writes audit inside core — the delete
// especially, because the audit row has to outlive the row it describes.
//
// **Both actions take `newsletter.manage`, not `.view`.** Unsubscribing and
// deleting are the same privilege: one stops the mail, the other erases the
// consent. Splitting them would suggest the erase is the milder of the two.
//
// **Nothing is revalidated here, and that is deliberate.** The subscriber list
// is read only by the admin screen, whose root layout is `force-dynamic`
// (architecture.md #6), so the next render already sees the write. The four
// public placements read the `newsletter` FLAG and a placement setting —
// never this table — so no public cache entry depends on a subscriber row.
// Calling `revalidateTag("settings:email")` here would invalidate the email
// settings of every reader to refresh one admin table.
import { adminAddSubscriberSchema, subscriberIdSchema } from "@repo/contracts";
import {
  adminAddSubscriber,
  adminResubscribe,
  adminUnsubscribe,
  deleteSubscriber,
  type AdminAddSubscriberResult,
  type AdminResubscribeResult,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";

export async function unsubscribeSubscriberAction(input: unknown): Promise<void> {
  const subject = await requirePermission("newsletter.manage");
  const { id } = subscriberIdSchema.parse(input);
  await adminUnsubscribe(subject, id);
}

export async function deleteSubscriberAction(input: unknown): Promise<void> {
  const subject = await requirePermission("newsletter.manage");
  const { id } = subscriberIdSchema.parse(input);
  await deleteSubscriber(subject, id);
}

/**
 * The undo of `unsubscribeSubscriberAction` (ADR-124). Same key, because it is
 * the same privilege pointed the other way. Whether it RESTORES or INVITES is
 * core's decision — it depends on who unsubscribed the address — and the
 * result tells the screen which message to show.
 */
export async function resubscribeSubscriberAction(input: unknown): Promise<AdminResubscribeResult> {
  const subject = await requirePermission("newsletter.manage");
  const { id } = subscriberIdSchema.parse(input);
  return adminResubscribe(subject, id);
}

/** "Add subscriber": invites the address through double opt-in (ADR-124). */
export async function addSubscriberAction(input: unknown): Promise<AdminAddSubscriberResult> {
  const subject = await requirePermission("newsletter.manage");
  const parsed = adminAddSubscriberSchema.parse(input);
  return adminAddSubscriber(subject, parsed);
}
