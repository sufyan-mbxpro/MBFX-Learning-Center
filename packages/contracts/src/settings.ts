// @repo/contracts — Zod v4 schema per setting key (plan.md Module 05: "a
// Setting's value is validated against its declared type — an admin cannot
// save a number into an image slot"). Keyed by the exact `Setting.key`
// strings packages/db/prisma/seed.ts writes; a key seeded there without an
// entry here is a real gap, not a hypothetical one — the registry
// completeness test in @repo/settings checks this both ways.
import { z } from "zod";

/**
 * Which layout variants each homepage section accepts (changes-03-plan.md
 * §5.1, ADR-018). This is the VOCABULARY only — the key → component map
 * lives in the app (`app/(public)/[locale]/_sections/registry.ts`), because
 * a shared package must not reach into app code (architecture.md #8). Both
 * halves are keyed by the same strings, so a section named here without a
 * component there renders the honest "coming soon" stub rather than
 * breaking, exactly as today.
 *
 * A key absent from this registry accepts any variant: an admin can seed a
 * section this build doesn't know about yet without the write being
 * rejected. A key PRESENT here is validated strictly — that's the typo'd-
 * variant class of bug this exists to kill.
 */
export const HOME_SECTION_VARIANTS = {
  hero: ["centered", "split", "background"],
  learning_paths: ["default", "elevated", "bordered", "featured"],
  featured_lessons: ["default", "elevated", "bordered", "featured"],
  popular_tools: ["default", "elevated", "bordered", "featured"],
  latest_analysis: ["standard", "featured", "compact"],
  glossary_spotlight: ["chips", "grid"],
  forex_rates: ["marquee", "grid"],
  newsletter: ["default", "full-width"],
  faq: ["accordion", "split"],
} as const satisfies Record<string, readonly string[]>;

export type HomeSectionKey = keyof typeof HOME_SECTION_VARIANTS;

export function isKnownHomeSectionKey(key: string): key is HomeSectionKey {
  return key in HOME_SECTION_VARIANTS;
}

/**
 * Sections that have a real component behind them today (Phase 9a).
 *
 * The admin surface needs this list to label sections that would render the
 * placeholder — but `_sections/registry.ts` lives under `app/(public)` and
 * `app/(admin)` may not import from it (architecture.md #5). So the list is
 * declared here, in the package both surfaces already depend on, and
 * `scripts/check-home-sections.mjs` asserts it matches the public registry
 * exactly. Duplication that a CI check keeps honest, rather than a
 * cross-surface import.
 */
export const HOME_SECTION_BUILT_KEYS = [
  "hero",
  "latest_analysis",
  "glossary_spotlight",
  "newsletter",
  "faq",
  "risk_disclaimer",
] as const satisfies readonly string[];

/**
 * Seeded sections that knowingly have NO component yet and render the
 * honest "coming soon" placeholder. Listing them explicitly is what makes
 * the CI check meaningful: a NEW seeded key that nobody built shows up as a
 * failure instead of silently joining the placeholders.
 */
export const HOME_SECTION_STUB_KEYS = [
  "learning_paths",
  "forex_rates",
  "economic_events",
  "popular_tools",
  "featured_lessons",
  "market_sentiment",
  "trading_sessions",
] as const satisfies readonly string[];

/** Does this section render real content, or the placeholder? */
export function isBuiltHomeSectionKey(key: string): boolean {
  return (HOME_SECTION_BUILT_KEYS as readonly string[]).includes(key);
}

const homeSectionSchema = z
  .object({
    key: z.string(),
    enabled: z.boolean(),
    order: z.number().int(),
    /** Layout variant — validated against HOME_SECTION_VARIANTS below. */
    variant: z.string().optional(),
    /** How many items the section renders, where it lists things. */
    limit: z.number().int().min(1).max(24).optional(),
  })
  .superRefine((section, ctx) => {
    if (section.variant === undefined) return;
    if (!isKnownHomeSectionKey(section.key)) return;
    const allowed: readonly string[] = HOME_SECTION_VARIANTS[section.key];
    if (!allowed.includes(section.variant)) {
      ctx.addIssue({
        code: "custom",
        path: ["variant"],
        message: `Unknown variant "${section.variant}" for section "${section.key}". Allowed: ${allowed.join(", ")}.`,
      });
    }
  });

const headerCtaSchema = z.object({
  enabled: z.boolean(),
  label: z.string(),
  url: z.string(),
});

const announcementBarSchema = z.object({
  enabled: z.boolean(),
  text: z.string(),
  dismissible: z.boolean(),
});

const footerMenuColumnSchema = z.object({
  menuKey: z.string(),
  order: z.number().int(),
});

// Public design system (changes-03-plan.md §5.1). The reference's header
// carries a slim contact/promo bar above the main nav; these make it
// admin-controlled rather than hardcoded chrome.
const headerTopBarSchema = z.object({
  enabled: z.boolean(),
  phone: z.string().max(40),
  promoText: z.string().max(200),
  promoUrl: z.string().max(500),
});

// App-store badges in the footer. Assets are admin UPLOADS (ADR-017), never
// third-party logos committed to the repo — this only stores the link.
const footerAppLinkSchema = z.object({
  platform: z.enum(["ios", "android", "windows"]),
  url: z.string().regex(/^(\/|https?:\/\/)/, "must be a path or URL"),
});

export const SETTINGS_SCHEMAS = {
  "site.name": z.string().min(1).max(150),
  "site.tagline": z.string().max(200),
  "site.description": z.string().max(2000),
  "site.contactEmail": z.email(),
  "site.supportEmail": z.email(),
  "site.defaultLocale": z.string().min(2).max(10),
  "site.defaultTimezone": z.string().min(1).max(64),
  "site.defaultThemeMode": z.enum(["light", "dark", "system"]),
  // IMAGE type: a site-relative path or absolute URL — not literally any
  // string (plan.md's own example of what this registry exists to prevent).
  "site.faviconUrl": z.string().regex(/^(\/|https?:\/\/)/, "must be a path or URL"),

  "seo.titleTemplate": z.string().max(100),
  "seo.defaultOgImage": z.string().regex(/^(\/|https?:\/\/)/, "must be a path or URL"),
  "seo.robotsIndex": z.boolean(),
  "seo.googleSiteVerification": z.string().max(200),

  "home.sections": z.array(homeSectionSchema),
  "layout.containerWidth": z.string().regex(/^\d+(px|rem|%)$/, "must be a CSS length"),
  "layout.showBreadcrumbs": z.boolean(),
  "header.sticky": z.boolean(),
  "header.cta": headerCtaSchema,
  "header.announcementBar": announcementBarSchema,
  "footer.menuColumns": z.array(footerMenuColumnSchema),
  "footer.newsletterEnabled": z.boolean(),

  // Public design system (ADR-018 / changes-03-plan.md §5.1).
  // `layout.pageLoader` is SiteLoader's kill switch (ADR-018 rule 4d) — the
  // preloader can be switched off without a deploy.
  "layout.pageLoader": z.boolean(),
  "header.topBar": headerTopBarSchema,
  "header.showSearch": z.boolean(),
  "footer.showPaymentBadges": z.boolean(),
  "footer.appLinks": z.array(footerAppLinkSchema).max(6),

  "legal.riskDisclaimer": z.string().min(1).max(5000),
  "legal.copyrightNotice": z.string().min(1).max(500),

  // News & Analysis (Module 15, ADR-015 #7 — module on/off is the `news`/
  // `analysis` feature flags; title template, OG fallback and disclaimer
  // reuse the seo.*/legal.* keys above).
  "articles.perPage": z.int().min(1).max(48),
  "articles.showAuthor": z.boolean(),
  "articles.showReadingTime": z.boolean(),
  "articles.relatedCount": z.int().min(0).max(12),
} as const satisfies Record<string, z.ZodType>;

export type SettingKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export function isKnownSettingKey(key: string): key is SettingKey {
  return key in SETTINGS_SCHEMAS;
}

// The cache tag is `settings:{group}` (architecture.md #12, frozen), so a
// write needs to know a key's group to invalidate the right tag without a
// DB round trip. Mirrors packages/db/prisma/seed.ts's SETTINGS groupName
// column exactly — keep the two in sync by hand (same duplication tradeoff
// @repo/theme's default tokens already accepted, see seed.ts's own note).
export const SETTING_GROUPS: Record<SettingKey, string> = {
  "site.name": "general",
  "site.tagline": "general",
  "site.description": "general",
  "site.contactEmail": "general",
  "site.supportEmail": "general",
  "site.defaultLocale": "general",
  "site.defaultTimezone": "general",
  "site.defaultThemeMode": "general",
  "site.faviconUrl": "general",

  "seo.titleTemplate": "seo",
  "seo.defaultOgImage": "seo",
  "seo.robotsIndex": "seo",
  "seo.googleSiteVerification": "seo",

  "home.sections": "layout",
  "layout.containerWidth": "layout",
  "layout.showBreadcrumbs": "layout",
  "header.sticky": "layout",
  "header.cta": "layout",
  "header.announcementBar": "layout",
  "footer.menuColumns": "layout",
  "footer.newsletterEnabled": "layout",

  "layout.pageLoader": "layout",
  "header.topBar": "layout",
  "header.showSearch": "layout",
  "footer.showPaymentBadges": "layout",
  "footer.appLinks": "layout",

  "legal.riskDisclaimer": "legal",
  "legal.copyrightNotice": "legal",

  "articles.perPage": "articles",
  "articles.showAuthor": "articles",
  "articles.showReadingTime": "articles",
  "articles.relatedCount": "articles",
};

// ─── Widget hints (changes-02) ───────────────────────────────
//
// The admin settings form is type-driven (STRING/TEXT/…); a few STRING keys
// deserve a smarter control than a text box. Declared here, beside the
// schema, so the widget choice is registry data rather than a per-screen
// special case. "timezone" → IANA zone dropdown (Intl.supportedValuesOf);
// "locale" → active-locale dropdown; "select" → the options listed below.
export type SettingWidget = "timezone" | "locale" | "select";

export const SETTING_WIDGETS: Partial<Record<SettingKey, SettingWidget>> = {
  "site.defaultTimezone": "timezone",
  "site.defaultLocale": "locale",
  "site.defaultThemeMode": "select",
};

/** Options for "select"-widget keys — mirrors each key's z.enum above. */
export const SETTING_SELECT_OPTIONS: Partial<Record<SettingKey, readonly string[]>> = {
  "site.defaultThemeMode": ["light", "dark", "system"],
};

// ─── Structured editors for JSON settings (Phase 9c) ──────────
//
// Every JSON-typed setting used to render as a raw textarea holding
// JSON.stringify(value) — workable for a developer, hostile to an admin,
// and a syntax error away from saving nothing. These descriptors let the
// settings form build a real control per field.
//
// Declared HERE, beside the Zod schema that validates the same shape, so
// the two cannot drift; the form is generic and reads this registry.
// Deliberately FLAT — no nesting, no conditional fields. A setting that
// needs more than this wants its own screen, not a richer registry (that
// road ends at a page builder, which the brief rules out).

export type SettingFieldType = "string" | "boolean" | "url" | "number" | "select";

export interface SettingFieldDef {
  /** Property name within the object. */
  name: string;
  type: SettingFieldType;
  /** Catalog key under the `admin` namespace — never a literal label. */
  labelKey: string;
  /** Static choices for `type: "select"`. */
  options?: readonly string[];
  /** Runtime-resolved choices the form supplies (menus are DB rows). */
  optionsFrom?: "menus";
}

export interface SettingFieldsDef {
  /** "object" edits one record; "list" edits an array of records. */
  shape: "object" | "list";
  fields: readonly SettingFieldDef[];
  /**
   * List only: the property that stores position. The editor derives it
   * from row order instead of rendering an input, so the stored value can
   * never disagree with the order the admin arranged.
   */
  orderField?: string;
}

export const SETTING_FIELDS: Partial<Record<SettingKey, SettingFieldsDef>> = {
  "header.topBar": {
    shape: "object",
    fields: [
      { name: "enabled", type: "boolean", labelKey: "fieldEnabled" },
      { name: "phone", type: "string", labelKey: "fieldPhone" },
      { name: "promoText", type: "string", labelKey: "fieldPromoText" },
      { name: "promoUrl", type: "url", labelKey: "fieldPromoUrl" },
    ],
  },
  "header.cta": {
    shape: "object",
    fields: [
      { name: "enabled", type: "boolean", labelKey: "fieldEnabled" },
      { name: "label", type: "string", labelKey: "fieldLabel" },
      { name: "url", type: "url", labelKey: "fieldUrl" },
    ],
  },
  "header.announcementBar": {
    shape: "object",
    fields: [
      { name: "enabled", type: "boolean", labelKey: "fieldEnabled" },
      { name: "text", type: "string", labelKey: "fieldText" },
      { name: "dismissible", type: "boolean", labelKey: "fieldDismissible" },
    ],
  },
  "footer.appLinks": {
    shape: "list",
    fields: [
      {
        name: "platform",
        type: "select",
        labelKey: "fieldPlatform",
        options: ["ios", "android", "windows"],
      },
      { name: "url", type: "url", labelKey: "fieldUrl" },
    ],
  },
  "footer.menuColumns": {
    shape: "list",
    orderField: "order",
    fields: [
      // A Select of real menus, not free text an admin can typo into a
      // column that silently renders nothing.
      { name: "menuKey", type: "select", labelKey: "fieldMenu", optionsFrom: "menus" },
    ],
  },
};

/**
 * One Save per settings section (changes-02): the form submits every
 * changed key at once. Values are validated per key by updateSettings —
 * this only shapes the envelope.
 */
export const updateSettingsBatchSchema = z
  .array(z.object({ key: z.string().min(1).max(120), value: z.unknown() }))
  .min(1)
  .max(100);
export type UpdateSettingsBatchInput = z.infer<typeof updateSettingsBatchSchema>;
