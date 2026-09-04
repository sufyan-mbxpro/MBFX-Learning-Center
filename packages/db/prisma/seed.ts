// packages/db/prisma/seed.ts
//
// Idempotent. Every write is an upsert keyed on a stable business key, so
// running this against an existing database repairs drift instead of
// duplicating rows or clobbering admin edits.
//
//   pnpm db:seed

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../src/generated/client/client.ts";
import defaultThemeTokens from "./default-theme-tokens.json" with { type: "json" };

// ─────────────────────────────────────────────────────────────
// 1. PERMISSIONS
// Flat `resource.action` keys. No wildcards — a wildcard makes it ambiguous
// whether "content.*" includes "content.delete", and that ambiguity becomes
// a security incident eventually.
// ─────────────────────────────────────────────────────────────

const PERMISSIONS = [
  // Content
  ["content", "lessons.view", "View lessons"],
  ["content", "lessons.create", "Create lessons"],
  ["content", "lessons.update", "Edit lessons"],
  ["content", "lessons.delete", "Delete lessons"],
  ["content", "lessons.publish", "Publish lessons"],
  ["content", "courses.view", "View courses"],
  ["content", "courses.create", "Create courses"],
  ["content", "courses.update", "Edit courses"],
  ["content", "courses.delete", "Delete courses"],
  ["content", "courses.publish", "Publish courses"],
  ["content", "glossary.view", "View glossary"],
  ["content", "glossary.create", "Create glossary terms"],
  ["content", "glossary.update", "Edit glossary terms"],
  ["content", "glossary.delete", "Delete glossary terms"],
  ["content", "glossary.publish", "Publish glossary terms"],
  ["content", "analysis.view", "View analysis"],
  ["content", "analysis.create", "Create analysis"],
  ["content", "analysis.update", "Edit analysis"],
  ["content", "analysis.delete", "Delete analysis"],
  ["content", "analysis.publish", "Publish analysis"],
  ["content", "news.manage", "Manage news"],
  ["content", "media.upload", "Upload media"],
  ["content", "media.delete", "Delete media"],
  ["content", "comments.moderate", "Moderate comments"],

  // Translations
  ["translations", "translations.view", "View translations"],
  ["translations", "translations.update", "Edit translations"],
  ["translations", "translations.approve", "Approve translations"],
  ["translations", "locales.manage", "Manage locales"],

  // SEO
  ["seo", "seo.update", "Edit SEO fields"],
  ["seo", "redirects.manage", "Manage redirects"],
  ["seo", "sitemaps.manage", "Manage sitemaps"],

  // Market data
  ["market", "market.view", "View market data config"],
  ["market", "market.providers.manage", "Manage data providers"],
  ["market", "market.instruments.manage", "Manage instruments"],
  ["market", "calendar.manage", "Manage economic calendar"],

  // Users
  ["users", "users.view", "View users"],
  ["users", "users.create", "Create users"],
  ["users", "users.update", "Edit users"],
  ["users", "users.delete", "Delete users"],
  ["users", "users.impersonate", "Impersonate users"],
  ["users", "users.password.reset", "Reset user passwords"],
  ["users", "roles.view", "View roles"],
  ["users", "roles.manage", "Create and edit roles"],
  ["users", "permissions.assign", "Assign permissions"],

  // Employees
  ["employees", "employees.view", "View employees"],
  ["employees", "employees.create", "Add employees"],
  ["employees", "employees.update", "Edit employees"],
  ["employees", "employees.delete", "Remove employees"],
  ["employees", "departments.manage", "Manage departments"],

  // Settings
  ["settings", "settings.view", "View settings"],
  ["settings", "settings.update", "Edit settings"],
  ["settings", "theme.update", "Edit theme and branding"],
  ["settings", "navigation.manage", "Manage navigation"],
  ["settings", "features.manage", "Toggle features"],
  ["settings", "social.manage", "Manage social links"],
  ["settings", "integrations.manage", "Manage integrations"],

  // System
  ["system", "audit.view", "View audit logs"],
  ["system", "analytics.view", "View analytics"],
  ["system", "system.maintenance", "Run maintenance tasks"],
] as const;

// ─────────────────────────────────────────────────────────────
// 2. ROLES
// `level` guards privilege escalation: nobody may assign a role at or above
// their own level. Without it, an Editor with roles.manage can make
// themselves Super Admin.
// ─────────────────────────────────────────────────────────────

const ALL = "*"; // sentinel, expanded below

const ROLES: Array<{
  key: string;
  name: string;
  level: number;
  description: string;
  permissions: string[] | typeof ALL;
}> = [
  {
    key: "super_admin",
    name: "Super Admin",
    level: 100,
    description: "Unrestricted access, including roles and permissions.",
    permissions: ALL,
  },
  {
    key: "admin",
    name: "Admin",
    level: 90,
    description: "Full access except editing roles and permissions.",
    permissions: PERMISSIONS.map(([, key]) => key).filter(
      (k) => !["roles.manage", "permissions.assign", "users.impersonate"].includes(k),
    ),
  },
  {
    key: "content_manager",
    name: "Content Manager",
    level: 60,
    description: "Owns the full content lifecycle including publishing.",
    permissions: [
      ...PERMISSIONS.filter(([g]) => g === "content").map(([, k]) => k),
      "translations.view",
      "translations.update",
      "translations.approve",
      "seo.update",
      "analytics.view",
    ],
  },
  {
    key: "editor",
    name: "Editor",
    level: 50,
    description: "Edits and publishes content. Cannot delete.",
    permissions: [
      "lessons.view",
      "lessons.create",
      "lessons.update",
      "lessons.publish",
      "courses.view",
      "courses.update",
      "courses.publish",
      "glossary.view",
      "glossary.create",
      "glossary.update",
      "glossary.publish",
      "analysis.view",
      "analysis.update",
      "analysis.publish",
      "media.upload",
      "seo.update",
      "translations.view",
      "translations.update",
    ],
  },
  {
    key: "author",
    name: "Author",
    level: 30,
    description: "Writes drafts. Cannot publish.",
    permissions: [
      "lessons.view",
      "lessons.create",
      "lessons.update",
      "courses.view",
      "glossary.view",
      "glossary.create",
      "glossary.update",
      "analysis.view",
      "analysis.create",
      "analysis.update",
      "media.upload",
    ],
  },
  {
    key: "seo_manager",
    name: "SEO Manager",
    level: 50,
    description: "Owns SEO metadata, redirects, and sitemaps site-wide.",
    permissions: [
      "lessons.view",
      "courses.view",
      "glossary.view",
      "analysis.view",
      "seo.update",
      "redirects.manage",
      "sitemaps.manage",
      "analytics.view",
    ],
  },
  {
    key: "market_data_manager",
    name: "Market Data Manager",
    level: 50,
    description: "Configures data providers, instruments, and the calendar.",
    permissions: [
      "market.view",
      "market.providers.manage",
      "market.instruments.manage",
      "calendar.manage",
      "settings.view",
      "integrations.manage",
    ],
  },
  {
    key: "analyst",
    name: "Analyst",
    level: 40,
    description: "Publishes market analysis only.",
    permissions: [
      "analysis.view",
      "analysis.create",
      "analysis.update",
      "analysis.publish",
      "market.view",
      "media.upload",
    ],
  },
  {
    key: "moderator",
    name: "Moderator",
    level: 30,
    description: "Moderates comments and community content.",
    permissions: ["comments.moderate", "users.view"],
  },
  {
    key: "support",
    name: "Support",
    level: 20,
    description: "Reads user records and resets passwords.",
    permissions: ["users.view", "users.password.reset", "employees.view"],
  },
  {
    key: "read_only",
    name: "Read Only",
    level: 10,
    description: "Views the admin without changing anything.",
    permissions: PERMISSIONS.map(([, k]) => k).filter((k) => k.endsWith(".view")),
  },
];

// ─────────────────────────────────────────────────────────────
// 3. SOCIAL LINKS — MBX Pro official accounts
// ─────────────────────────────────────────────────────────────

const SOCIAL_LINKS = [
  {
    platform: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/mbxproofficial",
    icon: "instagram",
    handle: "@mbxproofficial",
    sortOrder: 1,
  },
  {
    platform: "facebook",
    label: "Facebook",
    url: "https://www.facebook.com/mbxproofficial/",
    icon: "facebook",
    handle: "mbxproofficial",
    sortOrder: 2,
  },
  {
    platform: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@MBXProofficial",
    icon: "youtube",
    handle: "@MBXProofficial",
    sortOrder: 3,
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/mbxpro",
    icon: "linkedin",
    handle: "mbxpro",
    sortOrder: 4,
  },
  {
    platform: "x",
    label: "X",
    url: "https://x.com/MBXProOfficial",
    icon: "twitter",
    handle: "@MBXProOfficial",
    sortOrder: 5,
  },
];

// ─────────────────────────────────────────────────────────────
// 4. SETTINGS
// ─────────────────────────────────────────────────────────────

const SETTINGS = [
  // General
  ["general", "site.name", "MBX Pro", "STRING", "Site name", true],
  ["general", "site.tagline", "Learn to trade the markets", "STRING", "Tagline", true],
  [
    "general",
    "site.description",
    "Free forex and trading education, market tools, and analysis.",
    "TEXT",
    "Site description",
    true,
  ],
  ["general", "site.contactEmail", "hello@mbxpro.com", "STRING", "Contact email", true],
  ["general", "site.supportEmail", "support@mbxpro.com", "STRING", "Support email", false],
  ["general", "site.defaultLocale", "en", "STRING", "Default language", true],
  ["general", "site.defaultTimezone", "UTC", "STRING", "Default timezone", true],
  ["general", "site.defaultThemeMode", "system", "SELECT", "Default colour mode", true],
  ["general", "site.faviconUrl", "/favicon.ico", "IMAGE", "Favicon", true],

  // SEO
  ["seo", "seo.titleTemplate", "%s | MBX Pro", "STRING", "Title template", true],
  ["seo", "seo.defaultOgImage", "/og-default.png", "IMAGE", "Default share image", true],
  ["seo", "seo.robotsIndex", true, "BOOLEAN", "Allow search indexing", false],
  ["seo", "seo.googleSiteVerification", "", "STRING", "Google verification token", false],

  // Layout — homepage sections, ordered and toggleable without a deploy
  [
    "layout",
    "home.sections",
    [
      // `variant`/`limit` are optional (changes-03-plan.md §5.1): a section
      // with one sensible layout simply omits them. Every variant named here
      // is validated against HOME_SECTION_VARIANTS in @repo/contracts.
      { key: "hero", enabled: true, order: 1, variant: "split" },
      { key: "learning_paths", enabled: true, order: 2, variant: "elevated", limit: 3 },
      { key: "forex_rates", enabled: true, order: 3, variant: "marquee" },
      { key: "latest_analysis", enabled: true, order: 4, variant: "standard", limit: 3 },
      { key: "economic_events", enabled: true, order: 5, limit: 5 },
      { key: "popular_tools", enabled: true, order: 6, variant: "default", limit: 4 },
      { key: "glossary_spotlight", enabled: true, order: 7, variant: "chips", limit: 8 },
      { key: "featured_lessons", enabled: true, order: 8, variant: "default", limit: 3 },
      { key: "market_sentiment", enabled: false, order: 9 },
      { key: "trading_sessions", enabled: true, order: 10 },
      { key: "newsletter", enabled: true, order: 11, variant: "full-width" },
      { key: "faq", enabled: true, order: 12, variant: "accordion", limit: 6 },
      { key: "risk_disclaimer", enabled: true, order: 13 },
    ],
    "JSON",
    "Homepage sections",
    true,
  ],
  ["layout", "layout.containerWidth", "1400px", "STRING", "Max content width", true],
  ["layout", "layout.showBreadcrumbs", true, "BOOLEAN", "Show breadcrumbs", true],
  // SiteLoader's kill switch (ADR-018 rule 4d) — the brand preloader can be
  // switched off without a deploy. Default ON is safe: it is capped at 900ms,
  // shows once per tab session, and is skipped under reduced motion.
  ["layout", "layout.pageLoader", true, "BOOLEAN", "Show page loader on first visit", true],

  // Header (plan.md A6 — "Add header settings (layout group)"). Logo variant
  // per mode is already covered by BrandAsset, not a Setting.
  ["layout", "header.sticky", true, "BOOLEAN", "Sticky header", true],
  [
    "layout",
    "header.cta",
    { enabled: false, label: "Get Started", url: "/sign-up" },
    "JSON",
    "Header call-to-action button",
    true,
  ],
  [
    "layout",
    "header.announcementBar",
    { enabled: false, text: "", dismissible: true },
    "JSON",
    "Announcement bar",
    true,
  ],

  // Footer (plan.md A6 — "Add footer settings").
  [
    "layout",
    "footer.menuColumns",
    [{ menuKey: "footer_learn", order: 1 }],
    "JSON",
    "Footer menu columns (which menus, in which order)",
    true,
  ],
  ["layout", "footer.newsletterEnabled", true, "BOOLEAN", "Show newsletter signup in footer", true],

  // Public design system (ADR-018 / changes-03-plan.md §5.1). All default to
  // OFF or empty: these add chrome to the public surface, so an install that
  // never touches them looks exactly as it does today.
  [
    "layout",
    "header.topBar",
    { enabled: false, phone: "", promoText: "", promoUrl: "" },
    "JSON",
    "Header top bar (contact + promo)",
    true,
  ],
  ["layout", "header.showSearch", false, "BOOLEAN", "Show search in header", true],
  ["layout", "footer.showPaymentBadges", false, "BOOLEAN", "Show payment badges in footer", true],
  // Badge IMAGES are admin uploads (ADR-017); this stores only the links, so
  // no third-party logo is ever committed to the repo.
  ["layout", "footer.appLinks", [], "JSON", "Footer app-store links", true],

  // Legal
  [
    "legal",
    "legal.riskDisclaimer",
    "All content is educational and does not constitute financial advice. Trading carries risk, and you may lose more than your initial deposit. Past performance does not indicate future results.",
    "TEXT",
    "Risk disclaimer",
    true,
  ],
  // News & Analysis (Module 15, ADR-015 #7 — module on/off is the news/
  // analysis feature flags; title template, OG fallback and disclaimer
  // reuse seo.*/legal.* keys).
  ["articles", "articles.perPage", 12, "NUMBER", "Articles per page", true],
  ["articles", "articles.showAuthor", true, "BOOLEAN", "Show author byline", true],
  ["articles", "articles.showReadingTime", true, "BOOLEAN", "Show reading time", true],
  ["articles", "articles.relatedCount", 3, "NUMBER", "Related articles (0 = off)", true],

  [
    "legal",
    "legal.copyrightNotice",
    // {year} is a rendering-time token (Module 08 owns substitution), not
    // resolved here — plan.md A6: "copyright line (translatable, {year} token)".
    "© {year} MBX Pro. All rights reserved.",
    "STRING",
    "Copyright notice",
    true,
  ],
] as const;

// ─────────────────────────────────────────────────────────────
// 5. FEATURE FLAGS
// ─────────────────────────────────────────────────────────────

const FEATURE_FLAGS = [
  ["content", "courses", "Courses", true, "PUBLIC"],
  ["content", "glossary", "Glossary", true, "PUBLIC"],
  ["content", "analysis", "Market analysis", true, "PUBLIC"],
  ["content", "news", "News feed", true, "PUBLIC"],
  ["content", "quizzes", "Quizzes", false, "AUTHENTICATED"],
  ["tools", "calculators", "Trading calculators", true, "PUBLIC"],
  ["tools", "currency_converter", "Currency converter", true, "PUBLIC"],
  ["market", "market_data", "Live market data", true, "PUBLIC"],
  ["market", "economic_calendar", "Economic calendar", true, "PUBLIC"],
  ["market", "currency_strength", "Currency strength meter", false, "PREMIUM"],
  ["community", "comments", "Article comments", false, "AUTHENTICATED"],
  ["community", "forums", "Community forums", false, "AUTHENTICATED"],
  ["account", "user_accounts", "User accounts", true, "PUBLIC"],
  ["account", "progress_tracking", "Course progress tracking", true, "AUTHENTICATED"],
  ["account", "watchlists", "Watchlists", false, "AUTHENTICATED"],
  ["account", "newsletter", "Newsletter signup", true, "PUBLIC"],
] as const;

// ─────────────────────────────────────────────────────────────
// 6. DEFAULT THEME TOKENS
//
// TODO(Module 02): these are @repo/theme's DEFAULT_BRAND/DEFAULT_LIGHT_SURFACE
// /DEFAULT_DARK_SURFACE/DEFAULT_DARK_BRAND_OVERRIDES/DEFAULT_LAYOUT constants
// (docs/reference/theme-engine.ts). @repo/db can't depend on @repo/theme
// either way — architecture.md #8 has the dependency pointing core → db, not
// db → theme — so this duplication is permanent, not a stopgap; keep
// ./default-theme-tokens.json in sync with Module 02's exports by hand, or
// better, move seeding of the default theme row into Module 02 once it
// lands and drop this block here. Values live in JSON, not this file,
// because code-style.md #1 bans hex literals outside @repo/theme.
// ─────────────────────────────────────────────────────────────

const {
  DEFAULT_BRAND,
  DEFAULT_LIGHT_SURFACE,
  DEFAULT_DARK_SURFACE,
  DEFAULT_DARK_BRAND_OVERRIDES,
  DEFAULT_LAYOUT,
} = defaultThemeTokens;

// ─────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────

// Takes an injected client (rather than importing the app singleton) so
// integration tests can run it against a Testcontainers-provisioned
// database instead of the real dev/prod one.
export async function seed(db: PrismaClient) {
  console.log("Seeding…");

  // Permissions
  for (const [groupName, key, label] of PERMISSIONS) {
    await db.permission.upsert({
      where: { key },
      update: { groupName, label },
      create: { key, groupName, label },
    });
  }
  console.log(`  permissions: ${PERMISSIONS.length}`);

  const allPermissions = await db.permission.findMany();
  const permissionId = new Map(allPermissions.map((p) => [p.key, p.id]));

  // Roles + their grants
  for (const role of ROLES) {
    const record = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, level: role.level, isSystem: true },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        level: role.level,
        isSystem: true,
      },
    });

    const keys = role.permissions === ALL ? allPermissions.map((p) => p.key) : role.permissions;

    // Replace rather than merge: the seed file is the source of truth for
    // system roles, so removing a permission here actually revokes it.
    await db.rolePermission.deleteMany({ where: { roleId: record.id } });
    await db.rolePermission.createMany({
      data: keys
        .map((k) => permissionId.get(k))
        .filter((id): id is string => Boolean(id))
        .map((pid) => ({ roleId: record.id, permissionId: pid })),
      skipDuplicates: true,
    });
  }
  console.log(`  roles: ${ROLES.length}`);

  // Locales
  await db.locale.upsert({
    where: { code: "en" },
    update: {},
    create: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      flagEmoji: "🇬🇧",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
  // Seeded inactive so the switcher stays clean until content is translated.
  // fallbackCode is per-locale config, not a special case in code (ADR-007,
  // Module 06 SKILL.md): an LTR locale falls back to English content when
  // untranslated; an RTL locale does NOT — English content in an RTL layout
  // reads worse than a "not yet translated" notice, so ar/ur get no
  // fallbackCode at all and the resolution chain stops at "not translated."
  for (const l of [
    {
      code: "ur",
      name: "Urdu",
      nativeName: "اردو",
      direction: "RTL" as const,
      flagEmoji: "🇵🇰",
      sortOrder: 2,
      fallbackCode: null,
    },
    {
      code: "ar",
      name: "Arabic",
      nativeName: "العربية",
      direction: "RTL" as const,
      flagEmoji: "🇸🇦",
      sortOrder: 3,
      fallbackCode: null,
    },
    {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      direction: "LTR" as const,
      flagEmoji: "🇪🇸",
      sortOrder: 4,
      fallbackCode: "en",
    },
  ]) {
    await db.locale.upsert({
      where: { code: l.code },
      update: {},
      create: { ...l, isDefault: false, isActive: false },
    });
  }
  console.log("  locales: 4 (en active)");

  // Theme — brand colours shared across modes, surfaces authored per mode.
  await db.theme.upsert({
    where: { key: "mbx-pro-default" },
    update: {
      brandColors: DEFAULT_BRAND,
      lightSurface: DEFAULT_LIGHT_SURFACE,
      darkSurface: DEFAULT_DARK_SURFACE,
      darkBrandOverrides: DEFAULT_DARK_BRAND_OVERRIDES,
      layoutTokens: DEFAULT_LAYOUT,
    },
    create: {
      key: "mbx-pro-default",
      name: "MBX Pro",
      description: "Default brand theme.",
      brandColors: DEFAULT_BRAND,
      lightSurface: DEFAULT_LIGHT_SURFACE,
      darkSurface: DEFAULT_DARK_SURFACE,
      darkBrandOverrides: DEFAULT_DARK_BRAND_OVERRIDES,
      layoutTokens: DEFAULT_LAYOUT,
      defaultMode: "SYSTEM",
      isActive: true,
      isSystem: true,
      scope: "both",
    },
  });
  console.log("  theme: mbx-pro-default (active)");

  // Settings
  for (const [groupName, key, value, type, label, isPublic] of SETTINGS) {
    await db.setting.upsert({
      where: { key },
      // Never overwrite a value an admin has already changed.
      update: { groupName, label, type: type as never, isPublic },
      create: { key, groupName, value: value as never, type: type as never, label, isPublic },
    });
  }
  console.log(`  settings: ${SETTINGS.length}`);

  // Feature flags
  for (const [groupName, key, label, isEnabled, visibility] of FEATURE_FLAGS) {
    await db.featureFlag.upsert({
      where: { key },
      update: { groupName, label },
      create: { key, groupName, label, isEnabled, visibility: visibility as never },
    });
  }
  console.log(`  feature flags: ${FEATURE_FLAGS.length}`);

  // Social links
  for (const link of SOCIAL_LINKS) {
    await db.socialLink.upsert({
      where: { platform: link.platform },
      update: { url: link.url, handle: link.handle, label: link.label },
      create: { ...link, isActive: true, showInFooter: true, showInHeader: false },
    });
  }
  console.log(`  social links: ${SOCIAL_LINKS.length}`);

  // Departments
  for (const d of [
    { key: "content", name: "Content & Education", sortOrder: 1 },
    { key: "engineering", name: "Engineering", sortOrder: 2 },
    { key: "research", name: "Market Research", sortOrder: 3 },
    { key: "marketing", name: "Marketing & SEO", sortOrder: 4 },
    { key: "support", name: "Customer Support", sortOrder: 5 },
    { key: "operations", name: "Operations", sortOrder: 6 },
  ]) {
    await db.department.upsert({ where: { key: d.key }, update: { name: d.name }, create: d });
  }

  for (const d of [
    { key: "head_of_content", title: "Head of Content", level: 80 },
    { key: "senior_editor", title: "Senior Editor", level: 60 },
    { key: "content_writer", title: "Content Writer", level: 40 },
    { key: "market_analyst", title: "Market Analyst", level: 50 },
    { key: "senior_engineer", title: "Senior Engineer", level: 70 },
    { key: "engineer", title: "Software Engineer", level: 50 },
    { key: "seo_specialist", title: "SEO Specialist", level: 50 },
    { key: "support_agent", title: "Support Agent", level: 30 },
  ]) {
    await db.designation.upsert({ where: { key: d.key }, update: { title: d.title }, create: d });
  }
  console.log("  departments: 6, designations: 8");

  // Navigation
  const mainMenu = await db.menu.upsert({
    where: { key: "main" },
    update: {},
    create: { key: "main", name: "Main navigation", location: "header" },
  });

  const NAV = [
    {
      routeKey: "learn",
      label: "Learn",
      icon: "graduation-cap",
      requiresFeature: "courses",
      sortOrder: 1,
    },
    {
      routeKey: "glossary",
      label: "Glossary",
      icon: "book-a",
      requiresFeature: "glossary",
      sortOrder: 2,
    },
    {
      routeKey: "tools",
      label: "Tools",
      icon: "calculator",
      requiresFeature: "calculators",
      sortOrder: 3,
    },
    {
      routeKey: "markets",
      label: "Markets",
      icon: "trending-up",
      requiresFeature: "market_data",
      sortOrder: 4,
    },
    {
      routeKey: "analysis",
      label: "Analysis",
      icon: "line-chart",
      requiresFeature: "analysis",
      sortOrder: 5,
    },
    {
      routeKey: "economic-calendar",
      label: "Calendar",
      icon: "calendar",
      requiresFeature: "economic_calendar",
      sortOrder: 6,
    },
    { routeKey: "news", label: "News", icon: "newspaper", requiresFeature: "news", sortOrder: 7 },
  ];

  for (const item of NAV) {
    const existing = await db.menuItem.findFirst({
      where: { menuId: mainMenu.id, routeKey: item.routeKey },
    });
    const record = existing
      ? await db.menuItem.update({
          where: { id: existing.id },
          data: { icon: item.icon, sortOrder: item.sortOrder },
        })
      : await db.menuItem.create({
          data: {
            menuId: mainMenu.id,
            routeKey: item.routeKey,
            icon: item.icon,
            sortOrder: item.sortOrder,
            requiresFeature: item.requiresFeature,
            isActive: true,
          },
        });

    await db.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId: record.id, locale: "en" } },
      update: { label: item.label },
      create: { menuItemId: record.id, locale: "en", label: item.label },
    });
  }
  // Footer menu — referenced by the footer.menuColumns setting (A6).
  const footerLearn = await db.menu.upsert({
    where: { key: "footer_learn" },
    update: {},
    create: { key: "footer_learn", name: "Footer — Learn", location: "footer" },
  });
  const FOOTER_NAV = [
    { routeKey: "learn", label: "Courses", requiresFeature: "courses", sortOrder: 1 },
    { routeKey: "glossary", label: "Glossary", requiresFeature: "glossary", sortOrder: 2 },
    { routeKey: "news", label: "News", requiresFeature: "news", sortOrder: 3 },
  ];
  for (const item of FOOTER_NAV) {
    const existing = await db.menuItem.findFirst({
      where: { menuId: footerLearn.id, routeKey: item.routeKey },
    });
    const record = existing
      ? await db.menuItem.update({
          where: { id: existing.id },
          data: { sortOrder: item.sortOrder },
        })
      : await db.menuItem.create({
          data: {
            menuId: footerLearn.id,
            routeKey: item.routeKey,
            sortOrder: item.sortOrder,
            requiresFeature: item.requiresFeature,
            isActive: true,
          },
        });
    await db.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId: record.id, locale: "en" } },
      update: { label: item.label },
      create: { menuItemId: record.id, locale: "en", label: item.label },
    });
  }

  console.log(`  menu items: ${NAV.length + FOOTER_NAV.length}`);

  // Article taxonomy (Module 15, ADR-015). Categories are required by
  // Article.categoryId, so the admin flow needs at least these to exist;
  // tags are convenience starters. Idempotent via the [locale, slug]
  // uniqueness on translation rows — no sample articles, same restraint as
  // glossary content.
  const ARTICLE_CATEGORIES = [
    { slug: "market-news", name: "Market News", sortOrder: 1 },
    { slug: "central-banks", name: "Central Banks", sortOrder: 2 },
    { slug: "technical-analysis", name: "Technical Analysis", sortOrder: 3 },
    { slug: "trade-ideas", name: "Trade Ideas", sortOrder: 4 },
  ];
  for (const c of ARTICLE_CATEGORIES) {
    const existing = await db.articleCategoryTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: c.slug } },
      select: { categoryId: true },
    });
    if (existing) {
      await db.articleCategory.update({
        where: { id: existing.categoryId },
        data: { sortOrder: c.sortOrder },
      });
    } else {
      await db.articleCategory.create({
        data: {
          sortOrder: c.sortOrder,
          translations: { create: { locale: "en", name: c.name, slug: c.slug } },
        },
      });
    }
  }

  const ARTICLE_TAGS = [
    { slug: "eur-usd", name: "EUR/USD" },
    { slug: "gbp-usd", name: "GBP/USD" },
    { slug: "usd-jpy", name: "USD/JPY" },
    { slug: "gold", name: "Gold" },
    { slug: "crude-oil", name: "Crude Oil" },
    { slug: "fed", name: "Fed" },
    { slug: "ecb", name: "ECB" },
  ];
  for (const tag of ARTICLE_TAGS) {
    const existing = await db.articleTagTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: tag.slug } },
      select: { id: true },
    });
    if (!existing) {
      await db.articleTag.create({
        data: { translations: { create: { locale: "en", name: tag.name, slug: tag.slug } } },
      });
    }
  }
  console.log(
    `  article taxonomy: ${ARTICLE_CATEGORIES.length} categories, ${ARTICLE_TAGS.length} tags`,
  );

  // Bootstrap super admin.
  //
  // Written directly via Prisma rather than Better Auth's API (no HTTP
  // context at seed time). The User + Account shape must match exactly what
  // Better Auth's credential provider expects to find at sign-in:
  // `Account.issuer` is the synthetic `local:<providerId>` key
  // (`createLocalAccountIssuer("credential")` in Better Auth's source —
  // ADR-001), and `accountId` equals the user's own id for local accounts.
  //
  // Password comes from the environment so a real credential never lands in
  // git. In production, seed with a random value and force a reset on login.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@mbxpro.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn("  SKIPPED admin user — set SEED_ADMIN_PASSWORD to create it.");
  } else {
    // ADR-001: Argon2id, default algorithm — matches Module 04's
    // emailAndPassword.password.hash override.
    const passwordHash = await hash(adminPassword, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const admin = await db.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        id: randomUUID(),
        email: adminEmail,
        name: "System Administrator",
        firstName: "System",
        lastName: "Administrator",
        emailVerified: true,
        userType: "STAFF",
        status: "ACTIVE",
        locale: "en",
      },
    });

    await db.account.upsert({
      where: { issuer_accountId: { issuer: "local:credential", accountId: admin.id } },
      update: { password: passwordHash },
      create: {
        id: randomUUID(),
        userId: admin.id,
        providerId: "credential",
        accountId: admin.id,
        issuer: "local:credential",
        password: passwordHash,
      },
    });

    const superAdmin = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdmin.id },
    });

    await db.employee.upsert({
      where: { workEmail: adminEmail },
      update: {},
      create: {
        userId: admin.id,
        employeeCode: "EMP-0001",
        firstName: "System",
        lastName: "Administrator",
        workEmail: adminEmail,
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    console.log(`  super admin: ${adminEmail}`);
  }

  console.log("Done.");
}

// CLI entrypoint (`prisma db seed` / `pnpm db:seed`) — everything above this
// point is the reusable, injectable seed() function. Path-normalized (not a
// raw string compare) since import.meta.url and argv[1] use different
// separator/prefix conventions on Windows.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { config } = await import("dotenv");
  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

  const { db } = await import("../src/index.ts");
  seed(db)
    .catch((e: unknown) => {
      console.error("Seed failed:", e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
