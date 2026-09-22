// Admin-screen read services (Module 09) — pages compose these instead of
// touching @repo/db (architecture.md #1/#2: core is the only code that
// touches db). Uncached: the admin surface is fully dynamic by design.
import { ContentStatus, db } from "@repo/db";
import { surfaceThemeKey, type ThemeSurface } from "@repo/contracts";
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
  icon: string;
  iconUrl: string | null;
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
      icon: true,
      iconUrl: true,
      handle: true,
      isActive: true,
      openInNewTab: true,
      showInHeader: true,
      showInFooter: true,
    },
  });
  return rows;
}

// `loadAdminDashboardCounts()` used to sit here: four ungated counts, exported
// and called by nothing since the windowed overview below replaced it. Deleted
// in changes-21 F8 rather than left as a convenience, because what it was
// convenient FOR is the mistake F8 fixes — an unpermissioned total, including
// a headcount, available to any caller that imported it.

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

/**
 * The selected window and the same-length one before it, both **aligned to
 * the start of a UTC day**, so "30 days" is 30 calendar days ending today.
 *
 * The alignment is what makes the series honest, and it was the bug here:
 * anchored at `now`, every daily bucket ran from the current time of day
 * while carrying a plain `yyyy-mm-dd` label, so a row published this morning
 * was plotted — and hovered — under YESTERDAY's date. A bucket labelled with
 * a day has to contain that day.
 *
 * `days - 1`, because the window includes today: the 7d view is today plus
 * the six days before it, not today plus seven. The bucket count in
 * `bucketSize` covers exactly this span, which is also what keeps a series
 * summing to the stat card printed beside it (both read this window).
 */
export function dashboardWindow(range: DashboardRange, now: Date) {
  const days = DASHBOARD_RANGE_DAYS[range];
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const periodStart = new Date(todayStart - (days - 1) * 86_400_000);
  const previousStart = new Date(periodStart.getTime() - days * 86_400_000);
  return { periodStart, previousStart };
}

export interface DashboardTrend {
  value: number;
  previousValue: number;
}

/**
 * The platform tiles, and the permission each one needs (changes-21 F8 §2.2
 * #9, extending ADR-085's rule to the tiles that predate it).
 *
 * **Every tile is gated, including the four that were not.** Until F8 any
 * STAFF member opening `/keystone` saw the user count, the employee count and
 * the published-article count — three numbers each of which has a screen
 * behind it that refuses them. A dashboard is not a lesser surface: an
 * aggregate over rows someone may not read is still a read of those rows,
 * and "it's only a total" is how a headcount leaks to a contractor with one
 * content permission.
 *
 * The keys are the ones the corresponding SCREEN requires, deliberately —
 * `analysis.view` for articles because that is what `/keystone/articles` takes.
 * (The feature-flag tile went with `/keystone/features`, ADR-144 §5: a count
 * linking to a deleted screen is the "Active menu items" mistake again.) A tile whose number an admin can see is a tile
 * whose screen they can open.
 */
const OVERVIEW_TILES = [
  { tile: "users", permission: "users.view" },
  { tile: "newUsers", permission: "users.view" },
  { tile: "articles", permission: "analysis.view" },
  { tile: "employees", permission: "employees.view" },
  { tile: "settings", permission: "settings.view" },
  // Replaces the "Active menu items" card, which linked to
  // `/keystone/navigation` — a screen ADR-038 hid, so the tile was a count of
  // something nobody could act on and a link to a 404-shaped destination.
  { tile: "deliveries", permission: "email.log.view" },
  // changes-43: the subscriber list is an audience (ADR-080 #7), so the tile
  // takes the key `/keystone/newsletter` itself requires.
  { tile: "newsletter", permission: "newsletter.view" },
] as const satisfies readonly { tile: string; permission: string }[];

export const DASHBOARD_OVERVIEW_TILES = OVERVIEW_TILES.map((entry) => entry.tile);
export type DashboardOverviewTile = (typeof OVERVIEW_TILES)[number]["tile"];

/** Every key the platform tiles read, deduped. */
export const DASHBOARD_OVERVIEW_PERMISSIONS: string[] = [
  ...new Set(OVERVIEW_TILES.map((entry) => entry.permission)),
];

/** The platform tiles a subject may see, given the keys it holds. */
export function visibleOverviewTiles(
  allows: (permission: string) => boolean,
): DashboardOverviewTile[] {
  return OVERVIEW_TILES.filter((entry) => allows(entry.permission)).map((entry) => entry.tile);
}

/**
 * Every field is OPTIONAL, and absent means "not queried" rather than zero.
 * A tile the viewer cannot see must not arrive as `0` — a zero is a fact
 * about the data, and rendering one for a hidden tile would state something
 * false rather than nothing.
 */
export interface AdminDashboardOverview {
  totalUsers?: DashboardTrend;
  newUsers?: DashboardTrend;
  publishedArticles?: DashboardTrend;
  activeEmployees?: DashboardTrend;
  settings?: number;
  emailDeliveries?: number;
  // ─── changes-43: the second figure each tile's ratio bar needs ───
  // Each rides on its tile's own gate and its own query, so a viewer who
  // cannot see the tile gets neither number. Every one is a real
  // denominator or companion count — a bar is never drawn against a guess.
  /** Non-deleted users whose status is ACTIVE (the `users` tile). */
  activeUsers?: number;
  /** Every non-deleted article, and those live now (the `articles` tile). */
  articleTotals?: { live: number; total: number };
  /** Every non-deleted employee record, any status (the `employees` tile). */
  totalEmployees?: number;
  /** Deliveries in the window that FAILED (the `deliveries` tile). */
  failedDeliveries?: number;
  /** Confirmed subscribers with a trend, plus unconfirmed sign-ups. */
  newsletterSubscribers?: DashboardTrend & { pending: number };
}

export async function loadAdminDashboardOverview(
  range: DashboardRange,
  allowed: readonly DashboardOverviewTile[],
): Promise<AdminDashboardOverview> {
  const now = new Date();
  const { periodStart, previousStart } = dashboardWindow(range, now);
  const shows = (tile: DashboardOverviewTile) => allowed.includes(tile);

  // A hidden tile runs NO query, the discipline `loadAdminContentStats`
  // already follows: it costs nothing and it leaks nothing, rather than
  // reading the rows and then declining to draw them.
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
    emailDeliveries,
    activeUsers,
    liveArticles,
    totalArticles,
    totalEmployees,
    failedDeliveries,
    subscribers,
    subscribersPrev,
    pendingSubscribers,
  ] = await Promise.all([
    shows("users") ? db.user.count({ where: { deletedAt: null, createdAt: { lt: now } } }) : null,
    shows("users")
      ? db.user.count({ where: { deletedAt: null, createdAt: { lt: periodStart } } })
      : null,
    shows("newUsers")
      ? db.user.count({ where: { deletedAt: null, createdAt: { gte: periodStart, lt: now } } })
      : null,
    shows("newUsers")
      ? db.user.count({
          where: { deletedAt: null, createdAt: { gte: previousStart, lt: periodStart } },
        })
      : null,
    shows("articles")
      ? db.article.count({
          where: {
            deletedAt: null,
            status: "PUBLISHED",
            publishedAt: { gte: periodStart, lt: now },
          },
        })
      : null,
    shows("articles")
      ? db.article.count({
          where: {
            deletedAt: null,
            status: "PUBLISHED",
            publishedAt: { gte: previousStart, lt: periodStart },
          },
        })
      : null,
    shows("employees")
      ? db.employee.count({ where: { status: "ACTIVE", deletedAt: null, createdAt: { lt: now } } })
      : null,
    shows("employees")
      ? db.employee.count({
          where: { status: "ACTIVE", deletedAt: null, createdAt: { lt: periodStart } },
        })
      : null,
    shows("settings") ? db.setting.count() : null,
    // The window, not all time: "how much mail went out lately" is the
    // question the card answers, and the log only keeps 90 days anyway
    // (ADR-078 #10).
    shows("deliveries")
      ? db.emailDelivery.count({ where: { createdAt: { gte: periodStart, lt: now } } })
      : null,
    shows("users") ? db.user.count({ where: { deletedAt: null, status: "ACTIVE" } }) : null,
    shows("articles")
      ? db.article.count({ where: { deletedAt: null, status: ContentStatus.PUBLISHED } })
      : null,
    shows("articles") ? db.article.count({ where: { deletedAt: null } }) : null,
    shows("employees") ? db.employee.count({ where: { deletedAt: null } }) : null,
    shows("deliveries")
      ? db.emailDelivery.count({
          where: { status: "FAILED", createdAt: { gte: periodStart, lt: now } },
        })
      : null,
    shows("newsletter") ? db.newsletterSubscriber.count({ where: { status: "ACTIVE" } }) : null,
    // Confirmed before the window opened and still subscribed — the same
    // "still here" approximation the employee trend makes.
    shows("newsletter")
      ? db.newsletterSubscriber.count({
          where: { status: "ACTIVE", confirmedAt: { lt: periodStart } },
        })
      : null,
    shows("newsletter") ? db.newsletterSubscriber.count({ where: { status: "PENDING" } }) : null,
  ]);

  return {
    ...(totalUsers !== null && totalUsersPrev !== null
      ? { totalUsers: { value: totalUsers, previousValue: totalUsersPrev } }
      : {}),
    ...(newUsers !== null && newUsersPrev !== null
      ? { newUsers: { value: newUsers, previousValue: newUsersPrev } }
      : {}),
    ...(publishedArticles !== null && publishedArticlesPrev !== null
      ? { publishedArticles: { value: publishedArticles, previousValue: publishedArticlesPrev } }
      : {}),
    ...(activeEmployees !== null && activeEmployeesPrev !== null
      ? { activeEmployees: { value: activeEmployees, previousValue: activeEmployeesPrev } }
      : {}),
    ...(settings !== null ? { settings } : {}),
    ...(emailDeliveries !== null ? { emailDeliveries } : {}),
    ...(activeUsers !== null ? { activeUsers } : {}),
    ...(liveArticles !== null && totalArticles !== null
      ? { articleTotals: { live: liveArticles, total: totalArticles } }
      : {}),
    ...(totalEmployees !== null ? { totalEmployees } : {}),
    ...(failedDeliveries !== null ? { failedDeliveries } : {}),
    ...(subscribers !== null && subscribersPrev !== null && pendingSubscribers !== null
      ? {
          newsletterSubscribers: {
            value: subscribers,
            previousValue: subscribersPrev,
            pending: pendingSubscribers,
          },
        }
      : {}),
  };
}

export interface DashboardSeriesPoint {
  date: string; // ISO yyyy-mm-dd, bucket start
  users: number;
  articles: number;
}

/**
 * Buckets by day (≤30-day ranges), week (90d) or month (1y) so the chart
 * stays legible.
 *
 * The count is DERIVED — `ceil(days / unitDays)` — rather than written down
 * beside the unit. The hand-written pair said 12 monthly buckets for a
 * 365-day window, which covers 360 days, so everything published in the last
 * five days was clamped into the final bucket and read under a label a month
 * stale. A count that cannot cover its own window is the kind of arithmetic
 * that should not be retyped.
 */
export function bucketSize(range: DashboardRange): { unitDays: number; buckets: number } {
  const days = DASHBOARD_RANGE_DAYS[range];
  const unitDays = range === "90d" ? 7 : range === "1y" ? 30 : 1;
  return { unitDays, buckets: Math.ceil(days / unitDays) };
}

/**
 * The growth curve, gated per SERIES (changes-21 F8 §2.2 #9).
 *
 * The chart plots two things — signups and publishes — and a viewer may be
 * entitled to one and not the other. Gating the whole chart would hide a
 * series someone may see; gating neither plots signups over time for anybody
 * with a content permission, which is a finer-grained leak than the total it
 * sits next to. So each line is asked for separately, and a line nobody may
 * see stays flat at zero because it was never read.
 */
export async function loadAdminDashboardSeries(
  range: DashboardRange,
  allowed: readonly DashboardOverviewTile[],
): Promise<DashboardSeriesPoint[]> {
  const now = new Date();
  const { periodStart } = dashboardWindow(range, now);
  const { unitDays, buckets } = bucketSize(range);

  const [users, articles] = await Promise.all([
    allowed.includes("users")
      ? db.user.findMany({
          where: { deletedAt: null, createdAt: { gte: periodStart, lte: now } },
          select: { createdAt: true },
        })
      : [],
    allowed.includes("articles")
      ? db.article.findMany({
          where: {
            deletedAt: null,
            status: "PUBLISHED",
            publishedAt: { gte: periodStart, lte: now },
          },
          select: { publishedAt: true },
        })
      : [],
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
/**
 * The palette the theme editor opens on, for ONE surface (changes-49,
 * ADR-148): its own `surface-<name>` row. Before the split there was one
 * active row for both; a database that has not been migrated yet still has
 * that row, and the editor opens on it — its first Save then creates the
 * surface's own row under the surface key.
 */
export async function loadActiveThemeTokens(
  surface: ThemeSurface = "web",
): Promise<RawThemeTokens> {
  const active =
    (await db.theme.findUnique({ where: { key: surfaceThemeKey(surface) } })) ??
    (await db.theme.findFirst({ where: { isActive: true } }));
  return {
    themeKey: surfaceThemeKey(surface),
    brand: (active?.brandColors as unknown as BrandColors) ?? DEFAULT_BRAND,
    light: (active?.lightSurface as unknown as SurfacePalette) ?? DEFAULT_LIGHT_SURFACE,
    dark: (active?.darkSurface as unknown as SurfacePalette) ?? DEFAULT_DARK_SURFACE,
    overrides:
      (active?.darkBrandOverrides as unknown as BrandOverrides) ?? DEFAULT_DARK_BRAND_OVERRIDES,
    layout: (active?.layoutTokens as unknown as LayoutTokens) ?? DEFAULT_LAYOUT,
  };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD — CONTENT LIBRARY (changes-26, ADR-085)
//
// The dashboard used to show one content type: articles, as a status donut
// and one stat card. Courses, lessons, quizzes, glossary terms and videos
// each got their own admin section over Modules 11 and 12 and none of them
// reached the front page, so the one screen that is supposed to say what the
// platform looks like described a fraction of it.
//
// Every number below is an aggregate over columns those modules already
// write — `status`, `publishedAt`, `deletedAt`. No counter column, no event
// log, no new table: the discipline `learn-analytics.ts` states for learner
// activity, applied to the library.
//
// Adding a seventh content type means ONE entry in `CONTENT_MODELS` — the
// stat cards, the pipeline, the series and the permission list all read that
// array, so there is no second place to forget.
// ─────────────────────────────────────────────────────────────

export const DASHBOARD_CONTENT_ENTITIES = [
  "courses",
  "lessons",
  "quizzes",
  "glossary",
  "videos",
  "articles",
] as const;
export type DashboardContentEntity = (typeof DASHBOARD_CONTENT_ENTITIES)[number];

/**
 * The workflow states, in the schema's own order — which IS pipeline order
 * (DRAFT → IN_REVIEW → SEO_REVIEW → APPROVED → SCHEDULED → PUBLISHED →
 * ARCHIVED).
 *
 * Derived from the Prisma enum rather than retyped, so an eighth state added
 * to the schema arrives here automatically and the dashboard's bucket guard
 * (`admin-dashboard-registries.test.ts`) fails until somebody says which bar
 * it belongs in. A hand-written copy would have silently dropped it and left
 * the bars no longer summing to `total`.
 */
export const DASHBOARD_CONTENT_STATUSES = Object.values(ContentStatus);
export type DashboardContentStatus = ContentStatus;

interface ContentModel {
  entity: DashboardContentEntity;
  /** The view key that lets a staff member see this type's numbers. */
  permission: string;
  groupByStatus: () => Promise<{ status: ContentStatus; _count: { _all: number } }[]>;
  countPublishedBetween: (gte: Date, lt: Date) => Promise<number>;
  publishedDatesSince: (gte: Date, lte: Date) => Promise<{ publishedAt: Date | null }[]>;
}

// Explicit entries rather than a delegate lookup: Prisma's model delegates
// have different generic types, so a `Record<string, delegate>` collapses to
// a union that neither `groupBy` nor `count` survives. Three closures per
// entity keep every call fully typed.
const CONTENT_MODELS: ContentModel[] = [
  {
    entity: "courses",
    permission: "courses.view",
    // The intermediate local is load-bearing: Prisma infers `groupBy`'s
    // generic from its ARGUMENT, and a contextual return type (this field's)
    // hijacks that inference and reports the argument as the error.
    groupByStatus: async () => {
      const rows = await db.course.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.course.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.course.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
  {
    entity: "lessons",
    permission: "lessons.view",
    groupByStatus: async () => {
      const rows = await db.lesson.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.lesson.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.lesson.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
  {
    // Quizzes publish on the `lessons.*` keys (ADR-058 #6 — the second
    // refusal to add a permission group), so they gate on the same key.
    entity: "quizzes",
    permission: "lessons.view",
    groupByStatus: async () => {
      const rows = await db.quiz.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.quiz.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.quiz.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
  {
    entity: "glossary",
    permission: "glossary.view",
    groupByStatus: async () => {
      const rows = await db.glossaryTerm.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.glossaryTerm.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.glossaryTerm.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
  {
    // Videos publish on `lessons.*` too (ADR-068, following the quizzes
    // precedent) — same key, deliberately.
    entity: "videos",
    permission: "lessons.view",
    groupByStatus: async () => {
      const rows = await db.videoTopic.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.videoTopic.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.videoTopic.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
  {
    entity: "articles",
    permission: "analysis.view",
    groupByStatus: async () => {
      const rows = await db.article.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true },
      });
      return rows;
    },
    countPublishedBetween: (gte, lt) =>
      db.article.count({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lt } },
      }),
    publishedDatesSince: (gte, lte) =>
      db.article.findMany({
        where: { deletedAt: null, status: ContentStatus.PUBLISHED, publishedAt: { gte, lte } },
        select: { publishedAt: true },
      }),
  },
];

/** The view keys the content blocks read, deduped — the dashboard's `canAny` list. */
export const DASHBOARD_CONTENT_PERMISSIONS: string[] = [
  ...new Set(CONTENT_MODELS.map((model) => model.permission)),
];

/** The content types a subject may see, given the keys it holds. */
export function visibleContentEntities(
  allows: (permission: string) => boolean,
): DashboardContentEntity[] {
  return CONTENT_MODELS.filter((model) => allows(model.permission)).map((model) => model.entity);
}

export interface ContentEntityStats {
  entity: DashboardContentEntity;
  /** Published right now, whenever that happened. */
  published: number;
  /** Everything not soft-deleted, at any status. */
  total: number;
  publishedInPeriod: number;
  publishedInPreviousPeriod: number;
  /** Every status in `DASHBOARD_CONTENT_STATUSES`, zeroes included, so the stacked bar keeps a stable segment order. */
  byStatus: Record<DashboardContentStatus, number>;
}

/**
 * Zero-fills every workflow state and sums the total.
 *
 * The zero-fill is what lets the pipeline bars keep a stable segment order
 * and the legend a stable length: a state nobody is using is a 0, not an
 * absent key that shifts every colour after it. Exported for its own test —
 * `total` must always equal the sum of `byStatus`, which is only true while
 * `DASHBOARD_CONTENT_STATUSES` covers the enum, and it covers the enum
 * because it IS the enum.
 */
export function foldContentStatusCounts(
  grouped: readonly { status: ContentStatus; _count: { _all: number } }[],
): { byStatus: Record<DashboardContentStatus, number>; total: number } {
  const byStatus = Object.fromEntries(
    DASHBOARD_CONTENT_STATUSES.map((status) => [status, 0]),
  ) as Record<DashboardContentStatus, number>;
  let total = 0;
  for (const row of grouped) {
    byStatus[row.status] += row._count._all;
    total += row._count._all;
  }
  return { byStatus, total };
}

/**
 * One row per content type: totals, the pipeline breakdown, and how much was
 * published inside the selected window versus the one before it.
 *
 * `entities` narrows the read to the types the caller may see — an omitted
 * type is never queried, rather than queried and hidden. A block that does
 * not render should not cost a round trip either.
 */
export async function loadAdminContentStats(
  range: DashboardRange,
  entities: readonly DashboardContentEntity[] = DASHBOARD_CONTENT_ENTITIES,
): Promise<ContentEntityStats[]> {
  const now = new Date();
  const { periodStart, previousStart } = dashboardWindow(range, now);
  const wanted = CONTENT_MODELS.filter((model) => entities.includes(model.entity));

  // `CONTENT_MODELS` order, which is `DASHBOARD_CONTENT_ENTITIES` order —
  // Promise.all preserves it, so the chart axis never reshuffles between
  // renders because one query came back first.
  return Promise.all(
    wanted.map(async (model) => {
      const [grouped, publishedInPeriod, publishedInPreviousPeriod] = await Promise.all([
        model.groupByStatus(),
        model.countPublishedBetween(periodStart, now),
        model.countPublishedBetween(previousStart, periodStart),
      ]);

      const { byStatus, total } = foldContentStatusCounts(grouped);
      return {
        entity: model.entity,
        published: byStatus[ContentStatus.PUBLISHED],
        total,
        publishedInPeriod,
        publishedInPreviousPeriod,
        byStatus,
      };
    }),
  );
}

export type ContentSeriesPoint = { date: string } & Record<DashboardContentEntity, number>;

/**
 * Publishing output over the window, bucketed the way the growth chart is —
 * one series per content type, so "what did we ship" is one stacked bar
 * rather than six screens.
 */
export async function loadAdminContentSeries(
  range: DashboardRange,
  entities: readonly DashboardContentEntity[] = DASHBOARD_CONTENT_ENTITIES,
): Promise<ContentSeriesPoint[]> {
  const now = new Date();
  const { periodStart } = dashboardWindow(range, now);
  const { unitDays, buckets } = bucketSize(range);
  const wanted = CONTENT_MODELS.filter((model) => entities.includes(model.entity));

  const series: ContentSeriesPoint[] = Array.from({ length: buckets }, (_, i) => {
    const bucketStart = new Date(periodStart.getTime() + i * unitDays * 86_400_000);
    const point = { date: bucketStart.toISOString().slice(0, 10) } as ContentSeriesPoint;
    // Every entity gets a key even when it was not read, so a chart series
    // for a type this subject cannot see plots as flat zero instead of NaN.
    for (const entity of DASHBOARD_CONTENT_ENTITIES) point[entity] = 0;
    return point;
  });

  const bucketIndex = (date: Date) => {
    const offsetDays = (date.getTime() - periodStart.getTime()) / 86_400_000;
    return Math.min(buckets - 1, Math.max(0, Math.floor(offsetDays / unitDays)));
  };

  await Promise.all(
    wanted.map(async (model) => {
      const rows = await model.publishedDatesSince(periodStart, now);
      for (const row of rows) {
        if (row.publishedAt) series[bucketIndex(row.publishedAt)]![model.entity] += 1;
      }
    }),
  );

  return series;
}
