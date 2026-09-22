// @repo/contracts — Zod v4 schema per setting key (plan.md Module 05: "a
// Setting's value is validated against its declared type — an admin cannot
// save a number into an image slot"). Keyed by the exact `Setting.key`
// strings packages/db/prisma/seed.ts writes; a key seeded there without an
// entry here is a real gap, not a hypothetical one — the registry
// completeness test in @repo/settings checks this both ways.
import { z } from "zod";

import { AI_CAP_BEHAVIORS } from "./ai.ts";

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
  // The video rail, now `/learn` only (changes-31). `carousel` is gone with
  // the homepage placement it existed for: a scroll-snap shelf of tiles was
  // the shape it had there, and the learn index has always asked for `grid`.
  //
  // changes-51 adds `strip`: the homepage's own shape, back at the owner's ask
  // — a slider of small cover cards under a centred heading, straight after
  // the glossary band. `grid` stays `/learn`'s.
  learning_videos: ["grid", "strip"],
  hero: ["centered", "split", "background"],
  // "Explore the platform" — one card per destination the site offers.
  // `carousel` is the scroll-snap track; `grid` lays the same cards out
  // statically for a page that wants no horizontal scroll.
  explore_platform: ["carousel", "grid"],
  learning_paths: ["default", "elevated", "bordered", "featured"],
  featured_lessons: ["default", "elevated", "bordered", "featured"],
  popular_tools: ["default", "elevated", "bordered", "featured"],
  feature_highlights: ["grid", "compact"],
  // `split` is this section's own layout (one lead at half width, a compact
  // listing beside it) and is not an ArticleCards variant; the other three
  // pass straight through to it, so the section can still be a plain grid.
  //
  // changes-35 (ADR-116 §2) adds `desk`, the home page's seeded variant: the
  // lead story in one column and a hairline-cut 2x2 of ANALYSIS beside it. It
  // is the one variant of this section that reads a second kind, which is why
  // `latest_analysis` is seeded off on the home page and still keeps every
  // variant of its own.
  latest_news: ["split", "desk", "standard", "featured", "compact"],
  latest_analysis: ["standard", "featured", "compact"],
  // changes-28 added `cards` and made it the default: term PLUS its
  // plain-language line. `chips` and `grid` are kept — a site with three
  // hundred published terms may well want the dense row back.
  //
  // changes-35 (ADR-116 §1 band C) adds `feature`: the heading and its call to
  // action in a narrow first column, the terms on a track in the middle, and
  // the TERM OF THE DAY in a card at the end. `getTermOfTheDay` has been built
  // since changes-11 and no home band had ever called it.
  glossary_spotlight: ["cards", "feature", "chips", "grid"],
  forex_rates: ["marquee", "grid"],
  newsletter: ["default", "full-width"],
  // changes-35 (ADR-116 §1 band E) adds `columns`: a centred heading over a
  // two-column accordion, which is the reference's close. `accordion` (stacked)
  // and `split` (heading beside the list) are both kept.
  faq: ["accordion", "split", "columns"],
  // changes-28 (ADR-093). `single` shows the day's quote (deterministic, the
  // term-of-the-day technique); `carousel` offers the whole set in the
  // scroll-snap rail. `connect` is deliberately ABSENT from this registry:
  // it has one shape, and what varies is which social rows an admin has
  // activated. An empty list here would reject every variant while looking
  // like it configured something — the case `settings.test.ts` pins — and
  // `risk_disclaimer` sets the precedent for a built band with no vocabulary.
  quotes: ["single", "carousel"],
  // changes-31 (ADR-103) adds `trust_strip`, `facts` and `testimonials`, and
  // deliberately gives none of them an entry here. Each has exactly one shape;
  // what varies about `testimonials` is the COUNT, which is `limit`. An empty
  // list would reject every variant while looking like it configured
  // something — the case `settings.test.ts` pins, and the reason `connect` and
  // `risk_disclaimer` have no entry either.
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
  "learning_videos",
  "learning_paths",
  "featured_lessons",
  "hero",
  "explore_platform",
  "feature_highlights",
  "latest_news",
  "latest_analysis",
  "glossary_spotlight",
  "newsletter",
  "faq",
  // Built by changes-25 T9; moved out of the stub list in the same breath.
  "popular_tools",
  // Built by changes-28 (ADR-093), in the same PRs that seeded them.
  "connect",
  "quotes",
  "risk_disclaimer",
  // Built by changes-31 (ADR-103), in the same PR that seeded them. Each
  // renders NOTHING until the owner supplies its data — which is why they are
  // seeded enabled: a band that is absent when empty needs no second off
  // switch, and disabled-and-empty is two reasons for one absence.
  "trust_strip",
  "facts",
  "testimonials",
  // Built by changes-35 (ADR-116 §3). The first home band that composes THREE
  // datasets — a testimonial, a published video topic, the enabled tools — and
  // therefore the first that degrades per COLUMN rather than per band.
  "in_practice",
] as const satisfies readonly string[];

/**
 * Seeded sections that knowingly have NO component yet and render the
 * honest "coming soon" placeholder. Listing them explicitly is what makes
 * the CI check meaningful: a NEW seeded key that nobody built shows up as a
 * failure instead of silently joining the placeholders.
 */
export const HOME_SECTION_STUB_KEYS = [
  "forex_rates",
  "economic_events",
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

/**
 * What a legal-document setting may hold (ADR-110): **a site-relative path,
 * or nothing**.
 *
 * Two shapes reach it and both are internal. A seeded install points at a
 * committed file under `public/legal/`; an admin who uploads a replacement
 * points at `/uploads/<key>`. An empty string is the third legitimate state —
 * an installation that has not published this document yet — and it means the
 * footer link is ABSENT rather than pointing at a 404.
 *
 * External URLs are refused. A legal document hosted somewhere else can be
 * moved, paywalled or edited by someone who does not work here, while the
 * footer link keeps asserting it is ours. The negative lookahead is the same
 * one `internalPathSchema` carries: `//evil.example` is a protocol-relative
 * URL that passes every naive startsWith("/").
 */
export const legalDocumentValueSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(|\/(?!\/)[\w\-./~%+:@]*)$/, "must be a site-relative path beginning with /");

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

// Data budget (ADR-029 §5, PR 3.4) — policy in settings, not architecture.
// `block ≥ warn` and both strictly positive; raising these numbers is a
// DEVLOG entry citing a Lighthouse run, not a code change.
const budgetPairSchema = z
  .object({ warn: z.int().min(1), block: z.int().min(1) })
  .refine((v) => v.block >= v.warn, { message: "block must be >= warn", path: ["block"] });

const dataBudgetScopeSchema = z.object({
  collections: budgetPairSchema,
  items: budgetPairSchema,
});

export const dataBudgetSchema = z.object({
  page: dataBudgetScopeSchema,
  part: dataBudgetScopeSchema,
});
export type DataBudget = z.infer<typeof dataBudgetSchema>;

/**
 * How long a STAFF session survives without admin activity (ADR-105). The
 * values are minutes; `"never"` is the one sentinel, and it is a word rather
 * than a `0` so nothing has to explain it.
 *
 * ORDER IS THE DROPDOWN'S ORDER — shortest first, "never" last, which is the
 * order the owner asked for and also the order a reader scanning for "how
 * locked down is this" expects.
 */
export const ADMIN_SESSION_TIMEOUTS = ["2", "5", "15", "30", "60", "120", "never"] as const;

export type AdminSessionTimeout = (typeof ADMIN_SESSION_TIMEOUTS)[number];

/**
 * The setting as milliseconds, or `null` for "no timeout". One reader, so the
 * string→number step cannot be done differently in two places — and `null`
 * rather than `Infinity` so a caller that forgets to handle it fails loudly
 * instead of scheduling an expiry in the year 275760.
 */
export function adminSessionTimeoutMs(value: AdminSessionTimeout): number | null {
  return value === "never" ? null : Number(value) * 60_000;
}

export const SETTINGS_SCHEMAS = {
  "site.name": z.string().min(1).max(150),
  "site.tagline": z.string().max(200),
  "site.description": z.string().max(2000),
  "site.contactEmail": z.email(),
  "site.supportEmail": z.email(),
  "site.defaultLocale": z.string().min(2).max(10),
  "site.defaultTimezone": z.string().min(1).max(64),
  "site.defaultThemeMode": z.enum(["light", "dark", "system"]),
  // changes-41 / ADR-135 — where "Share your experience" sends a reader (a
  // Trustpilot review page). https only, because it is printed as a link on
  // every tool page; empty makes the band absent rather than a dead button.
  "site.reviewsUrl": z.union([
    z.literal(""),
    z
      .string()
      .max(500)
      .regex(/^https:\/\/[^\s/]+\.[^\s]+$/, "must be an https:// address"),
  ]),
  // ADR-105 — how long a STAFF session survives without admin activity.
  // Minutes as strings with an explicit "never", not a number with 0 meaning
  // unlimited: a sentinel a reader has to be told about is one the screen
  // then has to explain in prose, which is what `ai.monthlyBudgetUsd` already
  // costs. Learner sessions are not affected by this value at all.
  "security.adminSessionTimeout": z.enum(ADMIN_SESSION_TIMEOUTS),
  // changes-49: the same idle timeout for LEARNER sessions, decided by the
  // same pure rule in @repo/auth. Its own key rather than one shared value,
  // because the two audiences want different answers — an unattended admin
  // screen is a risk, an unattended lesson is a reader who went for coffee.
  "security.learnerSessionTimeout": z.enum(ADMIN_SESSION_TIMEOUTS),

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
  // changes-33: the registration number and the registered address are their
  // OWN keys rather than two more sentences inside the disclaimer. The footer
  // prints them as separate lines, a translator handles an address
  // differently from a paragraph of risk prose, and a jurisdiction that wants
  // one of them on a page the disclaimer does not appear on can read it
  // alone. Both may be empty — an installation that is not a registered
  // company prints neither line rather than an empty label.
  "legal.companyRegistration": z.string().max(200),
  "legal.registeredAddress": z.string().max(500),

  // Legal documents (ADR-110). Each holds a site-relative PATH — a committed
  // file under `public/legal/` on a seeded install, `/uploads/<key>` once an
  // admin has uploaded a replacement. The public address is `/legal/<doc>`,
  // which is ours and does not move when the file does. Empty means the
  // footer link is ABSENT — a legal link that 404s is worse than no link.
  "legal.termsDocument": legalDocumentValueSchema,
  "legal.privacyDocument": legalDocumentValueSchema,
  "legal.agreementDocument": legalDocumentValueSchema,

  // News & Analysis (Module 15, ADR-015 #7 — module on/off is the `news`/
  // `analysis` feature flags; title template, OG fallback and disclaimer
  // reuse the seo.*/legal.* keys above).
  "articles.perPage": z.int().min(1).max(48),
  "articles.showAuthor": z.boolean(),
  "articles.showReadingTime": z.boolean(),
  "articles.relatedCount": z.int().min(0).max(12),

  // Media v2 (ADR-034 §1) — per-kind upload caps, in bytes. Server-side
  // only: validated before any byte reaches the storage driver.
  "media.maxBytes.image": z.int().min(1),
  "media.maxBytes.video": z.int().min(1),
  "media.maxBytes.audio": z.int().min(1),
  "media.maxBytes.document": z.int().min(1),

  // Email (Module 17, ADR-078). Sender identity and the shell around every
  // message. The SMTP credentials are deliberately NOT here: they live in
  // EmailTransport, super_admin-only, with the password sealed.
  "email.enabled": z.boolean(),
  "email.fromName": z.string().min(1).max(120),
  "email.fromEmail": z.email(),
  "email.replyTo": z.email().or(z.literal("")),
  "email.logo": z.string().max(500),
  "email.footerText": z.string().max(500),
  // CAN-SPAM and its equivalents want a postal address on bulk mail.
  "email.postalAddress": z.string().max(300),
  // Where the newsletter signup appears (ADR-080 #5). These live here rather
  // than in `layout`, the group ADR-038 paused in admin — which is how
  // `footer.newsletterEnabled` ended up uneditable. changes-21 F7 DELETED that
  // key rather than leaving it beside these four: two settings meaning "is
  // there a signup in the footer" is one more than anyone can reason about,
  // and only one of the two was reachable.
  "newsletter.placements.footer": z.boolean(),
  "newsletter.placements.home": z.boolean(),
  "newsletter.placements.news": z.boolean(),
  "newsletter.placements.analysis": z.boolean(),

  // AI platform (Module 18, ADR-097/099/100). Every one of these is
  // `isPublic: false` — security.md #12 forbids a non-public setting from
  // serialising into a public RSC payload, and Module 05's leak test covers
  // the group. The provider key is not here at all: it lives sealed in
  // `AiProvider.apiKeyCipher` (ADR-098).
  "ai.enabled": z.boolean(),
  "ai.maxTokensPerRequest": z.int().min(1).max(200_000),
  /** `0` means unlimited, and the limits screen says so in words. */
  "ai.monthlyBudgetUsd": z.number().min(0).max(1_000_000),
  "ai.budgetWarnPercent": z.int().min(1).max(100),
  "ai.capBehavior": z.enum(AI_CAP_BEHAVIORS),
  "ai.rateLimitPerUserHour": z.int().min(1).max(100_000),
  // The three tiers hold a model ID STRING, not an `AiModel` row id, so a tier
  // keeps its meaning when a provider row is deleted and re-created. A tier
  // naming a retired model degrades — `config.ts` falls through to the default
  // provider's first enabled model — rather than throwing.
  "ai.model.light": z.string().min(1).max(80),
  "ai.model.standard": z.string().min(1).max(80),
  "ai.model.heavy": z.string().min(1).max(80),

  "cms.dataBudget": dataBudgetSchema,
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
  "site.reviewsUrl": "general",
  "security.adminSessionTimeout": "general",
  "security.learnerSessionTimeout": "general",

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

  "layout.pageLoader": "layout",
  "header.topBar": "layout",
  "header.showSearch": "layout",
  "footer.showPaymentBadges": "layout",
  "footer.appLinks": "layout",

  "legal.riskDisclaimer": "legal",
  "legal.copyrightNotice": "legal",
  "legal.companyRegistration": "legal",
  "legal.registeredAddress": "legal",
  "legal.termsDocument": "legal",
  "legal.privacyDocument": "legal",
  "legal.agreementDocument": "legal",

  "articles.perPage": "articles",
  "articles.showAuthor": "articles",
  "articles.showReadingTime": "articles",
  "articles.relatedCount": "articles",

  "media.maxBytes.image": "media",
  "media.maxBytes.video": "media",
  "media.maxBytes.audio": "media",
  "media.maxBytes.document": "media",

  "email.enabled": "email",
  "email.fromName": "email",
  "email.fromEmail": "email",
  "email.replyTo": "email",
  "email.logo": "email",
  "email.footerText": "email",
  "email.postalAddress": "email",
  "newsletter.placements.footer": "email",
  "newsletter.placements.home": "email",
  "newsletter.placements.news": "email",
  "newsletter.placements.analysis": "email",

  "ai.enabled": "ai",
  "ai.maxTokensPerRequest": "ai",
  "ai.monthlyBudgetUsd": "ai",
  "ai.budgetWarnPercent": "ai",
  "ai.capBehavior": "ai",
  "ai.rateLimitPerUserHour": "ai",
  "ai.model.light": "ai",
  "ai.model.standard": "ai",
  "ai.model.heavy": "ai",

  "cms.dataBudget": "cms",
};

// ─── Widget hints (changes-02) ───────────────────────────────
//
// The admin settings form is type-driven (STRING/TEXT/…); a few STRING keys
// deserve a smarter control than a text box. Declared here, beside the
// schema, so the widget choice is registry data rather than a per-screen
// special case. "timezone" → IANA zone dropdown (Intl.supportedValuesOf);
// "locale" → active-locale dropdown; "select" → the options listed below;
// "megabytes" → a dropdown of MB sizes over a value STORED in bytes.
export type SettingWidget = "timezone" | "locale" | "select" | "megabytes";

export const SETTING_WIDGETS: Partial<Record<SettingKey, SettingWidget>> = {
  "site.defaultTimezone": "timezone",
  "site.defaultLocale": "locale",
  "site.defaultThemeMode": "select",
  "security.adminSessionTimeout": "select",
  "security.learnerSessionTimeout": "select",
  "media.maxBytes.image": "megabytes",
  "media.maxBytes.video": "megabytes",
  "media.maxBytes.audio": "megabytes",
  "media.maxBytes.document": "megabytes",
};

/** Options for "select"-widget keys — mirrors each key's z.enum above. */
export const SETTING_SELECT_OPTIONS: Partial<Record<SettingKey, readonly string[]>> = {
  "site.defaultThemeMode": ["light", "dark", "system"],
  "security.adminSessionTimeout": ADMIN_SESSION_TIMEOUTS,
  "security.learnerSessionTimeout": ADMIN_SESSION_TIMEOUTS,
};

// ─── Upload caps in megabytes (changes-46) ────────────────────
//
// "the sizes should be uploaded in MB & should be a dropdown". The four
// `media.maxBytes.*` caps stay STORED in bytes — `storeMedia()` compares a
// byte length against them and no migration is owed — and the form offers
// megabytes. One MB is 1024 × 1024 bytes, the unit `storeMedia()`'s own
// "larger than N MB" message already divides by.

export const BYTES_PER_MEGABYTE = 1024 * 1024;

/** The sizes offered per kind, in MB. Sensible for the kind, not one list. */
export const SETTING_MEGABYTE_OPTIONS: Partial<Record<SettingKey, readonly number[]>> = {
  "media.maxBytes.image": [1, 2, 5, 10, 15, 20, 25, 50],
  "media.maxBytes.video": [10, 25, 50, 100, 200, 250, 500, 1000],
  "media.maxBytes.audio": [5, 10, 20, 25, 50, 100, 200],
  "media.maxBytes.document": [1, 2, 5, 10, 20, 25, 50, 100],
};

/** Bytes → megabytes, rounded to two places for display. */
export function bytesToMegabytes(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MEGABYTE) * 100) / 100;
}

/** Megabytes → the whole number of bytes the setting stores. */
export function megabytesToBytes(megabytes: number): number {
  return Math.round(megabytes * BYTES_PER_MEGABYTE);
}

/**
 * The dropdown's rows for a megabyte setting: the kind's sizes, plus the
 * CURRENT value when it is not one of them (a value saved before the dropdown
 * existed, or seeded by hand). Dropping it would show a blank control and
 * make the next save silently change a cap nobody touched. Sorted ascending.
 */
export function megabyteChoices(
  key: SettingKey,
  currentBytes: number | null,
): { bytes: number; megabytes: number }[] {
  const sizes = (SETTING_MEGABYTE_OPTIONS[key] ?? []).map((mb) => megabytesToBytes(mb));
  const all =
    currentBytes !== null && Number.isInteger(currentBytes) && currentBytes > 0
      ? [...new Set([...sizes, currentBytes])]
      : sizes;
  return [...all]
    .sort((a, b) => a - b)
    .map((bytes) => ({ bytes, megabytes: bytesToMegabytes(bytes) }));
}

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
