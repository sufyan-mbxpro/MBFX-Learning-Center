// Announcement status → badge tone (ADR-171). The WORDS are the catalog's
// (`admin.announcements.statuses.*`); this only says which tone each carries,
// so the list and the detail page cannot disagree.
import type { AnnouncementStatusValue } from "@repo/contracts";
import type { StatusTone } from "../../_components/status-badge.tsx";

/** "Waiting for course" is a SCHEDULED campaign whose course is not live yet (D5). */
export type AnnouncementDisplayStatus = AnnouncementStatusValue | "WAITING";

export const ANNOUNCEMENT_STATUS_TONE: Record<AnnouncementDisplayStatus, StatusTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  WAITING: "info",
  SENDING: "warning",
  SENT: "success",
  CANCELLED: "neutral",
};

export function displayStatus(
  status: AnnouncementStatusValue,
  waitingForTarget: boolean,
): AnnouncementDisplayStatus {
  return status === "SCHEDULED" && waitingForTarget ? "WAITING" : status;
}

/** How far a campaign has got: every row that is no longer waiting. */
export function progressPercent(counts: {
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}): number {
  if (counts.recipientCount === 0) return 0;
  const done = counts.sentCount + counts.failedCount + counts.skippedCount;
  return Math.min(100, Math.round((done / counts.recipientCount) * 100));
}
