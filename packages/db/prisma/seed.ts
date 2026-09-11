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
  // ADR-058 #7 — PUBLIC, not AUTHENTICATED. The learn layout is cached and
  // evaluates section flags with a null subject, so AUTHENTICATED here would
  // hide the Quizzes tab from everyone, signed in or not. Guests read quizzes;
  // STARTING AN ATTEMPT is what needs an account, and the attempt endpoints
  // enforce that themselves.
  ["content", "quizzes", "Quizzes", true, "PUBLIC"],
  // ADR-068 / changes-16 D10 — ON since PR 7 built the public routes. It was
  // seeded OFF until they existed, because a flag-off learn section is ABSENT
  // rather than disabled (changes-11 D25): a tab that leads to a 404 is worse
  // than no tab.
  ["content", "videos", "Videos", true, "PUBLIC"],
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
// because code-style.md #1 bans hex literals outside @repo/theme. The hand
// sync drifted once (fixed with ADR-072); @repo/theme's seed-sync.test.ts
// now fails the moment the JSON and the exports disagree.
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

  // The header's flat rows. The learning entries are NOT here — ADR-065 §4
  // replaced the single "Learn" row with one root per track, each carrying
  // three children, and those are seeded as trees below.
  const NAV = [
    {
      routeKey: "glossary",
      label: "Glossary",
      icon: "book-a",
      requiresFeature: "glossary",
      sortOrder: 3,
    },
    {
      routeKey: "tools",
      label: "Tools",
      icon: "calculator",
      requiresFeature: "calculators",
      sortOrder: 4,
    },
    {
      routeKey: "markets",
      label: "Markets",
      icon: "trending-up",
      requiresFeature: "market_data",
      sortOrder: 5,
    },
    {
      routeKey: "analysis",
      label: "Analysis",
      icon: "line-chart",
      requiresFeature: "analysis",
      sortOrder: 6,
    },
    {
      routeKey: "economic-calendar",
      label: "Calendar",
      icon: "calendar",
      requiresFeature: "economic_calendar",
      sortOrder: 7,
    },
    { routeKey: "news", label: "News", icon: "newspaper", requiresFeature: "news", sortOrder: 8 },
  ];

  // The row ADR-065 §4 replaced. Removed rather than left in place: an upsert
  // seed never deletes, so without this a database seeded before ADR-065 keeps
  // a third learning entry in the header pointing at the umbrella page. Its
  // children go with it — there were none, but a future edit could add some.
  const supersededLearnRoot = await db.menuItem.findFirst({
    where: { menuId: mainMenu.id, routeKey: "learn", parentId: null },
    select: { id: true },
  });
  if (supersededLearnRoot) {
    await db.menuItem.deleteMany({ where: { parentId: supersededLearnRoot.id } });
    await db.menuItem.delete({ where: { id: supersededLearnRoot.id } });
  }

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

  // The two schools (ADR-065 §4) — the header entries that replaced "Learn",
  // each with the same three surfaces under it. The panel's COMPOSITION lives
  // in `_nav/mega-menu.ts` (ADR-048); what is here is what the database owns:
  // which rows exist, their order, their labels and their hrefs.
  //
  // `requiresFeature` per child, copied from the surface each one points at,
  // so switching `quizzes` off empties the row from both panels and both
  // section bars at once rather than leaving a link to a 404.
  const TRACK_NAV = [
    { track: "forex", label: "Learn Forex", sortOrder: 1 },
    { track: "crypto", label: "Learn Crypto", sortOrder: 2 },
  ].map(({ track, label, sortOrder }) => ({
    routeKey: `learn-${track}`,
    label,
    icon: "graduation-cap",
    requiresFeature: "courses",
    sortOrder,
    children: [
      {
        routeKey: `learn-${track}`,
        label: "Courses",
        title: "Structured lessons, start to finish",
        icon: "graduation-cap",
        requiresFeature: "courses",
        sortOrder: 1,
      },
      // Videos before Quizzes, matching `LEARN_TRACK_SURFACES` — that
      // registry declares section-bar order, and the header, the section bar
      // and the mega-menu panel all read the same sequence.
      {
        routeKey: `learn-${track}-videos`,
        label: "Videos",
        title: "Short walkthroughs, one topic each",
        icon: "video",
        requiresFeature: "videos",
        sortOrder: 2,
      },
      {
        routeKey: `learn-${track}-quizzes`,
        label: "Quizzes",
        title: "Check what stuck, one topic at a time",
        icon: "list-checks",
        requiresFeature: "quizzes",
        sortOrder: 3,
      },
      {
        routeKey: `learn-${track}-glossary`,
        label: "Glossary",
        title: "Every term this school uses, explained",
        icon: "book-a",
        requiresFeature: "glossary",
        sortOrder: 4,
      },
      // The umbrella, from inside each school. Deliberately the last row and
      // not a "view all" footer — the footer would read "Learn Forex · View
      // all" and land on a page covering both schools (ADR-065 §4).
      {
        routeKey: "learn",
        label: "All learning",
        title: "Both schools in one place",
        icon: "layers",
        requiresFeature: "courses",
        sortOrder: 5,
      },
    ],
  }));

  /**
   * A root row and its children, matched the way every row above is: the
   * parent on [menuId, routeKey, parentId: null], the children on the same
   * plus their parent — children share the menu with their own routeKeys, so
   * the parentId is what keeps the lookup unambiguous.
   */
  async function upsertNavTree(spec: {
    routeKey: string;
    label: string;
    icon: string;
    sortOrder: number;
    requiresFeature?: string;
    children: {
      routeKey: string;
      label: string;
      title: string;
      icon: string;
      sortOrder: number;
      requiresFeature?: string;
    }[];
  }) {
    const rootExisting = await db.menuItem.findFirst({
      where: { menuId: mainMenu.id, routeKey: spec.routeKey, parentId: null },
    });
    const root = rootExisting
      ? await db.menuItem.update({
          where: { id: rootExisting.id },
          data: { icon: spec.icon, sortOrder: spec.sortOrder },
        })
      : await db.menuItem.create({
          data: {
            menuId: mainMenu.id,
            routeKey: spec.routeKey,
            icon: spec.icon,
            sortOrder: spec.sortOrder,
            requiresFeature: spec.requiresFeature,
            isActive: true,
          },
        });
    await db.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId: root.id, locale: "en" } },
      update: { label: spec.label },
      create: { menuItemId: root.id, locale: "en", label: spec.label },
    });

    for (const child of spec.children) {
      const existing = await db.menuItem.findFirst({
        where: { menuId: mainMenu.id, parentId: root.id, routeKey: child.routeKey },
      });
      const record = existing
        ? await db.menuItem.update({
            where: { id: existing.id },
            data: { icon: child.icon, sortOrder: child.sortOrder },
          })
        : await db.menuItem.create({
            data: {
              menuId: mainMenu.id,
              parentId: root.id,
              routeKey: child.routeKey,
              icon: child.icon,
              sortOrder: child.sortOrder,
              requiresFeature: child.requiresFeature,
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
  }

  for (const tree of [...TRACK_NAV, ABOUT_NAV]) await upsertNavTree(tree);

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

  // ─────────────────────────────────────────────────────────────
  // LEARN AREA — demo courses (changes-11 PR 1.4, ADR-055)
  //
  // One published course per registered LEARN_TRACKS key. Both tracks ship a
  // course deliberately: `forex` and `crypto` are both registered in code, and
  // a track with no published courses must render NO band (ADR-055 #2), so
  // seeding only one would hide that rule behind an empty result rather than
  // exercising it. The empty-band case gets its own fixture in the test suite.
  //
  // Idempotent via the [locale, slug] uniqueness on course_translations, the
  // same key the article taxonomy above uses.
  //
  // `track` is a plain string here, not an import from @repo/contracts:
  // packages/db must not depend on packages/contracts (architecture.md #8
  // points core -> db/contracts, never db -> contracts). The values are
  // covered by a contracts unit test and by the service-layer validation that
  // lands in Phase 2.
  // ─────────────────────────────────────────────────────────────
  const DEMO_COURSES = [
    {
      track: "forex",
      slug: "forex-fundamentals",
      title: "Forex Fundamentals",
      summary: "How the currency market works, what moves it, and how a trade is actually placed.",
      difficulty: "BEGINNER",
      estimatedHours: 4,
      sections: [
        {
          slug_: "what-is-forex",
          title: "What Is Forex?",
          description: "The market itself: who trades it, when, and why it moves.",
          lessons: [
            {
              slug: "the-foreign-exchange-market",
              title: "The foreign exchange market",
              summary: "Who trades currencies, and why the market never really closes.",
              minutes: 6,
              content:
                "<p>The foreign exchange market is where one currency is exchanged for another. It has no central exchange: banks, brokers, funds and companies deal with each other directly, which is why it trades around the clock from Sunday evening to Friday evening.</p><h2>Why it moves</h2><p>Prices move because the demand for one currency relative to another changes — driven by interest rates, growth, trade flows and expectations about all three.</p>",
            },
            {
              slug: "currency-pairs-and-quotes",
              title: "Currency pairs and quotes",
              summary: "Reading EUR/USD, and what the two prices on a quote mean.",
              minutes: 7,
              content:
                "<p>A currency is always priced against another, so every instrument is a <em>pair</em>. In EUR/USD the first currency is the base and the second is the quote: the price says how many US dollars one euro buys.</p><h2>Bid and ask</h2><p>You are shown two prices. The bid is what you can sell at, the ask is what you can buy at, and the gap between them is the spread — the cost of entering.</p>",
            },
            {
              slug: "pips-lots-and-leverage",
              title: "Pips, lots and leverage",
              summary: "The three units that decide what a price move is worth to you.",
              minutes: 8,
              content:
                "<p>A pip is the standard increment a pair moves in. A lot is the size of the position. Together they decide what one pip is worth in money.</p><h2>Leverage cuts both ways</h2><p>Leverage lets a small deposit control a larger position. It multiplies the result of a move in both directions, which is why position sizing matters more than entry timing for most new traders.</p>",
            },
          ],
        },
        {
          slug_: "reading-a-chart",
          title: "Reading a Chart",
          description: "Turning a price series into something you can make a decision from.",
          lessons: [
            {
              slug: "candlesticks-explained",
              title: "Candlesticks explained",
              summary: "What each candle records, and what it does not.",
              minutes: 6,
              content:
                "<p>A candlestick summarises four numbers for a period: open, high, low and close. The body spans open to close; the wicks reach the extremes.</p><p>A candle tells you where price went, not why. Treat a pattern as a description of what happened, never as a prediction on its own.</p>",
              videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
              slug: "support-and-resistance",
              title: "Support and resistance",
              summary: "Why certain levels keep mattering, and when they stop.",
              minutes: 7,
              content:
                "<p>Support is a level where buying has repeatedly appeared; resistance is where selling has. They matter because enough participants remember them to act again.</p><p>Levels are zones, not lines. A level that breaks convincingly often becomes the opposite kind of level afterwards.</p>",
            },
          ],
        },
        {
          slug_: "your-first-trade",
          title: "Your First Trade",
          description: "Orders, risk, and the reading that comes after this course.",
          lessons: [
            {
              slug: "order-types",
              title: "Order types",
              summary: "Market, limit, stop — and which one to reach for.",
              minutes: 5,
              content:
                "<p>A market order fills now at the best available price. A limit order fills only at your price or better. A stop order becomes a market order once a level trades.</p><p>Every position should have a stop attached before it is opened, not after.</p>",
            },
            {
              slug: "risk-and-position-sizing",
              title: "Risk and position sizing",
              summary: "Deciding size from the stop, rather than the other way round.",
              minutes: 9,
              content:
                "<p>Decide first how much of the account a single trade may lose. Then measure the distance from entry to stop. Position size is what makes those two numbers agree.</p><h2>The order matters</h2><p>Sizing first and placing the stop wherever it fits the size is the most common way a plan quietly stops being a plan.</p>",
            },
            {
              // The external-resource lesson (ADR-055 #5). It carries no body:
              // `externalUrl` is its single capability, which is exactly the
              // case `lessonInputSchema` must accept and an empty lesson must
              // not. Optional, so it does not gate course completion.
              slug: "further-reading-bis-survey",
              title: "Further reading: the BIS triennial survey",
              summary: "The primary source on how large the market actually is.",
              minutes: 15,
              externalUrl: "https://www.bis.org/statistics/rpfx22.htm",
              isRequired: false,
            },
          ],
        },
      ],
    },
    {
      track: "crypto",
      slug: "crypto-foundations",
      title: "Crypto Foundations",
      summary: "What a blockchain actually does, and how crypto markets differ from forex.",
      difficulty: "BEGINNER",
      estimatedHours: 3,
      sections: [
        {
          slug_: "how-blockchains-work",
          title: "How Blockchains Work",
          description: "The mechanism underneath, without the marketing.",
          lessons: [
            {
              slug: "what-a-blockchain-is",
              title: "What a blockchain is",
              summary: "A shared ledger that nobody in particular runs.",
              minutes: 7,
              content:
                "<p>A blockchain is a ledger copied across many independent machines, where new entries are appended in batches and each batch is linked to the one before it.</p><p>The useful property is not secrecy — most are fully public — but that no single participant can quietly rewrite history.</p>",
            },
            {
              slug: "wallets-keys-and-custody",
              title: "Wallets, keys and custody",
              summary: "Who actually controls a balance, and what that costs you.",
              minutes: 8,
              content:
                "<p>A wallet stores keys, not coins. The private key authorises spending, so whoever holds it controls the balance.</p><h2>Custody is a real choice</h2><p>Holding your own keys removes counterparty risk and adds the risk that you lose them. Neither option is the safe one by default.</p>",
            },
          ],
        },
        {
          slug_: "crypto-markets",
          title: "Crypto Markets",
          description: "Where these assets trade, and how that differs from FX.",
          lessons: [
            {
              slug: "exchanges-and-liquidity",
              title: "Exchanges and liquidity",
              summary: "Why the same asset shows different prices in different places.",
              minutes: 6,
              content:
                "<p>Crypto trades on many venues at once, each with its own order book. Prices converge through arbitrage but rarely match exactly.</p><p>Thin books move further on the same order size, which is why liquidity matters more than headline volume.</p>",
            },
            {
              slug: "volatility-and-position-sizing",
              title: "Volatility and position sizing",
              summary: "Applying the forex risk lesson to a much wider range.",
              minutes: 7,
              content:
                "<p>The sizing arithmetic is identical to forex; only the distances change. A stop placed at a forex distance on a crypto pair is usually inside the ordinary daily range.</p><p>Size from the instrument's own volatility, not from a habit formed on another one.</p>",
            },
          ],
        },
        {
          slug_: "staying-safe",
          title: "Staying Safe",
          description: "The failure modes that cost beginners the most.",
          lessons: [
            {
              slug: "common-scams-and-red-flags",
              title: "Common scams and red flags",
              summary: "The patterns behind most avoidable losses.",
              minutes: 6,
              content:
                "<p>Guaranteed returns, urgency, and a request to move funds off-platform are the three signals present in most crypto fraud.</p><p>No legitimate service needs your private key or seed phrase. There is no exception to that sentence.</p>",
            },
          ],
        },
      ],
    },
  ] as const;

  let seededCourses = 0;
  let seededLessons = 0;
  for (const course of DEMO_COURSES) {
    const existing = await db.courseTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: course.slug } },
      select: { courseId: true },
    });
    if (existing) continue; // idempotent: never clobber admin edits to a demo course

    const lessonCount = course.sections.reduce((n, sec) => n + sec.lessons.length, 0);
    const created = await db.course.create({
      data: {
        track: course.track,
        difficulty: course.difficulty,
        estimatedHours: course.estimatedHours,
        status: "PUBLISHED",
        publishedAt: new Date(),
        sortOrder: seededCourses,
        lessonCount,
        translations: {
          create: {
            locale: "en",
            title: course.title,
            slug: course.slug,
            summary: course.summary,
            translationStatus: "TRANSLATED",
          },
        },
      },
      select: { id: true },
    });

    for (const [sectionIndex, section] of course.sections.entries()) {
      const createdSection = await db.courseSection.create({
        data: {
          courseId: created.id,
          sortOrder: sectionIndex,
          isPublished: true,
          translations: {
            create: { locale: "en", title: section.title, description: section.description },
          },
        },
        select: { id: true },
      });

      for (const [lessonIndex, lesson] of section.lessons.entries()) {
        await db.lesson.create({
          data: {
            sectionId: createdSection.id,
            difficulty: course.difficulty,
            estimatedMinutes: lesson.minutes,
            videoUrl: "videoUrl" in lesson ? lesson.videoUrl : null,
            externalUrl: "externalUrl" in lesson ? lesson.externalUrl : null,
            isRequired: "isRequired" in lesson ? lesson.isRequired : true,
            sortOrder: lessonIndex,
            status: "PUBLISHED",
            publishedAt: new Date(),
            translations: {
              create: {
                locale: "en",
                title: lesson.title,
                slug: lesson.slug,
                summary: lesson.summary,
                content: "content" in lesson ? lesson.content : null,
                translationStatus: "TRANSLATED",
              },
            },
          },
        });
        seededLessons += 1;
      }
    }
    seededCourses += 1;
  }
  console.log(
    `  learn: ${seededCourses} demo course(s), ${seededLessons} lesson(s) — tracks ${DEMO_COURSES.map((c) => c.track).join(", ")}`,
  );

  // ─────────────────────────────────────────────────────────────
  // LEARN AREA — a demo quiz (changes-11 Phase 6, ADR-058)
  //
  // One standalone quiz, published, so `/learn/quizzes` has something on it
  // after a reset and the whole attempt path — start, answer, submit, review —
  // is exercisable without an editor authoring one first.
  //
  // It is STANDALONE and attached to nothing. Attaching it to a demo lesson
  // would seed a `QUIZ_PASS` completion rule into a course whose other lessons
  // are MANUAL, which is a confusing default to hand someone opening the admin
  // for the first time. Attaching one is two clicks in the lesson editor.
  //
  // `correctAnswer` is a plain index into `options` (ADR-058 #2), stored on the
  // untranslated question row — never on the translation.
  // ─────────────────────────────────────────────────────────────
  const DEMO_QUIZ = {
    // ADR-065 §3 — required: the quiz's URL is /learn/<track>/quizzes/<slug>.
    track: "forex",
    slug: "forex-basics-check",
    title: "Forex basics: a quick check",
    description:
      "Six questions on the vocabulary the first course assumes. Nothing here is a trick.",
    category: "forex-basics",
    passingScore: 70,
    questions: [
      {
        type: "SINGLE_CHOICE" as const,
        prompt: "What does a currency PAIR quote actually tell you?",
        options: [
          "How much of the quote currency one unit of the base currency buys",
          "The total daily volume in that currency",
          "The interest rate difference between the two countries",
          "How many brokers offer that pair",
        ],
        correct: 0,
        explanations: [
          "EUR/USD at 1.08 means one euro buys 1.08 dollars. Base first, quote second.",
          "",
          "That is the carry, which affects a pair's cost to hold but is not the quote.",
          "",
        ],
      },
      {
        type: "TRUE_FALSE" as const,
        prompt: "A pip is the same size on every currency pair.",
        options: ["True", "False"],
        correct: 1,
        explanations: [
          "",
          "Most pairs move in 0.0001 steps, but JPY pairs quote to two decimals, so a pip there is 0.01.",
        ],
      },
      {
        type: "SINGLE_CHOICE" as const,
        prompt: "Leverage of 1:30 means…",
        options: [
          "Your profits are multiplied by 30 and your losses are not",
          "You can control a position 30 times your deposit — losses scale with it",
          "The broker pays 30% of any loss",
          "You may hold a position for 30 days",
        ],
        correct: 1,
        explanations: [
          "Leverage is symmetric. Anything that claims otherwise is selling something.",
          "The position size scales, and so does every pip against you.",
          "",
          "",
        ],
      },
      {
        type: "MULTIPLE_CHOICE" as const,
        prompt: "Which of these are costs of holding a leveraged position overnight?",
        options: [
          "The spread you paid to enter",
          "The overnight financing (swap)",
          "A fee for closing in profit",
          "Slippage if the market gaps",
        ],
        correct: [1, 3],
        explanations: [
          "Real, but paid on entry rather than for holding.",
          "Charged or paid every night the position stays open.",
          "No such thing — if a broker charges one, that is the product, not the market.",
          "A gap can fill your stop worse than where you set it.",
        ],
      },
      {
        type: "TRUE_FALSE" as const,
        prompt: "A stop-loss order guarantees you exit at exactly your stop price.",
        options: ["True", "False"],
        correct: 1,
        explanations: [
          "",
          "It becomes a market order when touched. In a gap it fills at the next available price.",
        ],
      },
      {
        type: "SINGLE_CHOICE" as const,
        prompt: "The forex market is open 24 hours a day because…",
        options: [
          "One global exchange never closes",
          "Trading passes between financial centres around the world",
          "Brokers hold orders overnight and fill them in the morning",
          "Central banks operate around the clock",
        ],
        correct: 1,
        explanations: [
          "There is no central exchange at all — that is the point.",
          "Sydney, then Tokyo, then London, then New York. The handover is why liquidity varies by hour.",
          "",
          "",
        ],
      },
    ],
  };

  // The crypto school's own (ADR-065 §1). Both indexes are per-track now, so
  // one seeded quiz would leave "Learn Crypto → Quizzes" empty on a fresh
  // database — an empty state where the nav promised content reads as a bug
  // rather than as a choice.
  const DEMO_QUIZ_CRYPTO = {
    track: "crypto",
    slug: "crypto-basics-check",
    title: "Crypto basics: a quick check",
    description: "Three questions on the vocabulary the crypto course assumes.",
    category: "crypto-basics",
    passingScore: 70,
    questions: [
      {
        type: "SINGLE_CHOICE" as const,
        prompt: "What does a blockchain actually store?",
        options: [
          "An ordered, append-only record of transactions",
          "The current balance of every wallet, and nothing else",
          "A copy of every user's identity documents",
          "The price history of the asset",
        ],
        correct: 0,
        explanations: [
          "Balances are DERIVED by replaying the record — the record itself is the ledger.",
          "Balances are computed from the history, not stored in place of it.",
          "",
          "Prices live on exchanges, which are not the chain.",
        ],
      },
      {
        type: "TRUE_FALSE" as const,
        prompt: "A transaction confirmed on-chain can be reversed by the sender.",
        options: ["True", "False"],
        correct: 1,
        explanations: [
          "",
          "Settlement is final. A mistaken transfer is recovered only if the recipient sends it back.",
        ],
      },
      {
        type: "SINGLE_CHOICE" as const,
        prompt: "What is a private key?",
        options: [
          "The secret that authorises spending from an address",
          "The address others send funds to",
          "A password held by the exchange on your behalf",
          "A backup of the blockchain",
        ],
        correct: 0,
        explanations: [
          "Whoever holds it can spend the funds — which is the whole of self-custody.",
          "That is the PUBLIC address, safe to share.",
          "That is a custodial account, where the exchange holds the key instead.",
          "",
        ],
      },
    ],
  };

  for (const spec of [DEMO_QUIZ, DEMO_QUIZ_CRYPTO]) {
    const existingQuiz = await db.quizTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: spec.slug } },
      select: { quizId: true },
    });
    if (existingQuiz) continue;

    const quiz = await db.quiz.create({
      data: {
        track: spec.track,
        passingScore: spec.passingScore,
        showAnswersAfter: "AFTER_SUBMIT",
        isStandalone: true,
        category: spec.category,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publishedAt: new Date(),
        translations: {
          create: {
            locale: "en",
            title: spec.title,
            slug: spec.slug,
            description: spec.description,
            translationStatus: "TRANSLATED",
          },
        },
      },
    });

    for (const [index, question] of spec.questions.entries()) {
      await db.quizQuestion.create({
        data: {
          quizId: quiz.id,
          type: question.type,
          sortOrder: index,
          points: 1,
          correctAnswer: question.correct,
          translations: {
            create: {
              locale: "en",
              prompt: question.prompt,
              options: question.options,
              explanations: question.explanations,
            },
          },
        },
      });
    }
    console.log(`  quiz: ${spec.slug} (published, ${spec.questions.length} questions)`);
  }

  // ─────────────────────────────────────────────────────────────
  // GLOSSARY — topics and terms (ADR-069)
  //
  // The glossary shipped its admin, its A–Z, its topic routes and its term
  // pages with NO seeded content, so every one of those surfaces rendered its
  // empty state on a fresh database and `/glossary/topics` could not render at
  // all. This block is the starter set.
  //
  // These are NOT placeholder facts in ADR-051's sense. That ADR quarantines
  // claims about MBX — awards, capital, regulation — because a demo value
  // surviving into production would be read as an assertion about the company.
  // A definition of "pip" asserts nothing about MBX; it is educational content
  // of exactly the kind the admin exists to edit, and it is correct as written.
  // So it lives here, not behind a content-mode switch.
  //
  // Idempotent via the [locale, slug] uniqueness on glossary_term_translations
  // and glossary_topic_translations — the same key the article taxonomy and
  // the demo courses use. An existing slug is SKIPPED, never updated, so a
  // re-seed cannot clobber an editor's rewording.
  //
  // `track` and `difficulty` are plain strings, not imports from
  // @repo/contracts: packages/db must not depend on packages/contracts
  // (architecture.md #8 points core -> db/contracts, never db -> contracts).
  //
  // `sourceHash` is left null, exactly as the demo courses leave it —
  // `computeSourceHash` lives in @repo/i18n and db cannot import it either.
  // Nothing breaks: the hash is written on the first admin save, and there are
  // no non-English translations here for a stale hash to mislead.
  //
  // A term with `topic: null` is UNFILED and appears only in the A–Z; a term
  // with `track: null` belongs to EVERY school (ADR-065 §3). The two nulls are
  // not the same thing, and the set below uses both deliberately.
  // ─────────────────────────────────────────────────────────────
  const GLOSSARY_TOPICS = [
    {
      slug: "trading-basics",
      name: "Trading basics",
      description: "The vocabulary every new trader meets in the first week.",
    },
    {
      slug: "orders-and-execution",
      name: "Orders & execution",
      description: "How an instruction becomes a position, and what can happen in between.",
    },
    {
      slug: "risk-management",
      name: "Risk management",
      description: "Sizing a position, protecting it, and measuring what went wrong.",
    },
    {
      slug: "technical-analysis",
      name: "Technical analysis",
      description: "Reading price itself — charts, levels and the patterns traders watch.",
    },
    {
      slug: "market-fundamentals",
      name: "Market fundamentals",
      description: "The economics behind a price: rates, data releases and capital flows.",
    },
    {
      slug: "crypto",
      name: "Crypto",
      description: "Terms specific to digital assets and the networks they settle on.",
    },
  ];

  interface SeedGlossaryTerm {
    slug: string;
    term: string;
    /** A GLOSSARY_TOPICS slug, or null for unfiled. */
    topic: string | null;
    /** A LEARN_TRACKS key, or null for "every school". */
    track: string | null;
    difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    simple: string;
    detailed?: string;
    advanced?: string;
    example?: string;
    formula?: string;
    faq?: { question: string; answer: string }[];
  }

  const GLOSSARY_TERMS: SeedGlossaryTerm[] = [
    {
      slug: "accrual",
      term: "Accrual",
      topic: null,
      track: "forex",
      difficulty: "ADVANCED",
      simple:
        "<p>Accrual is the apportionment of premiums or discounts on a forward foreign exchange contract over the life of that contract, rather than all at once.</p>",
    },
    {
      slug: "altcoin",
      term: "Altcoin",
      topic: "crypto",
      track: "crypto",
      difficulty: "BEGINNER",
      simple:
        "<p>An altcoin is any cryptocurrency other than Bitcoin. The term covers everything from large established networks to tokens with almost no trading activity.</p>",
      detailed:
        "<p>The label says nothing about quality. It is a category defined by exclusion, so it groups assets with very different technology, liquidity and risk under one word.</p>",
    },
    {
      slug: "arbitrage",
      term: "Arbitrage",
      topic: "market-fundamentals",
      track: null,
      difficulty: "ADVANCED",
      simple:
        "<p>Arbitrage is buying and selling the same asset in two places at once to capture a price difference between them.</p>",
      detailed:
        "<p>True arbitrage is close to riskless in theory and rare in practice: the price gaps that make it possible are small, short-lived, and usually closed by automated systems before a manual trader can act.</p>",
      advanced:
        "<p>Execution risk is what turns a textbook arbitrage into a loss. If one leg fills and the other does not, the position is no longer hedged — it is an outright directional bet nobody intended to take.</p>",
    },
    {
      slug: "ask",
      term: "Ask",
      topic: "trading-basics",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>The ask, also called the offer, is the price at which you can buy a market. It is always the higher of the two prices on a quote.</p>",
      example:
        "<p>If EUR/USD is quoted 1.0850 / 1.0851, the ask is 1.0851 — that is what you pay to open a buy.</p>",
    },
    {
      slug: "base-currency",
      term: "Base currency",
      topic: "trading-basics",
      track: "forex",
      difficulty: "BEGINNER",
      simple:
        "<p>The base currency is the first currency named in a pair. The price shows how much of the second currency one unit of the base is worth.</p>",
      example:
        "<p>In EUR/USD the base is the euro. A price of 1.0850 means one euro buys 1.0850 US dollars.</p>",
    },
    {
      slug: "bear-market",
      term: "Bear market",
      topic: "market-fundamentals",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A bear market is a sustained period of falling prices, usually accompanied by weak sentiment and falling participation.</p>",
      detailed:
        "<p>A common rule of thumb is a decline of 20% or more from a recent peak, but the threshold is a convention rather than a definition — what matters is the direction and persistence of the trend.</p>",
    },
    {
      slug: "bid",
      term: "Bid",
      topic: "trading-basics",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>The bid is the price at which you can sell a market. It is always the lower of the two prices on a quote.</p>",
      example:
        "<p>If EUR/USD is quoted 1.0850 / 1.0851, the bid is 1.0850 — that is what you receive if you sell.</p>",
    },
    {
      slug: "blockchain",
      term: "Blockchain",
      topic: "crypto",
      track: "crypto",
      difficulty: "BEGINNER",
      simple:
        "<p>A blockchain is a shared record of transactions maintained by a network of computers rather than by a single institution.</p>",
      detailed:
        "<p>Transactions are grouped into blocks, and each block references the one before it. Rewriting an old block would mean redoing every block after it, which is what makes settled history expensive to alter.</p>",
      faq: [
        {
          question: "Is a blockchain the same thing as a cryptocurrency?",
          answer:
            "No. The blockchain is the ledger; the cryptocurrency is one asset recorded on it. A network can carry many assets.",
        },
      ],
    },
    {
      slug: "bull-market",
      term: "Bull market",
      topic: "market-fundamentals",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A bull market is a sustained period of rising prices, usually accompanied by improving sentiment and broad participation.</p>",
    },
    {
      slug: "candlestick",
      term: "Candlestick",
      topic: "technical-analysis",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A candlestick summarises the price action of one time period as a single shape showing the open, high, low and close.</p>",
      detailed:
        "<p>The body spans the open and close; the thin wicks above and below show the extremes the price reached but did not hold. A long wick therefore records a level that was tested and rejected.</p>",
    },
    {
      slug: "cfd",
      term: "CFD",
      topic: "trading-basics",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A contract for difference (CFD) is an agreement to exchange the difference in an asset's price between opening and closing a position, without owning the asset itself.</p>",
      detailed:
        "<p>Because there is no delivery, CFDs can be traded in both directions and are usually leveraged. That also means you hold a contract with a provider rather than the underlying instrument.</p>",
      advanced:
        "<p>CFDs are not available to retail traders in every jurisdiction, and where they are, leverage limits and margin close-out rules differ. Availability is a regulatory question, not a product one.</p>",
    },
    {
      slug: "cross-rate",
      term: "Cross rate",
      topic: "trading-basics",
      track: "forex",
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A cross rate is the exchange rate between two currencies where neither is the US dollar.</p>",
      example: "<p>EUR/GBP and AUD/JPY are cross rates; EUR/USD is not.</p>",
    },
    {
      slug: "divergence",
      term: "Divergence",
      topic: "technical-analysis",
      track: null,
      difficulty: "ADVANCED",
      simple:
        "<p>Divergence is when price and an indicator move in opposite directions — for example price making a higher high while the indicator makes a lower one.</p>",
      detailed:
        "<p>It is read as a sign that the move is losing momentum. It is not a signal on its own: divergence can persist for a long time while a strong trend continues.</p>",
    },
    {
      slug: "drawdown",
      term: "Drawdown",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Drawdown is the decline from a peak in account value to the lowest point that follows, before a new peak is reached.</p>",
      detailed:
        "<p>It is usually quoted as a percentage, and it measures the worst stretch an account actually lived through rather than its end result.</p>",
      advanced:
        "<p>Recovery is not symmetric with the loss. A 50% drawdown needs a 100% gain to get back to even, which is why limiting the depth of a drawdown matters more than the speed of the recovery.</p>",
      example:
        "<p>An account that grows to $12,000, falls to $9,000, then recovers has suffered a 25% drawdown.</p>",
    },
    {
      slug: "equity",
      term: "Equity",
      topic: "risk-management",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>Equity is the current value of a trading account: the cash balance plus or minus the profit and loss on every position still open.</p>",
      detailed:
        "<p>Balance only changes when a position is closed. Equity moves with the market, which is why margin is measured against equity and not against balance.</p>",
      formula: "equity = balance + unrealised profit/loss",
    },
    {
      slug: "exotic-pair",
      term: "Exotic pair",
      topic: "trading-basics",
      track: "forex",
      difficulty: "INTERMEDIATE",
      simple:
        "<p>An exotic pair couples a major currency with one from a smaller or less heavily traded economy.</p>",
      detailed:
        "<p>Exotics typically carry wider spreads and thinner liquidity than majors, so the cost of entering and the risk of slippage are both higher.</p>",
    },
    {
      slug: "fill",
      term: "Fill",
      topic: "orders-and-execution",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A fill is the execution of an order. An order is filled when it has been matched at a price and the position exists.</p>",
      detailed:
        "<p>An order can also be partially filled, where only some of the requested size is executed because there was not enough available at that price.</p>",
    },
    {
      slug: "forex",
      term: "Forex",
      topic: "trading-basics",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>Forex, also known as foreign exchange or FX, is the conversion of one country's currency into another. It forms the basis of forex trading, one of the world's most-traded asset classes.</p>",
      detailed:
        "<p>Foreign exchange happens globally between a network of banks, brokers and other institutions. Unlike a stock exchange there is no central venue — trades take place directly between two parties, which is why the market runs 24 hours a day, five days a week.</p><p>While the market is used by companies and travellers who genuinely need the currency, most participants are trading it to profit from changes in the rate rather than to take delivery.</p>",
      faq: [
        {
          question: "When is the forex market open?",
          answer:
            "Continuously from Sunday evening to Friday evening, moving between the Asian, European and North American sessions. It closes over the weekend.",
        },
        {
          question: "Which pair is traded most?",
          answer: "EUR/USD is consistently the most heavily traded currency pair.",
        },
      ],
    },
    {
      slug: "fundamental-analysis",
      term: "Fundamental analysis",
      topic: "market-fundamentals",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Fundamental analysis studies the economic conditions behind a price — interest rates, growth, inflation and policy — to judge what an asset should be worth.</p>",
      detailed:
        "<p>For currencies it centres on relative conditions: a currency is strong or weak against another, so what matters is the difference between two economies rather than the state of either alone.</p>",
    },
    {
      slug: "gap",
      term: "Gap",
      topic: "technical-analysis",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A gap is a jump in price with no trading in between, leaving a visible break on the chart.</p>",
      detailed:
        "<p>In forex, gaps most often appear at the Sunday open after news over the weekend. A stop-loss cannot protect against the gap itself: the next available price may be well beyond the level set.</p>",
    },
    {
      slug: "hedging",
      term: "Hedging",
      topic: "risk-management",
      track: null,
      difficulty: "ADVANCED",
      simple:
        "<p>Hedging is opening a position designed to offset the risk of another one, reducing exposure rather than seeking profit.</p>",
      detailed:
        "<p>A hedge has a cost — the spread, the financing, or the gains given up if the original position was right. It buys a reduction in uncertainty, not a better expected outcome.</p>",
    },
    {
      slug: "interest-rate-differential",
      term: "Interest rate differential",
      topic: "market-fundamentals",
      track: "forex",
      difficulty: "ADVANCED",
      simple:
        "<p>The interest rate differential is the gap between the policy interest rates of the two economies in a currency pair.</p>",
      detailed:
        "<p>It is the main driver of the financing charged or paid for holding a position overnight, and a long-running influence on the direction of the pair itself.</p>",
    },
    {
      slug: "leverage",
      term: "Leverage",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Leverage lets you control a position larger than your own capital would allow, with the balance effectively provided by your broker.</p>",
      detailed:
        "<p>It is expressed as a ratio. At 1:30, one unit of your own money controls thirty units of the market. The ratio applies to gains and losses equally.</p>",
      advanced:
        "<p>Higher leverage does not raise expected return; it raises variance. What it reliably shortens is the distance between the entry price and a margin close-out, which is why a leveraged position can be closed at a loss by a move the trader would otherwise have survived.</p>",
      example:
        "<p>With $1,000 and 1:30 leverage you can open a $30,000 position. A 1% move against you is a $300 loss — 30% of your capital.</p>",
      faq: [
        {
          question: "Does more leverage mean more profit?",
          answer:
            "No. It magnifies profit and loss by the same factor, and it brings a margin close-out closer.",
        },
      ],
    },
    {
      slug: "limit-order",
      term: "Limit order",
      topic: "orders-and-execution",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A limit order is an instruction to trade at a specified price or better, and never worse.</p>",
      detailed:
        "<p>It controls the price you get but not whether you trade at all: if the market never reaches the level, the order simply does not fill.</p>",
      example:
        "<p>With EUR/USD at 1.0850, a buy limit at 1.0800 waits for the price to fall. It executes at 1.0800 or lower, or not at all.</p>",
    },
    {
      slug: "liquidity",
      term: "Liquidity",
      topic: "trading-basics",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Liquidity is how easily a market can absorb a trade without the price moving much against you.</p>",
      detailed:
        "<p>Liquid markets show tight spreads and reliable fills. Liquidity is not constant: it thins around major news, public holidays and the daily rollover, which is when slippage is most likely.</p>",
    },
    {
      slug: "long-position",
      term: "Long position",
      topic: "trading-basics",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A long position profits if the price rises. Going long means buying with the expectation of selling higher.</p>",
    },
    {
      slug: "lot",
      term: "Lot",
      topic: "trading-basics",
      track: "forex",
      difficulty: "BEGINNER",
      simple: "<p>A lot is the standard unit of trade size in forex.</p>",
      detailed:
        "<p>A standard lot is 100,000 units of the base currency. A mini lot is 10,000 and a micro lot is 1,000, which is what lets a small account take a position at all.</p>",
    },
    {
      slug: "margin",
      term: "Margin",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Margin is the portion of your own capital a broker requires you to set aside as collateral to keep a leveraged position open.</p>",
      detailed:
        "<p>It is not a fee and it is not spent. It is your money, held aside while the position is open and released when it closes.</p>",
    },
    {
      slug: "margin-call",
      term: "Margin call",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A margin call is the warning that your account equity has fallen too close to the margin required to keep your positions open.</p>",
      detailed:
        "<p>If equity keeps falling, positions are closed automatically at a level set by the broker. The close-out is not a request — it happens whether or not the warning was seen.</p>",
    },
    {
      slug: "market-order",
      term: "Market order",
      topic: "orders-and-execution",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A market order is an instruction to trade immediately at the best price currently available.</p>",
      detailed:
        "<p>It is the mirror image of a limit order: it guarantees that you trade, but not the price you get. In a fast market the fill can differ from the price on screen.</p>",
    },
    {
      slug: "moving-average",
      term: "Moving average",
      topic: "technical-analysis",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A moving average is the average price over a set number of recent periods, recalculated as each new period closes.</p>",
      detailed:
        "<p>It smooths short-term noise to make the underlying direction easier to read. Every moving average lags by design — it describes what price has already done.</p>",
    },
    {
      slug: "non-farm-payrolls",
      term: "Non-farm payrolls",
      topic: "market-fundamentals",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Non-farm payrolls (NFP) is a monthly United States employment report counting jobs added or lost outside farming, private households and non-profits.</p>",
      detailed:
        "<p>It is released on the first Friday of most months and is one of the most closely watched data points in the calendar, because employment feeds directly into expectations for interest rates.</p>",
    },
    {
      slug: "order-book",
      term: "Order book",
      topic: "orders-and-execution",
      track: null,
      difficulty: "ADVANCED",
      simple:
        "<p>An order book is the list of outstanding buy and sell orders for a market, arranged by price.</p>",
      detailed:
        "<p>It shows where resting interest sits on each side. Because forex trades over the counter rather than on one central exchange, no single complete order book for a currency pair exists.</p>",
    },
    {
      slug: "pip",
      term: "Pip",
      topic: "trading-basics",
      track: "forex",
      difficulty: "BEGINNER",
      simple:
        "<p>A pip is the smallest standard increment by which a currency pair's price is quoted — normally the fourth decimal place.</p>",
      detailed:
        "<p>For most pairs one pip is 0.0001. For pairs quoted against the Japanese yen it is 0.01, because those are quoted to two decimal places rather than four.</p>",
      example:
        "<p>EUR/USD moving from 1.0850 to 1.0851 is a one-pip move. On a standard lot of 100,000 units that is about $10.</p>",
      formula: "pip value = (one pip / exchange rate) x position size",
      faq: [
        {
          question: "What is a pipette?",
          answer:
            "A tenth of a pip — the fifth decimal place on most pairs. Many brokers quote it for finer pricing.",
        },
      ],
    },
    {
      slug: "position-sizing",
      term: "Position sizing",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Position sizing is deciding how large a trade should be, based on how much you are prepared to lose if it goes wrong.</p>",
      detailed:
        "<p>The size follows from the stop, not the other way round: fix the risk per trade and the distance to the stop, and the correct size is whatever satisfies both.</p>",
      formula: "position size = (account risk amount) / (stop distance x value per unit)",
    },
    {
      slug: "pullback",
      term: "Pullback",
      topic: "technical-analysis",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A pullback is a temporary move against the prevailing trend before that trend resumes.</p>",
      detailed:
        "<p>The difficulty is that a pullback and the start of a reversal look identical while they are happening. The distinction is only clear afterwards.</p>",
    },
    {
      slug: "quote-currency",
      term: "Quote currency",
      topic: "trading-basics",
      track: "forex",
      difficulty: "BEGINNER",
      simple:
        "<p>The quote currency is the second currency named in a pair — the one the price is expressed in.</p>",
      example: "<p>In EUR/USD the quote currency is the US dollar, so the price is in dollars.</p>",
    },
    {
      slug: "resistance",
      term: "Resistance",
      topic: "technical-analysis",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>Resistance is a price area where selling has repeatedly been strong enough to stop a rise.</p>",
      detailed:
        "<p>Resistance that gives way often acts as support afterwards, as traders who expected the level to hold reassess it.</p>",
    },
    {
      slug: "risk-reward-ratio",
      term: "Risk-reward ratio",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>The risk-reward ratio compares what a trade stands to lose if the stop is hit with what it stands to gain if the target is reached.</p>",
      advanced:
        "<p>The ratio is meaningless without a win rate beside it. A 1:3 setup that works one time in five loses money; a 1:1 setup that works two times in three makes it.</p>",
      formula: "risk-reward = (target distance) : (stop distance)",
    },
    {
      slug: "rollover",
      term: "Rollover",
      topic: "trading-basics",
      track: "forex",
      difficulty: "ADVANCED",
      simple:
        "<p>Rollover is the process of carrying an open position past the end of the trading day, which incurs an interest adjustment known as a swap.</p>",
      detailed:
        "<p>The adjustment reflects the interest rate difference between the two currencies. Depending on the direction of the position it can be a charge or a credit.</p>",
    },
    {
      slug: "scalping",
      term: "Scalping",
      topic: "trading-basics",
      track: null,
      difficulty: "ADVANCED",
      simple:
        "<p>Scalping is a style of trading that takes many small profits from very short holding periods.</p>",
      detailed:
        "<p>Because each target is small, transaction costs dominate the outcome. A spread that is negligible for a position held for weeks can make a scalping strategy unprofitable outright.</p>",
    },
    {
      slug: "short-selling",
      term: "Short selling",
      topic: "trading-basics",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Short selling is taking a position that profits if the price falls. In forex, selling one currency is always buying the other.</p>",
    },
    {
      slug: "slippage",
      term: "Slippage",
      topic: "orders-and-execution",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Slippage is the difference between the price you expected and the price your order actually filled at.</p>",
      detailed:
        "<p>It happens when the market moves between sending an order and executing it, and it is most common around news releases and at thin points in the session. It can go either way, though it is noticed more often when it goes against you.</p>",
    },
    {
      slug: "spread",
      term: "Spread",
      topic: "trading-basics",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>The spread is the difference between the bid and the ask — in practice, the cost of opening a trade.</p>",
      detailed:
        "<p>A position starts slightly behind by the width of the spread, and has to move that far in your favour to break even. Spreads widen when liquidity falls, such as around major news or at the daily rollover.</p>",
      example:
        "<p>A quote of 1.0850 / 1.0851 is a one-pip spread. Buy at the ask and the position shows a one-pip loss immediately.</p>",
    },
    {
      slug: "stablecoin",
      term: "Stablecoin",
      topic: "crypto",
      track: "crypto",
      difficulty: "INTERMEDIATE",
      simple:
        "<p>A stablecoin is a cryptocurrency designed to hold a steady value, usually by tracking a national currency such as the US dollar.</p>",
      detailed:
        "<p>Different stablecoins hold their peg in different ways — reserves of cash and bonds, collateral in other crypto assets, or an algorithm. The mechanism is what determines the risk, and pegs have failed before.</p>",
    },
    {
      slug: "stop-loss-order",
      term: "Stop-loss order",
      topic: "orders-and-execution",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A stop-loss order closes a position automatically once the price reaches a level you set against you, capping the loss on that trade.</p>",
      detailed:
        "<p>A standard stop becomes a market order when triggered, so the fill can be worse than the level in a fast market or over a weekend gap. A guaranteed stop removes that risk for a fee.</p>",
      faq: [
        {
          question: "Does a stop-loss guarantee my maximum loss?",
          answer:
            "Not on its own. A standard stop is filled at the next available price, which can be beyond your level if the market gaps.",
        },
      ],
    },
    {
      slug: "support",
      term: "Support",
      topic: "technical-analysis",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>Support is a price area where buying has repeatedly been strong enough to halt a decline.</p>",
      detailed:
        "<p>Support that breaks often becomes resistance afterwards — the same level, read from the other side.</p>",
    },
    {
      slug: "take-profit-order",
      term: "Take-profit order",
      topic: "orders-and-execution",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A take-profit order closes a position automatically once the price reaches a level in your favour, banking the gain without you having to watch.</p>",
    },
    {
      slug: "technical-analysis",
      term: "Technical analysis",
      topic: "technical-analysis",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Technical analysis studies price and volume history itself — through charts, levels and indicators — rather than the economics behind the price.</p>",
      detailed:
        "<p>It rests on the premise that price already reflects what is known, and that the behaviour of participants leaves repeatable patterns. Every technical tool is descriptive of the past; none of them is a forecast.</p>",
    },
    {
      slug: "trend",
      term: "Trend",
      topic: "technical-analysis",
      track: null,
      difficulty: "BEGINNER",
      simple:
        "<p>A trend is a sustained direction in price — a series of higher highs and higher lows upward, or lower highs and lower lows downward.</p>",
    },
    {
      slug: "volatility",
      term: "Volatility",
      topic: "risk-management",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Volatility measures how much and how quickly a price moves over a period. High volatility means larger swings in both directions.</p>",
      detailed:
        "<p>Realised volatility looks backwards at what a price actually did. Implied volatility is what the options market expects it to do next.</p>",
      advanced:
        "<p>Volatility clusters: large moves tend to be followed by large moves, and quiet periods by quiet ones. A fixed position size therefore carries very different real risk in different regimes, which is the argument for sizing against volatility rather than against account balance.</p>",
    },
    {
      slug: "volume",
      term: "Volume",
      topic: "technical-analysis",
      track: null,
      difficulty: "INTERMEDIATE",
      simple: "<p>Volume is the amount traded in a market over a given period.</p>",
      detailed:
        "<p>Because forex has no central exchange, the volume shown on a chart is the broker's or platform's own activity rather than the whole market. It is a sample, and a useful one, but not a total.</p>",
    },
    {
      slug: "wallet",
      term: "Wallet",
      topic: "crypto",
      track: "crypto",
      difficulty: "BEGINNER",
      simple:
        "<p>A crypto wallet stores the private keys that prove ownership of assets on a blockchain. The assets stay on the network; the wallet holds the means to move them.</p>",
      detailed:
        "<p>A hot wallet is connected to the internet and convenient; a cold wallet is kept offline and harder to compromise. Losing the keys means losing access, and no one can restore them for you.</p>",
      faq: [
        {
          question: "Can anyone recover my wallet if I lose the seed phrase?",
          answer:
            "No. There is no reset and no support line that can restore it. Anyone claiming otherwise is attempting fraud.",
        },
      ],
    },
    {
      slug: "yield",
      term: "Yield",
      topic: "market-fundamentals",
      track: null,
      difficulty: "INTERMEDIATE",
      simple:
        "<p>Yield is the return an asset produces, expressed as a percentage of its price.</p>",
      detailed:
        "<p>Government bond yields matter to currency traders because they price the market's expectations for interest rates, and rate expectations are one of the strongest influences on exchange rates.</p>",
    },
  ];

  const glossaryTopicIds = new Map<string, string>();
  for (const [index, topic] of GLOSSARY_TOPICS.entries()) {
    const existing = await db.glossaryTopicTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: topic.slug } },
      select: { topicId: true },
    });
    if (existing) {
      glossaryTopicIds.set(topic.slug, existing.topicId);
      continue;
    }
    const created = await db.glossaryTopic.create({
      data: {
        isActive: true,
        sortOrder: index,
        translations: {
          create: {
            locale: "en",
            name: topic.name,
            slug: topic.slug,
            description: topic.description,
          },
        },
      },
      select: { id: true },
    });
    glossaryTopicIds.set(topic.slug, created.id);
  }

  let seededTerms = 0;
  for (const entry of GLOSSARY_TERMS) {
    const existing = await db.glossaryTermTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: entry.slug } },
      select: { id: true },
    });
    if (existing) continue; // idempotent: never clobber an editor's rewording

    await db.glossaryTerm.create({
      data: {
        topicId: entry.topic === null ? null : (glossaryTopicIds.get(entry.topic) ?? null),
        track: entry.track,
        difficulty: entry.difficulty,
        formula: entry.formula ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        translations: {
          create: {
            locale: "en",
            term: entry.term,
            slug: entry.slug,
            simpleExplanation: entry.simple,
            detailedExplanation: entry.detailed ?? null,
            advancedExplanation: entry.advanced ?? null,
            exampleScenario: entry.example ?? null,
            // Prisma reads `undefined` on a Json? column as "leave it alone",
            // which on a create means SQL NULL — the right answer for a term
            // with no questions.
            faq: entry.faq ?? undefined,
            translationStatus: "TRANSLATED",
          },
        },
      },
    });
    seededTerms += 1;
  }
  console.log(
    `  glossary: ${GLOSSARY_TOPICS.length} topics, ${seededTerms} term(s) of ${GLOSSARY_TERMS.length}`,
  );

  // ─────────────────────────────────────────────────────────────
  // VIDEOS — demo categories and topics (changes-16 PR 2, ADR-068)
  //
  // Demo content for the Videos section, exactly as DEMO_COURSES and the demo
  // quizzes are for theirs: a fresh database renders a populated shelf rather
  // than an empty state. The `videos` flag is ON above since PR 7 built the
  // public routes.
  //
  // Idempotent via the [locale, slug] uniqueness on video_topic_translations
  // and video_category_translations. An existing slug is SKIPPED, never
  // updated — a re-seed must not clobber an editor's rewording.
  //
  // ─── Why almost every demo topic has a body and no video ─────────────────
  //
  // `_content/home-videos.ts` records the rule and the reason: a video URL is a
  // FACTUAL CLAIM — it asserts "this specific recording exists and teaches
  // this" — and an invented eleven-character id resolves to whatever happens to
  // occupy it. So these rows do not invent one. The capability rule in
  // `videoTopicInputSchema` is satisfied the other legitimate way it allows: a
  // written guide filed under a category.
  //
  // ONE topic per track carries a video anyway, because the player, the facade
  // and the `videoCount` badge are the paths PRs 8 and 10 have to be able to
  // see on a fresh database. Its URL is the Blender Foundation's open test reel
  // — a real, stable, freely-licensed recording that is self-evidently NOT a
  // trading lesson, so it exercises the mechanism without asserting a
  // curriculum claim the way a plausible-looking id would.
  //
  // TODO(owner): replace those two URLs with real recordings. Nothing else
  // changes — the same row, the same parser, the same render path.
  //
  // No uploaded-source rows are seeded: an `assetId` with no bytes behind it
  // would 404 in the player, which is worse than not seeding one.
  //
  // No permission rows either — videos publish on the `lessons.*` keys
  // (ADR-068 §3).
  // ─────────────────────────────────────────────────────────────
  const DEMO_TEST_REEL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

  const VIDEO_CATEGORIES = [
    {
      slug: "getting-started",
      name: "Getting started",
      description: "Short walkthroughs for a trader opening their first chart.",
    },
    {
      slug: "strategy-and-analysis",
      name: "Strategy & analysis",
      description: "Longer sessions on reading a market and building a plan around it.",
    },
  ];

  interface SeedVideoTopic {
    slug: string;
    title: string;
    /** A LEARN_TRACKS key. Required — it is the URL's second segment (ADR-068 §1). */
    track: string;
    /** A VIDEO_CATEGORIES slug, or null for uncategorised. */
    category: string | null;
    summary: string;
    content: string;
    /** Seeded on exactly one topic per track — see the note above. */
    videoUrl?: string;
    links?: { label: string; path?: string; url?: string }[];
  }

  const VIDEO_TOPICS: SeedVideoTopic[] = [
    {
      slug: "reading-your-first-candlestick-chart",
      title: "Reading your first candlestick chart",
      track: "forex",
      category: "getting-started",
      summary:
        "What the body, the wicks and the colour of a candle actually tell you about a period of trading.",
      content:
        "<p>A candlestick compresses four numbers into one shape: where a period opened, where it closed, and the highest and lowest prices traded in between. The body spans open to close; the wicks reach out to the extremes.</p><p>That is the whole vocabulary. Everything else — the named patterns, the multi-candle formations — describes how several of those shapes sit next to each other, and none of it means much without the context of the level it forms at.</p>",
      videoUrl: DEMO_TEST_REEL,
      links: [
        { label: "Candlestick in the glossary", path: "/glossary/candlestick" },
        { label: "Browse forex courses", path: "/learn/forex" },
      ],
    },
    {
      slug: "placing-a-stop-loss-that-survives-noise",
      title: "Placing a stop loss that survives noise",
      track: "forex",
      category: "getting-started",
      summary:
        "Why a stop placed at a round number gets hit, and how to size a position around a sensible one instead.",
      content:
        "<p>Most stops are placed where they are convenient rather than where they are meaningful — a round number, a fixed pip distance, or whatever leaves the position size the trader already wanted. All three put the stop exactly where ordinary volatility reaches.</p><p>The order that works is the other way round: decide where the idea is wrong, put the stop there, and let that distance and your risk budget decide the position size. The size is the output, not the input.</p>",
      links: [
        { label: "Stop loss in the glossary", path: "/glossary/stop-loss" },
        { label: "Position size calculator", path: "/tools/position-size" },
      ],
    },
    {
      slug: "building-a-weekly-trading-plan",
      title: "Building a weekly trading plan",
      track: "forex",
      category: "strategy-and-analysis",
      summary:
        "A repeatable routine: the levels that matter, the data on the calendar, and what would make you stand aside.",
      content:
        "<p>A plan written after the week starts is a running commentary. Written before it, the same notes are a filter — they say in advance which setups you are willing to take and which you are not, at a moment when nothing is at stake.</p><p>Three things belong in it: the levels you will trade around, the scheduled releases that could invalidate them, and the conditions under which you do nothing at all. The third is the one most plans omit and the one that saves the most money.</p>",
      links: [{ label: "Economic calendar", path: "/economic-calendar" }],
    },
    {
      slug: "what-a-blockchain-actually-records",
      title: "What a blockchain actually records",
      track: "crypto",
      category: "getting-started",
      summary:
        "Blocks, confirmations and finality — what has really happened when a wallet says a transfer is complete.",
      content:
        "<p>A blockchain is an append-only ledger agreed on by a network with no central bookkeeper. A transaction is not an instruction to a bank; it is a signed message broadcast to that network, which decides whether and when to include it in a block.</p><p>That is why confirmations exist. Inclusion in a block is not the end of the story — each block built on top makes reversing the one below it more expensive, so finality is a probability that rises with depth rather than a state that flips.</p>",
      videoUrl: DEMO_TEST_REEL,
      links: [
        { label: "Blockchain in the glossary", path: "/glossary/blockchain" },
        { label: "Browse crypto courses", path: "/learn/crypto" },
      ],
    },
    {
      slug: "custody-and-why-keys-matter",
      title: "Custody, and why keys matter",
      track: "crypto",
      category: "getting-started",
      summary:
        "The difference between holding an asset and holding a claim on someone else who holds it.",
      content:
        "<p>Holding crypto on an exchange is not holding crypto. It is holding a claim against that exchange, recorded in its own database, redeemable while it stays solvent and operational. The on-chain balance belongs to the exchange's key.</p><p>Self-custody moves that key to you, and moves the entire failure mode with it: no counterparty can lose your asset, and no counterparty can restore it if you lose the key. Neither choice is safer in the abstract — they fail in different directions.</p>",
      links: [{ label: "Private key in the glossary", path: "/glossary/private-key" }],
    },
    {
      slug: "reading-on-chain-volume-honestly",
      title: "Reading on-chain volume honestly",
      track: "crypto",
      category: "strategy-and-analysis",
      summary:
        "Why reported volume and real economic activity diverge, and which measures survive the difference.",
      content:
        "<p>Volume is the easiest number on a crypto dashboard to inflate: wash trading on a venue costs almost nothing, and transfers between wallets one entity controls look identical on-chain to transfers between two parties.</p><p>The measures that hold up are the ones that are expensive to fake — fees actually paid, addresses that both received and later spent, and settlement value net of self-transfers. They are smaller numbers, and they are the ones worth watching.</p>",
      links: [{ label: "Volume in the glossary", path: "/glossary/volume" }],
    },
  ];

  const videoCategoryIds = new Map<string, string>();
  for (const [index, category] of VIDEO_CATEGORIES.entries()) {
    const existing = await db.videoCategoryTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: category.slug } },
      select: { categoryId: true },
    });
    if (existing) {
      videoCategoryIds.set(category.slug, existing.categoryId);
      continue;
    }
    const created = await db.videoCategory.create({
      data: {
        isActive: true,
        sortOrder: index,
        translations: {
          create: {
            locale: "en",
            name: category.name,
            slug: category.slug,
            description: category.description,
          },
        },
      },
      select: { id: true },
    });
    videoCategoryIds.set(category.slug, created.id);
  }

  let seededVideoTopics = 0;
  for (const [index, entry] of VIDEO_TOPICS.entries()) {
    const existing = await db.videoTopicTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: entry.slug } },
      select: { id: true },
    });
    if (existing) continue; // idempotent: never clobber an editor's rewording

    await db.videoTopic.create({
      data: {
        categoryId: entry.category === null ? null : (videoCategoryIds.get(entry.category) ?? null),
        track: entry.track,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publishedAt: new Date(),
        sortOrder: index,
        translations: {
          create: {
            locale: "en",
            title: entry.title,
            slug: entry.slug,
            summary: entry.summary,
            content: entry.content,
            translationStatus: "TRANSLATED",
          },
        },
        videos: entry.videoUrl
          ? { create: [{ sortOrder: 0, externalUrl: entry.videoUrl, title: entry.title }] }
          : undefined,
        links: entry.links
          ? {
              create: entry.links.map((link, linkIndex) => ({
                sortOrder: linkIndex,
                label: link.label,
                path: link.path ?? null,
                url: link.url ?? null,
              })),
            }
          : undefined,
      },
    });
    seededVideoTopics += 1;
  }
  console.log(
    `  videos: ${VIDEO_CATEGORIES.length} categories, ${seededVideoTopics} topic(s) of ${VIDEO_TOPICS.length}`,
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
