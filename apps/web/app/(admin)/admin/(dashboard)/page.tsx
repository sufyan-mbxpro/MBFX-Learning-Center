import Link from "next/link";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@repo/auth";
import {
  loadAdminContentSeries,
  loadAdminContentStats,
  loadAdminDashboardOverview,
  loadAdminDashboardSeries,
  loadAdminRecentActivity,
  loadCourseAnalytics,
  loadLearnAnalyticsSummary,
  visibleContentEntities,
  visibleOverviewTiles,
  DASHBOARD_RANGES,
  type ContentEntityStats,
  type ContentSeriesPoint,
  type DashboardContentEntity,
  type DashboardRange,
  type LearnAnalyticsSummary,
} from "@repo/core";
import { can, getSubject } from "@repo/rbac";
import {
  Briefcase,
  GraduationCap,
  Layers,
  Mail,
  MailCheck,
  Newspaper,
  Settings as SettingsIcon,
  SlidersHorizontal,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@repo/ui/components/card";
import { MetaText, SectionTitle, SectionTitleCompact } from "@repo/ui/components/typography";
import { AdminPage } from "../_components/admin-page.tsx";
import { DashboardActivityFeed } from "../_components/dashboard-activity-feed.tsx";
import { DashboardGrowthChart } from "../_components/dashboard-charts.tsx";
import {
  DashboardOutputPanels,
  DashboardPipelineBars,
  DashboardTopCourses,
} from "../_components/dashboard-content-charts.tsx";
import { DashboardRangeSelect } from "../_components/dashboard-range-select.tsx";
import {
  ENTITY_HREFS,
  ENTITY_ICONS,
  ENTITY_LABEL_KEYS,
  PIPELINE_BUCKETS,
  PIPELINE_LABEL_KEYS,
  type PipelineBucketKey,
} from "../_lib/dashboard-content.ts";
import { DashboardStatCard } from "../_components/dashboard-stat-card.tsx";

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

  // The dashboard itself has no permission, but the blocks below do: content
  // counts, and especially draft and in-review counts, belong to the people
  // who can open those screens. A block the subject may not see is NOT
  // queried and then hidden — `visibleContentEntities` narrows the read, so
  // a hidden block costs nothing and leaks nothing (security.md #7's
  // instinct applied to an aggregate).
  const session = await auth();
  const subject = session?.user?.id ? await getSubject(session.user.id) : null;
  const contentEntities = visibleContentEntities((permission) => can(subject, permission));
  // The platform tiles are gated too, as of F8 (§2.2 #9). Until then any
  // STAFF member saw the user count, the employee headcount and the
  // published-article count — three aggregates whose own screens refuse
  // them. An aggregate over rows someone may not read is still a read.
  const overviewTiles = visibleOverviewTiles((permission) => can(subject, permission));
  const showLearning = can(subject, "analytics.view");
  // The activity feed IS the audit log, so it takes the audit key. It had
  // been the loudest of the ungated reads: every action, every actor name.
  const showActivity = can(subject, "audit.view");
  const showGrowth = overviewTiles.includes("users") || overviewTiles.includes("articles");

  const [t, locale, overview, series, recentActivity, contentStats, contentSeries, learning] =
    await Promise.all([
      getTranslations("admin"),
      getLocale(),
      loadAdminDashboardOverview(range, overviewTiles),
      showGrowth ? loadAdminDashboardSeries(range, overviewTiles) : [],
      showActivity ? loadAdminRecentActivity(8) : [],
      contentEntities.length > 0
        ? loadAdminContentStats(range, contentEntities)
        : Promise.resolve<ContentEntityStats[]>([]),
      contentEntities.length > 0
        ? loadAdminContentSeries(range, contentEntities)
        : Promise.resolve<ContentSeriesPoint[]>([]),
      showLearning
        ? Promise.all([loadLearnAnalyticsSummary(), loadCourseAnalytics()])
        : Promise.resolve(null),
    ]);

  const learnSummary: LearnAnalyticsSummary | null = learning?.[0] ?? null;
  const topCourses = (learning?.[1] ?? []).filter((row) => row.started > 0).slice(0, 5);

  const rangeLabels: Record<DashboardRange, string> = {
    "7d": t("dashboardRange7d"),
    "30d": t("dashboardRange30d"),
    "90d": t("dashboardRange90d"),
    "1y": t("dashboardRange1y"),
  };

  const entityLabels = Object.fromEntries(
    Object.entries(ENTITY_LABEL_KEYS).map(([entity, key]) => [entity, t(key)]),
  ) as Record<DashboardContentEntity, string>;

  const bucketLabels = Object.fromEntries(
    Object.entries(PIPELINE_LABEL_KEYS).map(([bucket, key]) => [bucket, t(key)]),
  ) as Record<PipelineBucketKey, string>;

  // A share of a REAL denominator, or nothing. A zero or unread denominator
  // gets no bar at all: an empty bar would claim "0%", which is a fact about
  // the data nobody measured (changes-43, the same rule as an absent tile).
  const percentFormat = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const share = (
    value: number,
    total: number | undefined,
    caption: (percent: string) => string,
  ): { percent: number; caption: string } | undefined => {
    if (total === undefined || total <= 0) return undefined;
    const fraction = Math.min(value / total, 1);
    return { percent: fraction * 100, caption: caption(percentFormat.format(fraction)) };
  };

  // Built by FILTER, not as a list of four: a tile the loader did not query is
  // absent from `overview` entirely, and a hidden tile must not fall back to
  // zero — a zero is a claim about the data, and it would be a false one.
  const statCards = [
    overview.totalUsers && {
      icon: Users,
      label: t("dashboardTotalUsers"),
      value: overview.totalUsers.value,
      previousValue: overview.totalUsers.previousValue,
      accent: "primary" as const,
      // `newUsers` takes the same key as this tile, so the companion figure
      // is gated with it rather than leaking through it.
      detail: overview.newUsers
        ? t("dashboardNewThisPeriod", { count: overview.newUsers.value })
        : undefined,
      ratio:
        overview.activeUsers === undefined
          ? undefined
          : share(overview.activeUsers, overview.totalUsers.value, (percent) =>
              t("dashboardShareActive", { percent }),
            ),
    },
    overview.newUsers && {
      icon: UserPlus,
      label: t("dashboardNewUsers"),
      value: overview.newUsers.value,
      previousValue: overview.newUsers.previousValue,
      accent: "success" as const,
      detail: undefined,
      ratio: share(overview.newUsers.value, overview.totalUsers?.value, (percent) =>
        t("dashboardShareOfUsers", { percent }),
      ),
    },
    overview.publishedArticles && {
      icon: Newspaper,
      label: t("dashboardPublishedArticles"),
      value: overview.publishedArticles.value,
      previousValue: overview.publishedArticles.previousValue,
      accent: "info" as const,
      detail: overview.articleTotals
        ? t("dashboardLiveOfTotal", {
            live: overview.articleTotals.live,
            total: overview.articleTotals.total,
          })
        : undefined,
      ratio: overview.articleTotals
        ? share(overview.articleTotals.live, overview.articleTotals.total, (percent) =>
            t("dashboardShareLive", { percent }),
          )
        : undefined,
    },
    overview.activeEmployees && {
      icon: Briefcase,
      label: t("dashboardActiveEmployees"),
      value: overview.activeEmployees.value,
      previousValue: overview.activeEmployees.previousValue,
      accent: "warning" as const,
      detail:
        overview.totalEmployees === undefined
          ? undefined
          : t("dashboardRecordsOfTotal", {
              active: overview.activeEmployees.value,
              total: overview.totalEmployees,
            }),
      ratio: share(overview.activeEmployees.value, overview.totalEmployees, (percent) =>
        t("dashboardShareActive", { percent }),
      ),
    },
    overview.newsletterSubscribers && {
      icon: MailCheck,
      label: t("dashboardNewsletterSubscribers"),
      value: overview.newsletterSubscribers.value,
      previousValue: overview.newsletterSubscribers.previousValue,
      accent: "primary" as const,
      detail: t("dashboardAwaitingConfirmation", {
        count: overview.newsletterSubscribers.pending,
      }),
      // Confirmed over everyone who signed up and has not left. Pending rows
      // are purged after seven days (ADR-080), so this reads as "how many of
      // the recent sign-ups finished", which is what a low number asks.
      ratio: share(
        overview.newsletterSubscribers.value,
        overview.newsletterSubscribers.value + overview.newsletterSubscribers.pending,
        (percent) => t("dashboardShareConfirmed", { percent }),
      ),
    },
  ].filter((card): card is NonNullable<typeof card> => Boolean(card));

  const learnCards = learnSummary
    ? [
        { label: t("dashboardLearnEnrolments"), value: learnSummary.enrolments },
        { label: t("dashboardLearnActiveLearners"), value: learnSummary.activeLearners },
        { label: t("dashboardLearnLessonsCompleted"), value: learnSummary.lessonsCompleted },
        { label: t("dashboardLearnQuizAttempts"), value: learnSummary.quizAttempts },
      ]
    : [];

  // Each of these is a COUNT plus a link to the screen it counts, so a viewer
  // who cannot open the screen gets neither. The third used to be "Active menu
  // items" linking to `/admin/navigation` — a screen ADR-038 hid, which made it
  // a number nobody could act on pointing at a destination nobody could reach.
  // Email deliveries takes its place: a real number, with a live screen behind
  // it, and the one an admin actually goes looking for ("did the mail go out").
  const secondaryCards = [
    overview.settings === undefined
      ? undefined
      : {
          href: "/admin/settings",
          icon: SettingsIcon,
          label: t("dashboardSettings"),
          value: overview.settings,
          detail: undefined,
        },
    overview.emailDeliveries === undefined
      ? undefined
      : {
          href: "/admin/settings/email/log",
          icon: Mail,
          label: t("dashboardEmailDeliveries"),
          value: overview.emailDeliveries,
          detail:
            overview.failedDeliveries === undefined
              ? undefined
              : t("dashboardDeliveriesFailed", { count: overview.failedDeliveries }),
        },
  ].filter((card): card is NonNullable<typeof card> => card !== undefined);

  return (
    <AdminPage
      title={t("dashboard")}
      description={t("dashboardWelcome")}
      actions={
        <DashboardRangeSelect value={range} label={t("dashboardRange")} labels={rangeLabels} />
      }
    >
      {statCards.length > 0 && (
        // `auto-fit`, because the number of tiles is decided by permissions:
        // five for a super admin, one for an employees-only viewer, and a
        // fixed column count left gaps or orphans for everyone in between.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-(--grid-stat-tiles)">
          {statCards.map((card) => (
            <DashboardStatCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              previousValue={card.previousValue}
              trendLabel={t("dashboardVsPrevious")}
              accent={card.accent}
              detail={card.detail}
              ratio={card.ratio}
              watermark
            />
          ))}
        </div>
      )}

      {/* ADR-075 hand-off: chart cards take the reference's compact
          icon title; the activity feed keeps the full card title. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {showGrowth && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <SectionTitleCompact>
                <TrendingUp aria-hidden />
                {t("dashboardGrowthChart")}
              </SectionTitleCompact>
              <CardDescription>{t("dashboardGrowthChartDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Per SERIES, not per card: a viewer entitled to one line and
                  not the other sees one line. A hidden series was never read,
                  so drawing it flat at zero would read as "no signups".*/}
              <DashboardGrowthChart
                data={series}
                usersLabel={t("dashboardUsersSeries")}
                articlesLabel={t("dashboardArticlesSeries")}
                showUsers={overviewTiles.includes("users")}
                showArticles={overviewTiles.includes("articles")}
                emptyTitle={t("dashboardChartEmpty")}
                emptyDescription={t("dashboardGrowthChartDescription")}
              />
            </CardContent>
          </Card>
        )}

        {/* Supersedes the article-only status donut: the same question, asked
            of every content type instead of one. */}
        {contentStats.length > 0 && (
          <Card>
            <CardHeader>
              <SectionTitleCompact>
                <SlidersHorizontal aria-hidden />
                {t("dashboardContentPipeline")}
              </SectionTitleCompact>
              <CardDescription>{t("dashboardContentPipelineDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardPipelineBars
                rows={contentStats}
                entityLabels={entityLabels}
                bucketLabels={bucketLabels}
                totalLabel={(count) => t("dashboardPipelineTotal", { count })}
                emptyTitle={t("dashboardChartEmpty")}
                emptyDescription={t("dashboardContentPipelineDescription")}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {contentStats.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <SectionTitle>{t("dashboardContentLibrary")}</SectionTitle>
            <CardDescription>{t("dashboardContentLibraryDescription")}</CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contentStats.map((row) => {
              const Icon = ENTITY_ICONS[row.entity];
              // The pipeline card's own folding, so this line and that bar
              // cannot tell an editor two different stories.
              const inBucket = (key: PipelineBucketKey) =>
                PIPELINE_BUCKETS.find((bucket) => bucket.key === key)!.statuses.reduce(
                  (sum: number, status) => sum + row.byStatus[status],
                  0,
                );
              return (
                <Link
                  key={row.entity}
                  href={ENTITY_HREFS[row.entity]}
                  className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <DashboardStatCard
                    icon={Icon}
                    label={entityLabels[row.entity]}
                    value={row.published}
                    previousValue={row.publishedInPreviousPeriod}
                    // The trend compares what was PUBLISHED in each window,
                    // while the figure is the live total — so the meta line
                    // names the window's own number rather than leaving the
                    // percentage to be read against the wrong denominator.
                    // A `note`, not a `trendLabel`: the previous period is 0
                    // on a young platform, which makes the percentage
                    // undefined, and this sentence has to survive that.
                    note={t("dashboardPublishedInPeriod", {
                      count: row.publishedInPeriod,
                    })}
                    detail={t("dashboardLibraryInProgress", {
                      draft: inBucket("draft"),
                      review: inBucket("review"),
                    })}
                    ratio={share(row.published, row.total, (percent) =>
                      t("dashboardLibraryShareLive", { percent, total: row.total }),
                    )}
                    watermark
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {contentSeries.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <SectionTitleCompact>
                <Layers aria-hidden />
                {t("dashboardPublishingOutput")}
              </SectionTitleCompact>
              <CardDescription>{t("dashboardPublishingOutputDescription")}</CardDescription>
            </CardHeader>
            {/* `flex-1`: the grid row is as tall as the learning card beside
                it, and the panels grow into that height instead of leaving
                the bottom half of this card empty (changes-43). */}
            <CardContent className="flex flex-1 flex-col">
              <DashboardOutputPanels
                series={contentSeries}
                entities={contentEntities}
                entityLabels={entityLabels}
                emptyLabel={t("dashboardNothingPublished")}
                peakLabel={(count) => t("dashboardPeakDay", { count })}
              />
            </CardContent>
          </Card>
        )}

        {learnSummary && (
          <Card>
            <CardHeader>
              <SectionTitleCompact>
                <GraduationCap aria-hidden />
                {t("dashboardLearningEngagement")}
              </SectionTitleCompact>
              <CardDescription>{t("dashboardLearningEngagementDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-4">
                {learnCards.map((card) => (
                  <div key={card.label} className="flex flex-col">
                    <dd className="text-lg font-semibold tabular-nums">
                      {card.value.toLocaleString()}
                    </dd>
                    <MetaText render={<dt />}>{card.label}</MetaText>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2 border-t pt-4">
                <MetaText render={<p />}>{t("dashboardTopCourses")}</MetaText>
                <DashboardTopCourses
                  rows={topCourses.map((row) => ({
                    courseId: row.courseId,
                    title: row.title,
                    started: row.started,
                    completed: row.completed,
                  }))}
                  startedLabel={t("dashboardCourseStarted")}
                  completedLabel={t("dashboardCourseCompleted")}
                  href="/admin/learn/progress"
                  emptyLabel={t("dashboardChartEmpty")}
                />
              </div>
              <Link
                href="/admin/learn/progress"
                className="text-sm font-medium text-primary-interactive hover:underline"
              >
                {t("dashboardViewLearnAnalytics")}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {(showActivity || secondaryCards.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {showActivity && (
            // The feed IS the audit log — actions, entity ids and actor
            // names — so it takes `audit.view` rather than riding on the
            // STAFF gate the way it did before F8.
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
                  entityLabel={(entity) => t("dashboardActivityEntity", { entity })}
                />
              </CardContent>
            </Card>
          )}

          {secondaryCards.length > 0 && (
            <div className="flex flex-col gap-4">
              {secondaryCards.map((card) => (
                // A whole-card link: the reference's interactive card is the
                // Card itself (`.card-hover`), not a second tile recipe.
                <Link
                  key={card.href}
                  href={card.href}
                  className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Card size="sm" className="relative isolate">
                    {/* The overview tiles' watermark, at this card's scale. */}
                    <card.icon
                      className="pointer-events-none absolute -end-2 -bottom-2 -z-10 size-16 stroke-1 text-primary opacity-15"
                      aria-hidden
                    />
                    <CardContent className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle">
                        <card.icon className="size-4 text-primary-interactive" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-lg font-semibold tabular-nums">
                            {card.value.toLocaleString()}
                          </span>
                          {card.detail && (
                            <MetaText render={<span />} className="tabular-nums">
                              {card.detail}
                            </MetaText>
                          )}
                        </span>
                        <MetaText render={<span />}>{card.label}</MetaText>
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminPage>
  );
}
