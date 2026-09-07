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
import homePageLayout from "./home-page-layout.json" with { type: "json" };

// The `home` page's published layout (Module 16, plan v2.2 PR 2.7) — the
// four STATIC `home.sections` migrated to blocks (hero, newsletter, faq,
// risk_disclaimer). Kept as its own JSON file rather than inlined here: it
// is long, and it is hand-verified against `@repo/contracts`'
// `layoutTreeSchema` and the real `@repo/blocks` registry before every
// change (see the PR 2.7 DEVLOG entry for how) — a JSON file diffs and
// reviews the same way whether or not this comment is nearby.
const HOME_PAGE_LAYOUT = homePageLayout;

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
  ["content", "media.view", "View the media library"],
  ["content", "media.upload", "Upload media"],
  ["content", "media.update", "Edit media metadata, replace files"],
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

  // Website builder (Module 16 — ADR-021 pages, ADR-027 parts). A part
  // publish is site-wide, hence its own key. The redirects screen reuses
  // the seeded `redirects.manage`; the media library reuses `media.*`
  // (`media.view` / `media.update` land with the library in Phase 3).
  ["cms", "cms.pages.view", "View website pages"],
  ["cms", "cms.pages.create", "Create website pages"],
  ["cms", "cms.pages.update", "Edit website pages"],
  ["cms", "cms.pages.delete", "Delete website pages"],
  ["cms", "cms.pages.publish", "Publish website pages"],
  ["cms", "cms.parts.publish", "Publish global site parts"],
  ["cms", "cms.styles.manage", "Manage style presets"],
  ["cms", "cms.templates.manage", "Manage layout templates"],
  ["cms", "cms.cards.manage", "Manage card templates"],

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
      // Pages, not parts: a header publish stays with admin and above.
      "cms.pages.view",
      "cms.pages.create",
      "cms.pages.update",
      "cms.pages.delete",
      "cms.pages.publish",
      "cms.styles.manage",
      "cms.templates.manage",
      "cms.cards.manage",
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
      "media.view",
      "media.upload",
      "media.update",
      "seo.update",
      "translations.view",
      "translations.update",
      "cms.pages.view",
      "cms.pages.update",
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
      "media.view",
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
      "cms.pages.view",
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
      "media.view",
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

// `icon` names a glyph in @repo/ui's built-in social set (ADR-045) — these
// ARE the default icons, and they render on the public footer with no
// admin action. They used to name a `lucide-react` export, which stopped
// resolving when lucide v1 dropped its brand icons; the resolver aliases
// the old `twitter` value onto `x` so a database seeded before this change
// keeps rendering. An admin can upload their own artwork per link
// (`iconUrl`), which wins over the glyph named here.
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
    icon: "x",
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
      // The video rail opens the page, directly under the header — a
      // full-bleed inverted band, so the first thing below the menu reads as
      // a shelf of lessons rather than another card grid. The hero keeps the
      // <h1> immediately after it.
      { key: "learning_videos", enabled: true, order: 1, variant: "carousel", limit: 6 },
      { key: "hero", enabled: true, order: 2, variant: "split" },
      { key: "explore_platform", enabled: true, order: 3, variant: "carousel" },
      { key: "feature_highlights", enabled: true, order: 4, variant: "grid", limit: 6 },
      // News before analysis: "what happened" reads before "what we make of
      // it", and the two are separate sections precisely so the homepage can
      // make both promises distinctly (see latest-news.tsx).
      { key: "latest_news", enabled: true, order: 5, variant: "split", limit: 5 },
      { key: "latest_analysis", enabled: true, order: 6, variant: "standard", limit: 3 },
      { key: "glossary_spotlight", enabled: true, order: 7, variant: "chips", limit: 8 },

      // The seven keys below are seeded but DISABLED, and that is the point:
      // nothing is built behind them, so enabling one renders the dashed
      // "Coming soon" placeholder. Seven of those between the real sections
      // is not a homepage, it is a construction site — and `explore_platform`
      // now says what is coming, in a card that looks designed.
      //
      // They stay in the list rather than being deleted so
      // `check:home-sections` keeps matching them against
      // HOME_SECTION_STUB_KEYS: a key that vanishes from the seed becomes a
      // stale stub entry and fails the check. Enabling one is a one-word
      // edit the day its component lands.
      //
      // Grouped together at the tail rather than interleaved: `order` is what
      // the page sorts on, so a disabled row's number is inert, and holding
      // them in one block is what makes "everything from here down is not
      // built yet" true by reading rather than by cross-referencing.
      { key: "learning_paths", enabled: false, order: 8, variant: "elevated", limit: 3 },
      { key: "forex_rates", enabled: false, order: 9, variant: "marquee" },
      { key: "economic_events", enabled: false, order: 10, limit: 5 },
      { key: "popular_tools", enabled: false, order: 11, variant: "default", limit: 4 },
      { key: "featured_lessons", enabled: false, order: 12, variant: "default", limit: 3 },
      { key: "market_sentiment", enabled: false, order: 13 },
      { key: "trading_sessions", enabled: false, order: 14 },

      { key: "newsletter", enabled: true, order: 15, variant: "full-width" },
      { key: "faq", enabled: true, order: 16, variant: "accordion", limit: 6 },
      { key: "risk_disclaimer", enabled: true, order: 17 },
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
    // All three footer menus, in reading order — the footer is a sitemap,
    // not a shortcut list. NOTE: the settings loop below never overwrites an
    // existing VALUE, so a database seeded before this line was widened
    // keeps its single column until it is reset (pre-launch DB policy) or
    // this one row is deleted and re-seeded.
    [
      { menuKey: "footer_learn", order: 1 },
      { menuKey: "footer_markets", order: 2 },
      { menuKey: "footer_company", order: 3 },
    ],
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

  // Media v2 (Module 16, ADR-034 §1) — per-kind upload caps in bytes.
  // Server-side validation only, never rendered on a public page.
  [
    "media",
    "media.maxBytes.image",
    5 * 1024 * 1024,
    "NUMBER",
    "Max image upload size (bytes)",
    false,
  ],
  [
    "media",
    "media.maxBytes.video",
    100 * 1024 * 1024,
    "NUMBER",
    "Max video upload size (bytes)",
    false,
  ],
  [
    "media",
    "media.maxBytes.audio",
    20 * 1024 * 1024,
    "NUMBER",
    "Max audio upload size (bytes)",
    false,
  ],
  [
    "media",
    "media.maxBytes.document",
    20 * 1024 * 1024,
    "NUMBER",
    "Max document upload size (bytes)",
    false,
  ],

  // Data budget (Module 16, ADR-029 §5, PR 3.4) — policy in settings, not
  // architecture. Conservative Phase-6 defaults ("a panel may hold two
  // collections of six"); raising them is a DEVLOG entry citing a
  // Lighthouse run, not a code change.
  [
    "cms",
    "cms.dataBudget",
    {
      page: { collections: { warn: 6, block: 10 }, items: { warn: 36, block: 72 } },
      part: { collections: { warn: 2, block: 4 }, items: { warn: 12, block: 24 } },
    },
    "JSON",
    "Dynamic-data budget (collections/items per page and part)",
    false,
  ],

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

  // About section (ADR-047) — the one main-menu entry with children, and so
  // the first consumer of the mega-menu panel (ADR-048). No requiresFeature:
  // these five pages are coded routes that always exist, unlike the
  // feature-gated areas above. `title` on each child is the one-line
  // description the panel renders under the label.
  const ABOUT_NAV = {
    routeKey: "about",
    label: "About",
    icon: "building-2",
    sortOrder: 8,
    children: [
      {
        routeKey: "about",
        label: "About MBX",
        title: "Who we are and what we teach",
        icon: "building-2",
        sortOrder: 1,
      },
      {
        routeKey: "about-why-us",
        label: "Why MBX",
        title: "Five reasons this is worth your time",
        icon: "badge-check",
        sortOrder: 2,
      },
      {
        routeKey: "about-transparency",
        label: "How we operate",
        title: "Our data, our methods, our funding",
        icon: "scale",
        sortOrder: 3,
      },
      {
        routeKey: "about-security",
        label: "Security & trust",
        title: "How we protect your account and data",
        icon: "shield-check",
        sortOrder: 4,
      },
      {
        routeKey: "about-support",
        label: "Support",
        title: "Reach a human when you need one",
        icon: "headset",
        sortOrder: 5,
      },
    ],
  };

  // The parent is matched on [menuId, routeKey] like every row above, but
  // children share `about`'s menu with their own routeKeys, so the child
  // lookup adds parentId to stay unambiguous.
  const aboutRootExisting = await db.menuItem.findFirst({
    where: { menuId: mainMenu.id, routeKey: ABOUT_NAV.routeKey, parentId: null },
  });
  const aboutRoot = aboutRootExisting
    ? await db.menuItem.update({
        where: { id: aboutRootExisting.id },
        data: { icon: ABOUT_NAV.icon, sortOrder: ABOUT_NAV.sortOrder },
      })
    : await db.menuItem.create({
        data: {
          menuId: mainMenu.id,
          routeKey: ABOUT_NAV.routeKey,
          icon: ABOUT_NAV.icon,
          sortOrder: ABOUT_NAV.sortOrder,
          isActive: true,
        },
      });
  await db.menuItemTranslation.upsert({
    where: { menuItemId_locale: { menuItemId: aboutRoot.id, locale: "en" } },
    update: { label: ABOUT_NAV.label },
    create: { menuItemId: aboutRoot.id, locale: "en", label: ABOUT_NAV.label },
  });

  for (const child of ABOUT_NAV.children) {
    const existing = await db.menuItem.findFirst({
      where: { menuId: mainMenu.id, parentId: aboutRoot.id, routeKey: child.routeKey },
    });
    const record = existing
      ? await db.menuItem.update({
          where: { id: existing.id },
          data: { icon: child.icon, sortOrder: child.sortOrder },
        })
      : await db.menuItem.create({
          data: {
            menuId: mainMenu.id,
            parentId: aboutRoot.id,
            routeKey: child.routeKey,
            icon: child.icon,
            sortOrder: child.sortOrder,
            isActive: true,
          },
        });

    await db.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId: record.id, locale: "en" } },
      update: { label: child.label, title: child.title },
      create: {
        menuItemId: record.id,
        locale: "en",
        label: child.label,
        title: child.title,
      },
    });
  }

  // Footer menus — referenced by the footer.menuColumns setting (A6).
  //
  // THREE columns, not one: every destination the header offers has a
  // footer row too, so a visitor who has scrolled to the bottom never has
  // to scroll back up to reach a section. The grouping mirrors how the
  // header reads (Learn / Markets / Company), which is why `footer_company`
  // repeats the About panel's five children rather than linking only /about.
  //
  // `requiresFeature` is copied from the header row for the same route on
  // purpose: buildMenu prunes on the flag, so switching `courses` off
  // empties the Learn column and the header entry together instead of
  // leaving a dead link at the bottom of every page. The About rows carry
  // no flag — they are coded routes that always exist (ADR-047).
  const FOOTER_MENUS = [
    {
      key: "footer_learn",
      name: "Learn",
      items: [
        { routeKey: "learn", label: "Courses", requiresFeature: "courses" },
        { routeKey: "glossary", label: "Glossary", requiresFeature: "glossary" },
        { routeKey: "news", label: "News & Analysis", requiresFeature: "news" },
      ],
    },
    {
      key: "footer_markets",
      name: "Markets & Tools",
      items: [
        { routeKey: "tools", label: "Trading Tools", requiresFeature: "calculators" },
        { routeKey: "markets", label: "Live Rates", requiresFeature: "market_data" },
        { routeKey: "analysis", label: "Market Analysis", requiresFeature: "analysis" },
        {
          routeKey: "economic-calendar",
          label: "Economic Calendar",
          requiresFeature: "economic_calendar",
        },
      ],
    },
    {
      key: "footer_company",
      name: "Company",
      items: [
        { routeKey: "about", label: "About MBX", requiresFeature: null },
        { routeKey: "about-why-us", label: "Why MBX", requiresFeature: null },
        { routeKey: "about-transparency", label: "How We Operate", requiresFeature: null },
        { routeKey: "about-security", label: "Security & Trust", requiresFeature: null },
        { routeKey: "about-support", label: "Support", requiresFeature: null },
      ],
    },
  ] satisfies {
    key: string;
    name: string;
    items: { routeKey: string; label: string; requiresFeature: string | null }[];
  }[];

  let footerItemCount = 0;
  for (const menu of FOOTER_MENUS) {
    // `name` IS updated on re-seed, unlike the main menu's: the footer
    // renders it as the column heading, so a stale "Footer — Learn" would
    // be visible on every public page. Menu ITEMS keep the usual
    // create-or-update-ordering shape.
    const footerMenu = await db.menu.upsert({
      where: { key: menu.key },
      update: { name: menu.name, location: "footer" },
      create: { key: menu.key, name: menu.name, location: "footer" },
    });

    for (const [index, item] of menu.items.entries()) {
      const sortOrder = index + 1;
      const existing = await db.menuItem.findFirst({
        where: { menuId: footerMenu.id, routeKey: item.routeKey },
      });
      const record = existing
        ? await db.menuItem.update({
            where: { id: existing.id },
            data: { sortOrder, requiresFeature: item.requiresFeature },
          })
        : await db.menuItem.create({
            data: {
              menuId: footerMenu.id,
              routeKey: item.routeKey,
              sortOrder,
              requiresFeature: item.requiresFeature,
              isActive: true,
            },
          });
      await db.menuItemTranslation.upsert({
        where: { menuItemId_locale: { menuItemId: record.id, locale: "en" } },
        update: { label: item.label },
        create: { menuItemId: record.id, locale: "en", label: item.label },
      });
      footerItemCount += 1;
    }
  }

  console.log(`  menu items: ${NAV.length + footerItemCount + 1 + ABOUT_NAV.children.length}`);

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
  let adminId: string | null = null;

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

    adminId = admin.id;
    console.log(`  super admin: ${adminEmail}`);
  }

  // Sample article (changes-07 PR 2). Gives the editor v2 screens something
  // real to load — every field the reference design has, including the ones
  // this PR added: featured flag, header image slot, FAQ items, focus
  // keywords, OG/Twitter overrides and the related-posts settings.
  //
  // `create`-only (never `update`), per Module 01's seed rule: an editor's
  // own changes to this row survive a re-seed.
  const SAMPLE_SLUG = "risk-management-protect-your-trading-capital";
  const sampleExists = await db.articleTranslation.findUnique({
    where: { locale_slug: { locale: "en", slug: SAMPLE_SLUG } },
    select: { id: true },
  });
  if (!sampleExists) {
    const analysisCategory = await db.articleCategoryTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: "technical-analysis" } },
      select: { categoryId: true },
    });
    const sampleTags = await db.articleTagTranslation.findMany({
      where: { locale: "en", slug: { in: ["gold", "eur-usd"] } },
      select: { tagId: true },
    });
    if (analysisCategory) {
      await db.article.create({
        data: {
          kind: "ANALYSIS",
          status: "PUBLISHED",
          publishedAt: new Date(),
          isActive: true,
          isFeatured: true,
          showRelated: true,
          relatedCount: 3,
          categoryId: analysisCategory.categoryId,
          authorId: adminId,
          tags: { create: sampleTags.map((t) => ({ tagId: t.tagId })) },
          translations: {
            create: {
              locale: "en",
              title: "Risk Management: How to Protect Your Trading Capital",
              slug: SAMPLE_SLUG,
              excerpt:
                "Risk management is the difference between traders who survive and traders who disappear. Learn the two percent rule, position sizing and stop losses.",
              body: [
                "<h2>The math problem nobody wants to face</h2>",
                "<p>Most beginners do not lose money because their analysis is wrong. They lose because a single position is allowed to be large enough to matter.</p>",
                "<h2>The 2% rule</h2>",
                "<p>Risk no more than two percent of the account on any one trade. On a $10,000 account that is $200 at risk per trade — not a $200 position.</p>",
                "<h3>Position sizing</h3>",
                '<p>Position size equals account risk divided by the stop distance. Read the <a href="/glossary">glossary</a> if any of these terms are new.</p>',
                "<h2>Keep a journal</h2>",
                "<p>After two hundred trades, patterns emerge. Without a written record you are guessing about your own behaviour.</p>",
              ].join(""),
              seoTitle: "Risk Management: Protect Your Trading Capital",
              seoDescription:
                "Learn forex risk management: the two percent rule, position sizing, stop losses and leverage. Protect your capital with proven money-management rules.",
              focusKeywords: "risk management, forex risk management, position sizing",
              ogTitle: "Risk Management: How to Protect Your Trading Capital",
              ogDescription:
                "The two percent rule, position sizing and stop losses — the money-management rules that keep traders in the game.",
              twitterCard: "summary_large_image",
              translationStatus: "TRANSLATED",
              faqItems: {
                create: [
                  {
                    sortOrder: 0,
                    question: "How much should I risk per trade?",
                    answer:
                      "<p>Two percent of account equity is the common ceiling. On a $10,000 account that is $200 of risk — the distance to your stop, not the position size.</p>",
                  },
                  {
                    sortOrder: 1,
                    question: "Does leverage change how much I risk?",
                    answer:
                      "<p>No. Leverage changes the capital required to hold a position. Your risk is still the stop distance multiplied by position size.</p>",
                  },
                ],
              },
            },
          },
        },
      });
      console.log("  sample article: risk-management (published, featured, 2 FAQ items)");
    }
  }

  // Website builder (Module 16, plan v2.2 PR 2.7). The `home` row is the
  // CMS's owner of "/". Phase 1 (PR 1.1) seeded it as a DRAFT with an empty
  // layout and NO published version, so `[locale]/page.tsx` kept serving
  // the settings-driven homepage until this phase's migration landed.
  // Phase 2 publishes the four STATIC `home.sections` (hero, newsletter,
  // faq, risk_disclaimer — plan §12 PR 2.7); `latest_analysis` and
  // `glossary_spotlight` stay on the settings-driven path until Phase 4's
  // `collection` block migrates them, and `[locale]/page.tsx`'s fallback
  // switch is what makes that split safe: the CMS page renders once
  // published, and today it legitimately has fewer sections than the
  // settings-driven fallback (`check:home-sections` / `home.sections`
  // are retired only in Phase 4, plan §12 PR 4.5, not here).
  //
  // Copy is inlined from the `home`/`footer` catalogs' EN strings at the
  // time of migration, not read live — a CMS page's text is admin-authored
  // content from here on, the same one-time snapshot ADR-031's
  // Consequences section describes for `home.sections`' hero CTA. `en` is
  // the only active locale (the others are seeded `isActive: false`, ADR-007),
  // so no other locale's `PageTranslation` needs this content yet. `@repo/db`
  // cannot depend on `@repo/contracts`/`@repo/core` (architecture.md #8),
  // so the layout is inlined JSON, hand-verified against the real
  // `layoutTreeSchema` and block registry before landing (see this PR's
  // DEVLOG entry), and the publish step below mirrors `publishPage()`'s
  // own writes (`cms/publish.ts`) by hand rather than importing it.
  const defaultLocale =
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en";
  const homePage = await db.page.upsert({
    where: { key: "home" },
    update: {},
    create: { key: "home", kind: "STATIC", status: "DRAFT", createdById: adminId ?? "seed" },
  });
  await db.pageTranslation.upsert({
    where: { pageId_locale: { pageId: homePage.id, locale: defaultLocale } },
    update: {},
    create: { pageId: homePage.id, locale: defaultLocale, title: "Home", slug: "", path: "/" },
  });

  let draftVersionId = homePage.draftVersionId;
  if (!draftVersionId) {
    const draft = await db.pageVersion.create({
      data: {
        pageId: homePage.id,
        number: 0,
        revision: 0,
        layout: HOME_PAGE_LAYOUT,
        authorId: adminId ?? "seed",
      },
    });
    draftVersionId = draft.id;
    await db.page.update({ where: { id: homePage.id }, data: { draftVersionId } });
  } else {
    // A dev DB seeded before this PR has Phase 1's empty placeholder draft.
    // Replace it — it was never real admin-authored content — rather than
    // requiring a full `db:reset` for a seed-only change (plan §5.2's
    // "reset over backfill" policy governs schema changes; this is neither).
    const existingDraft = await db.pageVersion.findUnique({
      where: { id: draftVersionId },
      select: { layout: true },
    });
    const isUntouchedPlaceholder =
      JSON.stringify(existingDraft?.layout) === JSON.stringify({ version: 1, nodes: [] });
    if (isUntouchedPlaceholder) {
      await db.pageVersion.update({
        where: { id: draftVersionId },
        data: { layout: HOME_PAGE_LAYOUT },
      });
    }
  }

  const homePageState = await db.page.findUniqueOrThrow({
    where: { id: homePage.id },
    select: { publishedVersionId: true },
  });
  if (!homePageState.publishedVersionId) {
    const published = await db.pageVersion.create({
      data: {
        pageId: homePage.id,
        number: 1,
        revision: 0,
        layout: HOME_PAGE_LAYOUT,
        authorId: adminId ?? "seed",
        note: "Phase 2 migration: hero, newsletter, faq, risk disclaimer",
      },
    });
    await db.page.update({
      where: { id: homePage.id },
      data: { publishedVersionId: published.id, status: "PUBLISHED", publishedAt: new Date() },
    });
  }
  console.log("  cms pages: home (published, PR 2.7 migration)");

  // Reuse models (Module 16, plan v2.2 PR 3.1, ADR-033). Six system
  // StylePresets and five system PAGE LayoutTemplates — enough that a
  // first page needs no preset authoring. `isSystem: true` rows are
  // clone-only (ADR-016/ADR-023 pattern); `create`-only (never `update`)
  // per Module 01's seed rule, so an admin's own edit to a since-cloned
  // row is never overwritten by a re-seed — these system rows are meant
  // to be read-only reference points, not editable, so this only matters
  // if a future migration ever needs to correct one's `config`/`layout`.
  const stylePresets = [
    {
      key: "hero-dark",
      name: "Hero — dark",
      scope: "any",
      config: {
        style: { background: { kind: "token", token: "primary" }, textTone: "on-primary" },
        motion: { entrance: "fade-up" },
      },
    },
    {
      key: "hero-light-image",
      name: "Hero — light, over image",
      scope: "any",
      config: { style: { textTone: "on-image" }, motion: { entrance: "fade-up" } },
    },
    {
      key: "band-primary",
      name: "Band — primary fill",
      scope: "any",
      config: {
        style: {
          background: { kind: "token", token: "primary" },
          textTone: "on-primary",
          padding: "lg",
        },
      },
    },
    {
      key: "card-lift",
      name: "Card — lift on hover",
      scope: "any",
      config: { motion: { hover: "lift" } },
    },
    {
      key: "section-muted",
      name: "Section — muted surface",
      scope: "any",
      config: { style: { background: { kind: "token", token: "surface-1" } } },
    },
    {
      key: "section-plain",
      name: "Section — no background",
      scope: "any",
      config: { style: { background: { kind: "token", token: "none" } } },
    },
  ] as const;

  for (const preset of stylePresets) {
    const existing = await db.stylePreset.findUnique({ where: { key: preset.key } });
    if (!existing) {
      await db.stylePreset.create({
        data: { ...preset, config: preset.config, isSystem: true, createdById: adminId },
      });
    }
  }
  console.log(`  style presets: ${stylePresets.length} system rows`);

  /** A minimal starter tree every "Start from" PAGE template copies into a new draft — heading + one paragraph the admin is expected to replace. */
  function starterPageLayout(heading: string, body: string) {
    return {
      version: 1,
      nodes: [
        {
          type: "section",
          id: "starter-section",
          version: 1,
          hidden: false,
          props: { spacing: "lg" },
          children: [
            {
              type: "container",
              id: "starter-container",
              version: 1,
              hidden: false,
              props: { size: "narrow" },
              children: [
                {
                  type: "heading",
                  id: "starter-heading",
                  version: 1,
                  hidden: false,
                  props: { text: heading, level: "1", align: "start" },
                  children: [],
                },
                {
                  type: "paragraph",
                  id: "starter-body",
                  version: 1,
                  hidden: false,
                  props: { text: body, align: "start", size: "default" },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const layoutTemplates = [
    {
      key: "landing-page",
      name: "Landing page",
      kind: "PAGE" as const,
      pageKind: "STATIC" as const,
      layout: starterPageLayout(
        "Your headline goes here",
        "Replace this paragraph with your page's introduction, then add sections below.",
      ),
    },
    {
      key: "tool-page",
      name: "Tool page",
      kind: "PAGE" as const,
      pageKind: "STATIC" as const,
      layout: starterPageLayout(
        "Tool name",
        "Introduce the tool here, then place its widget block below.",
      ),
    },
    {
      key: "legal-page",
      name: "Legal page",
      kind: "PAGE" as const,
      pageKind: "STATIC" as const,
      layout: starterPageLayout(
        "Legal document title",
        "Replace this paragraph with your legal text.",
      ),
    },
    {
      key: "contact-page",
      name: "Contact",
      kind: "PAGE" as const,
      pageKind: "STATIC" as const,
      layout: starterPageLayout(
        "Get in touch",
        "Replace this paragraph with contact details or a form widget.",
      ),
    },
    {
      key: "blank-page",
      name: "Blank page",
      kind: "PAGE" as const,
      pageKind: "STATIC" as const,
      layout: { version: 1, nodes: [] },
    },
  ] as const;

  for (const template of layoutTemplates) {
    const existing = await db.layoutTemplate.findUnique({ where: { key: template.key } });
    if (!existing) {
      await db.layoutTemplate.create({
        data: { ...template, layout: template.layout, isSystem: true, createdById: adminId },
      });
    }
  }
  console.log(`  layout templates: ${layoutTemplates.length} system rows`);

  // ADR-023 (PR 4.3): `standard`/`featured`/`compact` mirror
  // `article-list.tsx`'s three REAL existing variants field-for-field —
  // checked against that component before writing these, not assumed.
  // `horizontal` has no existing implementation anywhere in this repo to
  // port (the plan names it as a fourth system template with no such
  // precedent) — built new, image-left/content-right, a single row.
  const cardTemplates = [
    {
      key: "standard",
      name: "Standard",
      contentType: null,
      variant: "standard" as const,
      config: {
        version: 1,
        fields: ["image", "category", "title", "excerpt", "date"],
        imageAspectRatio: "video" as const,
        excerptLength: 160,
      },
    },
    {
      key: "featured",
      name: "Featured",
      contentType: null,
      variant: "featured" as const,
      config: {
        version: 1,
        fields: ["image", "category", "title", "excerpt", "date"],
        imageAspectRatio: "video" as const,
        excerptLength: 220,
      },
    },
    {
      key: "compact",
      name: "Compact",
      contentType: null,
      variant: "compact" as const,
      config: {
        version: 1,
        fields: ["category", "title", "date"],
        imageAspectRatio: "video" as const,
        excerptLength: 0,
      },
    },
    {
      key: "horizontal",
      name: "Horizontal",
      contentType: null,
      variant: "horizontal" as const,
      config: {
        version: 1,
        fields: ["image", "category", "title", "excerpt", "date"],
        imageAspectRatio: "square" as const,
        excerptLength: 160,
      },
    },
  ] as const;

  for (const template of cardTemplates) {
    const existing = await db.cardTemplate.findUnique({ where: { key: template.key } });
    if (!existing) {
      await db.cardTemplate.create({
        data: { ...template, config: template.config, isSystem: true, createdById: adminId },
      });
    }
  }
  console.log(`  card templates: ${cardTemplates.length} system rows`);

  // Plan v2.2 §12 PR 4.4: `/news` as a real COLLECTION page, seeded
  // published so `news/page.tsx`'s fallback switch has something to
  // render immediately. Scoped down and named, not silently incomplete:
  // no archive-by-month sidebar (no block implements one yet) and no
  // category-filter pills (no curated `options` exist for a hand-written
  // seed to guess at) — an admin adds a `collection-filter` block with
  // real options once real categories exist to filter by. This proves the
  // fallback-switch mechanism and the collection/search/pagination
  // pipeline end to end; it is not a byte-for-byte parity claim with
  // today's hand-built route (which also has an archive sidebar this
  // seed's block set cannot express yet).
  const NEWS_COLLECTION_LAYOUT = {
    version: 1,
    nodes: [
      {
        type: "heading",
        id: "news-heading",
        version: 1,
        hidden: false,
        props: { text: "News & Analysis", level: "1", align: "start" },
        children: [],
      },
      {
        type: "paragraph",
        id: "news-intro",
        version: 1,
        hidden: false,
        props: {
          text: "The latest market-moving headlines and expert breakdowns.",
          align: "start",
          size: "default",
        },
        children: [],
      },
      {
        type: "collection-search",
        id: "news-search",
        version: 1,
        hidden: false,
        props: { bindingId: "main", placeholder: "Search news…" },
        children: [],
      },
      {
        type: "collection",
        id: "news-collection",
        version: 2,
        hidden: false,
        props: {
          contentType: "news",
          bindingId: "main",
          filter: {},
          limit: 12,
          layout: "grid",
          columns: "3",
        },
        children: [],
      },
      {
        type: "collection-pagination",
        id: "news-pagination",
        version: 1,
        hidden: false,
        props: { bindingId: "main", mode: "numbered" },
        children: [],
      },
    ],
  };

  const newsPage = await db.page.upsert({
    where: { key: "news-collection" },
    update: {},
    create: {
      key: "news-collection",
      kind: "COLLECTION",
      contentType: "news",
      status: "DRAFT",
      createdById: adminId ?? "seed",
    },
  });
  await db.pageTranslation.upsert({
    where: { pageId_locale: { pageId: newsPage.id, locale: defaultLocale } },
    update: {},
    create: {
      pageId: newsPage.id,
      locale: defaultLocale,
      title: "News & Analysis",
      slug: "news",
      path: "/news",
    },
  });
  let newsDraftVersionId = newsPage.draftVersionId;
  if (!newsDraftVersionId) {
    const draft = await db.pageVersion.create({
      data: {
        pageId: newsPage.id,
        number: 0,
        revision: 0,
        layout: NEWS_COLLECTION_LAYOUT,
        authorId: adminId ?? "seed",
      },
    });
    newsDraftVersionId = draft.id;
    await db.page.update({
      where: { id: newsPage.id },
      data: { draftVersionId: newsDraftVersionId },
    });
  }
  const newsPageState = await db.page.findUniqueOrThrow({
    where: { id: newsPage.id },
    select: { publishedVersionId: true },
  });
  if (!newsPageState.publishedVersionId) {
    const published = await db.pageVersion.create({
      data: {
        pageId: newsPage.id,
        number: 1,
        revision: 0,
        layout: NEWS_COLLECTION_LAYOUT,
        authorId: adminId ?? "seed",
        note: "Phase 4 PR 4.4: /news as a COLLECTION page",
      },
    });
    await db.page.update({
      where: { id: newsPage.id },
      data: { publishedVersionId: published.id, status: "PUBLISHED", publishedAt: new Date() },
    });
  }
  console.log("  cms pages: news-collection (published, PR 4.4 migration)");

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
