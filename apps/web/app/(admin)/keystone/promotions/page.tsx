import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getPromotionTotals, listPromotions } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { formatDateTime } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { AdminPage } from "../_components/admin-page.tsx";
import { HeaderActions } from "../_components/header-actions.tsx";
import { PromotionsTable, type PromotionRow } from "./promotions-table.tsx";

// Promotions (ADR-167, changes-52 P3). Read gate here; every write re-gates in
// its own action (security.md #1).
//
// The trash loads with the live set and the table hides it until its status
// filter asks for it — the videos list's shape (changes-49).
export default async function PromotionsPage() {
  const subject = await requirePermission("promotions.view");
  const [t, live, trashed] = await Promise.all([
    getTranslations("admin"),
    listPromotions(),
    listPromotions({ deleted: true }),
  ]);
  // ADR-170: approximate all-time views and clicks, one grouped read for the list.
  const totals = await getPromotionTotals([...live, ...trashed].map((row) => row.id));

  const rows: PromotionRow[] = [...live, ...trashed].map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    phase: row.phase,
    // Formatted here, like every admin table: the one date format (@repo/utils)
    // in one runtime, so the server render and the hydrated table agree.
    windowLabel: `${formatDateTime(row.startsAt)} – ${formatDateTime(row.endsAt)}`,
    startsAtSort: row.startsAt.getTime(),
    placements: row.placements,
    showAsPopup: row.showAsPopup,
    showInBand: row.showInBand,
    showAsBar: row.showAsBar,
    barPosition: row.barPosition,
    priority: row.priority,
    targetPublic: row.targetPublic,
    locales: row.locales,
    deleted: row.deletedAt !== null,
    updatedAtSort: row.updatedAt.getTime(),
    views: totals.get(row.id)?.impressions ?? 0,
    clicks: totals.get(row.id)?.clicks ?? 0,
  }));

  return (
    <AdminPage title={t("nav.promotions")} description={t("pageDesc.promotions")}>
      {can(subject, "promotions.create") && (
        <HeaderActions>
          <Button render={<Link href="/keystone/promotions/new" />}>
            <Plus aria-hidden data-icon="inline-start" />
            {t("promotions.create")}
          </Button>
        </HeaderActions>
      )}
      <PromotionsTable
        rows={rows}
        canCreate={can(subject, "promotions.create")}
        canDelete={can(subject, "promotions.delete")}
      />
    </AdminPage>
  );
}
