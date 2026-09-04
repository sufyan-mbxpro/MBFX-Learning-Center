"use server";

// Notification actions (ADR-014). Self-scoped: the service writes are
// keyed to the caller's OWN subject id — a foreign notification id is a
// silent no-op inside the service, so there is no cross-user path to
// guard with a permission key. STAFF is still verified against the DB.
import { z } from "zod";
import { markAllNotificationsRead, markNotificationRead } from "@repo/core";
import { requireStaffSubject } from "./staff-subject.ts";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const subject = await requireStaffSubject();
  await markNotificationRead(subject.id, z.string().min(1).parse(notificationId));
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const subject = await requireStaffSubject();
  await markAllNotificationsRead(subject.id);
}
