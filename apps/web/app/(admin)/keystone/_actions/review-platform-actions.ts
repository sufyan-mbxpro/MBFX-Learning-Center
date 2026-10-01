"use server";

// Settings → General → Reviews (ADR-169): which review platforms the
// "Share your experience" band shows, in what order, and where each sends a
// visitor.
import { saveReviewPlatforms } from "@repo/core";
import { reviewPlatformsSaveSchema } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

/**
 * `settings.update`, the key every other General tab saves under
 * (ADR-169 #6): a review link captures nothing and delivers nothing to a
 * user. `requirePermission` runs the STAFF gate first (security.md #3).
 */
export async function saveReviewPlatformsAction(input: unknown): Promise<void> {
  const subject = await requirePermission("settings.update");
  const parsed = reviewPlatformsSaveSchema.parse(input);
  await saveReviewPlatforms(subject.id, parsed);
}
