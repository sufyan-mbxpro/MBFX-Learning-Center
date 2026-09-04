// Admin-screen read services (Module 09) — pages compose these instead of
// touching @repo/db (architecture.md #1/#2: core is the only code that
// touches db). Uncached: the admin surface is fully dynamic by design.
import { db } from "@repo/db";
import {
  DEFAULT_BRAND,
  DEFAULT_DARK_BRAND_OVERRIDES,
  DEFAULT_DARK_SURFACE,
  DEFAULT_LAYOUT,
  DEFAULT_LIGHT_SURFACE,
  type BrandColors,
  type BrandOverrides,
  type LayoutTokens,
  type SurfacePalette,
} from "@repo/theme";

export interface AdminMenuItemRow {
  id: string;
  parentId: string | null;
  routeKey: string | null;
  url: string | null;
  sortOrder: number;
  isActive: boolean;
  requiresFeature: string | null;
  label: string | null;
}

export interface AdminMenu {
  id: string;
  key: string;
  name: string;
  items: AdminMenuItemRow[];
}

export async function loadAdminMenus(): Promise<AdminMenu[]> {
  const menus = await db.menu.findMany({
    orderBy: { key: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { translations: { where: { locale: "en" } } },
      },
    },
  });
  return menus.map((menu) => ({
    id: menu.id,
    key: menu.key,
    name: menu.name,
    items: menu.items.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      routeKey: item.routeKey,
      url: item.url,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      requiresFeature: item.requiresFeature,
      label: item.translations[0]?.label ?? null,
    })),
  }));
}

export interface AdminSocialLink {
  platform: string;
  label: string;
  url: string;
  handle: string | null;
  isActive: boolean;
  openInNewTab: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
}

export async function loadAdminSocialLinks(): Promise<AdminSocialLink[]> {
  const rows = await db.socialLink.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      platform: true,
      label: true,
      url: true,
      handle: true,
      isActive: true,
      openInNewTab: true,
      showInHeader: true,
      showInFooter: true,
    },
  });
  return rows;
}

export interface AdminDashboardCounts {
  users: number;
  settings: number;
  enabledFlags: number;
  activeMenuItems: number;
}

export async function loadAdminDashboardCounts(): Promise<AdminDashboardCounts> {
  const [users, settings, enabledFlags, activeMenuItems] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.setting.count(),
    db.featureFlag.count({ where: { isEnabled: true } }),
    db.menuItem.count({ where: { isActive: true } }),
  ]);
  return { users, settings, enabledFlags, activeMenuItems };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD OVERVIEW (Module 09) — stat cards + trend + time-series
// charts. Every number here is a real read against the DB, scoped to a
// selectable window; "previous" is the same-length window immediately
// before it, for the %-change indicators.
// ─────────────────────────────────────────────────────────────

export const DASHBOARD_RANGES = ["7d", "30d", "90d", "1y"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function dashboardWindow(range: DashboardRange, now: Date) {
  const days = DASHBOARD_RANGE_DAYS[range];
  const periodStart = new Date(now.getTime() - days * 86_400_000);
  const previousStart = new Date(periodStart.getTime() - days * 86_400_000);
  return { periodStart, previousStart };
}

export interface DashboardTrend {
  value: number;
  previousValue: number;
}

export interface AdminDashboardOverview {
  totalUsers: DashboardTrend;
  newUsers: DashboardTrend;
  publishedArticles: DashboardTrend;
  activeEmployees: DashboardTrend;
  settings: number;
  enabledFlags: number;
  activeMenuItems: number;
}

export async function loadAdminDashboardOverview(
  range: DashboardRange,
): Promise<AdminDashboardOverview> {
  const now = new Date();
  const { periodStart, previousStart } = dashboardWindow(range, now);

  const [
    totalUsers,
    totalUsersPrev,
    newUsers,
    newUsersPrev,
    publishedArticles,
    publishedArticlesPrev,
    activeEmployees,
    activeEmployeesPrev,
    settings,
    enabledFlags,
    activeMenuItems,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null, createdAt: { lt: now } } }),
    db.user.count({ where: { deletedAt: null, createdAt: { lt: periodStart } } }),
    db.user.count({
      where: { deletedAt: null, createdAt: { gte: periodStart, lt: now } },
    }),
    db.user.count({
      where: { deletedAt: null, createdAt: { gte: previousStart, lt: periodStart } },
    }),
    db.article.count({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        publishedAt: { gte: periodStart, lt: now },
      },
    }),
    db.article.count({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        publishedAt: { gte: previousStart, lt: periodStart },
      },
    }),
    db.employee.count({ where: { status: "ACTIVE", deletedAt: null, createdAt: { lt: now } } }),
    db.employee.count({
      where: { status: "ACTIVE", deletedAt: null, createdAt: { lt: periodStart } },
    }),
    db.setting.count(),
    db.featureFlag.count({ where: { isEnabled: true } }),
    db.menuItem.count({ where: { isActive: true } }),
  ]);

  return {
    totalUsers: { value: totalUsers, previousValue: totalUsersPrev },
    newUsers: { value: newUsers, previousValue: newUsersPrev },
    publishedArticles: { value: publishedArticles, previousValue: publishedArticlesPrev },
    activeEmployees: { value: activeEmployees, previousValue: activeEmployeesPrev },
    settings,
    enabledFlags,
    activeMenuItems,
  };
}

export interface DashboardSeriesPoint {
  date: string; // ISO yyyy-mm-dd, bucket start
  users: number;
  articles: number;
}

/** Buckets by day (≤30-day ranges) or by week (90d/1y) so the chart stays legible. */
function bucketSize(range: DashboardRange): { unitDays: number; buckets: number } {
  switch (range) {
    case "7d":
      return { unitDays: 1, buckets: 7 };
    case "30d":
      return { unitDays: 1, buckets: 30 };
    case "90d":
      return { unitDays: 7, buckets: 13 };
    case "1y":
      return { unitDays: 30, buckets: 12 };
  }
}

export async function loadAdminDashboardSeries(
  range: DashboardRange,
): Promise<DashboardSeriesPoint[]> {
  const now = new Date();
  const { periodStart } = dashboardWindow(range, now);
  const { unitDays, buckets } = bucketSize(range);

  const [users, articles] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null, createdAt: { gte: periodStart, lte: now } },
      select: { createdAt: true },
    }),
    db.article.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        publishedAt: { gte: periodStart, lte: now },
      },
      select: { publishedAt: true },
    }),
  ]);

  const series: DashboardSeriesPoint[] = Array.from({ length: buckets }, (_, i) => {
    const bucketStart = new Date(periodStart.getTime() + i * unitDays * 86_400_000);
    return { date: bucketStart.toISOString().slice(0, 10), users: 0, articles: 0 };
  });

  const bucketIndex = (date: Date) => {
    const offsetDays = (date.getTime() - periodStart.getTime()) / 86_400_000;
    return Math.min(buckets - 1, Math.max(0, Math.floor(offsetDays / unitDays)));
  };

  for (const user of users) series[bucketIndex(user.createdAt)]!.users += 1;
  for (const article of articles) {
    if (article.publishedAt) series[bucketIndex(article.publishedAt)]!.articles += 1;
  }

  return series;
}

export interface ArticleStatusBreakdown {
  status: string;
  count: number;
}

export async function loadAdminArticleStatusBreakdown(): Promise<ArticleStatusBreakdown[]> {
  const rows = await db.article.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  return rows
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: Date;
}

export async function loadAdminRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorName: row.user?.name ?? null,
    actorEmail: row.user?.email ?? null,
    createdAt: row.createdAt,
  }));
}

export interface RawThemeTokens {
  themeKey: string;
  brand: BrandColors;
  light: SurfacePalette;
  dark: SurfacePalette;
  overrides: BrandOverrides;
  layout: LayoutTokens;
}

/** The theme editor's initial state: the ACTIVE row's raw token JSON (not the compiled CSS), defaults when none is active. */
export async function loadActiveThemeTokens(): Promise<RawThemeTokens> {
  const active = await db.theme.findFirst({ where: { isActive: true } });
  return {
    themeKey: active?.key ?? "mbx-pro-default",
    brand: (active?.brandColors as unknown as BrandColors) ?? DEFAULT_BRAND,
    light: (active?.lightSurface as unknown as SurfacePalette) ?? DEFAULT_LIGHT_SURFACE,
    dark: (active?.darkSurface as unknown as SurfacePalette) ?? DEFAULT_DARK_SURFACE,
    overrides:
      (active?.darkBrandOverrides as unknown as BrandOverrides) ?? DEFAULT_DARK_BRAND_OVERRIDES,
    layout: (active?.layoutTokens as unknown as LayoutTokens) ?? DEFAULT_LAYOUT,
  };
}
