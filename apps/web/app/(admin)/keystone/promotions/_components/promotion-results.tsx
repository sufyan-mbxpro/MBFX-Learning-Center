// A promotion's Results (ADR-170, changes-52 P7): approximate views, clicks
// and dismissals, all-time per surface and for the last 30 UTC days.
//
// A server component under the editor, read under `promotions.view` like the
// rest of the page (ADR-170 #5). Every figure says it is approximate, because
// it is: one count per network per day, and nothing counted without scripts
// (ADR-170 #4). A ratio is drawn only against a real denominator (changes-43).
import { getTranslations } from "next-intl/server";
import { BarChart3, Eye, MousePointerClick, XCircle } from "lucide-react";
import { promotionClickRate } from "@repo/contracts";
import type { PromotionStats } from "@repo/core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { formatDate } from "@repo/utils";
import { DashboardStatCard } from "../../_components/dashboard-stat-card.tsx";
import { EditorSection } from "../../_components/editor/editor-section.tsx";

export const RESULTS_DAYS = 30;

const n = (value: number) => value.toLocaleString("en");

export async function PromotionResults({ stats }: { stats: PromotionStats }) {
  const t = await getTranslations("admin.promotions.results");
  const { total, popup, band, bar } = stats;
  const clickRate = promotionClickRate(total.impressions, total.clicks);
  // Only the popup and the banner can be closed (ADR-173 #6), so the rate is
  // against their views alone — the band's would dilute it.
  const closable = popup.impressions + bar.impressions;
  const dismissals = popup.dismissals + bar.dismissals;
  const dismissRate = promotionClickRate(closable, dismissals);

  return (
    <EditorSection title={t("title")} description={t("description")} icon={BarChart3} accent="info">
      {total.impressions === 0 && total.clicks === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DashboardStatCard
              icon={Eye}
              label={t("views")}
              value={total.impressions}
              detail={t("viewsDetail", {
                popup: n(popup.impressions),
                band: n(band.impressions),
                bar: n(bar.impressions),
              })}
            />
            <DashboardStatCard
              icon={MousePointerClick}
              label={t("clicks")}
              value={total.clicks}
              accent="success"
              {...(clickRate === null
                ? {}
                : { ratio: { percent: clickRate, caption: t("clickRate", { rate: clickRate }) } })}
            />
            <DashboardStatCard
              icon={XCircle}
              label={t("dismissals")}
              value={dismissals}
              accent="warning"
              {...(dismissRate === null
                ? {}
                : {
                    ratio: {
                      percent: dismissRate,
                      caption: t("dismissRate", { rate: dismissRate }),
                    },
                  })}
            />
          </div>

          {stats.daily.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-medium">{t("recent", { days: RESULTS_DAYS })}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columnDay")}</TableHead>
                    <TableHead className="text-end">{t("columnPopupViews")}</TableHead>
                    <TableHead className="text-end">{t("columnPopupClicks")}</TableHead>
                    <TableHead className="text-end">{t("columnDismissals")}</TableHead>
                    <TableHead className="text-end">{t("columnBandViews")}</TableHead>
                    <TableHead className="text-end">{t("columnBandClicks")}</TableHead>
                    <TableHead className="text-end">{t("columnBarViews")}</TableHead>
                    <TableHead className="text-end">{t("columnBarClicks")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.daily.map((row) => (
                    <TableRow key={row.day}>
                      {/* Midday UTC, so the UTC day prints as itself in any zone the server runs in. */}
                      <TableCell>{formatDate(`${row.day}T12:00:00Z`)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {n(row.popup.impressions)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{n(row.popup.clicks)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {n(row.popup.dismissals + row.bar.dismissals)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {n(row.band.impressions)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{n(row.band.clicks)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {n(row.bar.impressions)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{n(row.bar.clicks)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </EditorSection>
  );
}
