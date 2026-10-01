import { getTranslations } from "next-intl/server";
import { listAnnouncements } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { formatDateTime } from "@repo/utils";
import { AdminPage } from "../_components/admin-page.tsx";
import { NewEmailMenu } from "./_components/new-email-menu.tsx";
import { AnnouncementsTable, type AnnouncementRow } from "./announcements-table.tsx";

// Announcements (ADR-171, changes-54 N6). Read gate here; every write re-gates
// in its own action (security.md #1). Under People, after Newsletter: an
// announcement is sent TO an audience (ADR-083's page-shaped groups).
export default async function AnnouncementsPage() {
  const subject = await requirePermission("announcements.view");
  const [t, rows] = await Promise.all([getTranslations("admin"), listAnnouncements(subject)]);

  const tableRows: AnnouncementRow[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    targetTitle: row.targetTitle,
    status: row.status,
    waitingForTarget: row.waitingForTarget,
    audienceKeys: row.audienceKeys,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    createdByName: row.createdByName,
    // Formatted here, like every admin table: one date format, one runtime.
    dateLabel: formatDateTime(row.finishedAt ?? row.scheduledFor ?? row.createdAt),
    dateSort: (row.finishedAt ?? row.scheduledFor ?? row.createdAt).getTime(),
  }));

  return (
    <AdminPage
      title={t("nav.announcements")}
      description={t("pageDesc.announcements")}
      actions={can(subject, "announcements.create") ? <NewEmailMenu /> : undefined}
    >
      <AnnouncementsTable rows={tableRows} canCreate={can(subject, "announcements.create")} />
    </AdminPage>
  );
}
