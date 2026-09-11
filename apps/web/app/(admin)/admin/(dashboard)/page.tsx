import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import {
  loadAdminArticleStatusBreakdown,
  loadAdminDashboardOverview,
  loadAdminDashboardSeries,
  loadAdminRecentActivity,
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@repo/core";
import {
  Briefcase,
  ListTree,
  Newspaper,
  PieChart,
  Settings as SettingsIcon,
  ToggleRight,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@repo/ui/components/card";
import { MetaText, SectionTitle, SectionTitleCompact } from "@repo/ui/components/typography";
import { AdminPage } from "../_components/admin-page.tsx";
import { DashboardActivityFeed } from "../_components/dashboard-activity-feed.tsx";
import {
  DashboardGrowthChart,
  DashboardStatusChart,
  DashboardStatusLegend,
} from "../_components/dashboard-charts.tsx";
import { DashboardRangeSelect } from "../_components/dashboard-range-select.tsx";
import { DashboardStatCard } from "../_components/dashboard-stat-card.tsx";

const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: "statusDraft",
  IN_REVIEW: "statusInReview",
  SCHEDULED: "statusScheduled",
  PUBLISHED: "statusPublished",
  ARCHIVED: "statusArchived",
};

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  // Every other admin page starts with requirePermission() (a
  // request-scoped read, which marks the render dynamic). The dashboard
  // has no page-level permission — the layout's STAFF gate covers it — so
  // Cache Components needs the dynamic marker stated explicitly before
  // the uncached DB reads.
  await connection();

  const params = await searchParams;
  const rangeParam = typeof params.range === "string" ? params.range : "";
  const range: DashboardRange = (DASHBOARD_RANGES as readonly string[]).includes(rangeParam)
    ? (rangeParam as DashboardRange)
    : "30d";

  const [t, locale, overview, series, statusBreakdown, recentActivity] = await Promise.all([
    getTranslations("admin"),
    getLocale(),
    loadAdminDashboardOverview(range),
    loadAdminDashboardSeries(range),
    loadAdminArticleStatusBreakdown(),
    loadAdminRecentActivity(8),
  ]);

  const rangeLabels: Record<DashboardRange, string> = {
    "7d": t("dashboardRange7d"),
    "30d": t("dashboardRange30d"),
    "90d": t("dashboardRange90d"),
    "1y": t("dashboardRange1y"),
  };

  const statCards = [
    {
      icon: Users,
      label: t("dashboardTotalUsers"),
      value: overview.totalUsers.value,
      previousValue: overview.totalUsers.previousValue,
      accent: "primary" as const,
    },
    {
      icon: UserPlus,
      label: t("dashboardNewUsers"),
      value: overview.newUsers.value,
      previousValue: overview.newUsers.previousValue,
      accent: "success" as const,
    },
    {
      icon: Newspaper,
      label: t("dashboardPublishedArticles"),
      value: overview.publishedArticles.value,
      previousValue: overview.publishedArticles.previousValue,
      accent: "info" as const,
    },
    {
      icon: Briefcase,
      label: t("dashboardActiveEmployees"),
      value: overview.activeEmployees.value,
      previousValue: overview.activeEmployees.previousValue,
      accent: "warning" as const,
    },
  ];

  const secondaryCards = [
    {
      href: "/admin/features",
      icon: ToggleRight,
      label: t("dashboardFeatureFlags"),
      value: overview.enabledFlags,
    },
    {
      href: "/admin/settings",
      icon: SettingsIcon,
      label: t("dashboardSettings"),
      value: overview.settings,
    },
    {
      href: "/admin/navigation",
      icon: ListTree,
      label: t("dashboardActiveMenuItems"),
      value: overview.activeMenuItems,
    },
  ];

  const statusData = statusBreakdown.map((row) => ({
    status: row.status,
    count: row.count,
    label: STATUS_LABEL_KEYS[row.status] ? t(STATUS_LABEL_KEYS[row.status]!) : row.status,
  }));

  return (
    <AdminPage
      title={t("dashboard")}
      description={t("dashboardWelcome")}
      actions={
        <DashboardRangeSelect value={range} label={t("dashboardRange")} labels={rangeLabels} />
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <DashboardStatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            previousValue={card.previousValue}
            trendLabel={t("dashboardVsPrevious")}
            accent={card.accent}
          />
        ))}
      </div>

      {/* ADR-075 hand-off: chart cards take the reference's compact
          icon title; the activity feed keeps the full card title. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitleCompact>
              <TrendingUp aria-hidden />
              {t("dashboardGrowthChart")}
            </SectionTitleCompact>
            <CardDescription>{t("dashboardGrowthChartDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardGrowthChart
              data={series}
              usersLabel={t("dashboardUsersSeries")}
              articlesLabel={t("dashboardArticlesSeries")}
              emptyTitle={t("dashboardChartEmpty")}
              emptyDescription={t("dashboardGrowthChartDescription")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitleCompact>
              <PieChart aria-hidden />
              {t("dashboardArticleStatus")}
            </SectionTitleCompact>
            <CardDescription>{t("dashboardArticleStatusDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DashboardStatusChart
              data={statusData}
              emptyTitle={t("dashboardChartEmpty")}
              emptyDescription={t("dashboardArticleStatusDescription")}
            />
            {statusData.length > 0 && <DashboardStatusLegend data={statusData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle>{t("dashboardRecentActivity")}</SectionTitle>
            <CardDescription>{t("dashboardRecentActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardActivityFeed
              items={recentActivity}
              locale={locale}
              emptyLabel={t("dashboardActivityEmpty")}
              systemLabel={t("dashboardSystemUser")}
              byLabel={t("dashboardActivityBy")}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {secondaryCards.map((card) => (
            // A whole-card link: the reference's interactive card is the
            // Card itself (`.card-hover`), not a second tile recipe.
            <Link
              key={card.href}
              href={card.href}
              className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <card.icon className="size-4 shrink-0 text-primary-interactive" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold tabular-nums">
                      {card.value.toLocaleString()}
                    </span>
                    <MetaText render={<span />}>{card.label}</MetaText>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
