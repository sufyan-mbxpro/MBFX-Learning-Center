// Admin notifications (ADR-014). Presentation, not record — AuditLog is the
// record. Rows are addressed to ONE staff user and read strictly scoped to
// that user's own id; there is no cross-user read path and therefore no
// permission key. The interface text for a notification lives in the i18n
// catalogs keyed by `type`; the `title` column carries the human DETAIL
// (a role name, an actor name — data, not interface text) interpolated
// into the catalog string, so nothing user-facing is baked in English here.
import { db } from "@repo/db";

export interface NotificationRow {
  id: string;
  type: string;
  detail: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface RecordNotificationInput {
  userId: string;
  /** Catalog key under admin.notifications.* — e.g. "roleAssigned". */
  type: string;
  /** Interpolated data (role name, actor name); "" when the type needs none. */
  detail?: string;
  href?: string;
}

/**
 * Best-effort by contract (ADR-014): a failed notification write must never
 * fail the parent mutation it decorates.
 */
export async function recordNotification(input: RecordNotificationInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.detail ?? "",
        href: input.href,
      },
    });
  } catch {
    // Deliberately swallowed — see contract above.
  }
}

export async function listNotifications(userId: string, limit = 15): Promise<NotificationRow[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, href: true, readAt: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    detail: r.title,
    href: r.href,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Scoped updateMany — a foreign notificationId is a silent no-op, never a write. */
export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
