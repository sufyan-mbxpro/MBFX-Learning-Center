// @repo/theme — pure functions + one cached loader. No React (SKILL.md):
// this package is data and derivation only, never UI.
//
// Ported from docs/reference/theme-engine.ts with the review fixes:
//   A5.1 — scope resolution (see loadActiveTheme): exact scope must beat
//          "both" deterministically, not via an alphabetical orderBy.
//   A5.2 — font vars renamed --brand-font-sans/--brand-font-mono so
//          @theme inline's --font-sans: var(--brand-font-sans) isn't a
//          circular self-reference.
//   A5.3 — full hex values emitted directly; rgbChannels() deleted
//          (Tailwind v4 handles opacity via color-mix, not rgb() + alpha).
//   ADR-003 — hover/active are derived, never admin-editable.
//   ADR-004 — unstable_cache replaced by "use cache" + cacheTag/cacheLife.
//   ADR-005 — fontSans/fontMono are curated keys, not raw CSS stacks.
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@repo/db";

// ─────────────────────────────────────────────────────────────
// Curated fonts (ADR-005) — the registry lives here; the actual
// next/font/local files live in @repo/ui (Module 07).
// ─────────────────────────────────────────────────────────────

export interface CuratedFont {
  key: string;
  label: string;
  category: "sans" | "mono";
}

export const CURATED_FONTS: CuratedFont[] = [
  { key: "system", label: "System UI", category: "sans" },
  // Outfit was the brand typeface under ADR-039; ADR-072 moved the default
  // to Inter. It stays a selectable key — superseding a default deletes
  // nothing an admin may have picked.
  { key: "outfit", label: "Outfit", category: "sans" },
  // The brand typeface and the DEFAULT_LAYOUT.fontSans default (ADR-072).
  { key: "inter", label: "Inter", category: "sans" },
  { key: "roboto", label: "Roboto", category: "sans" },
  { key: "opensans", label: "Open Sans", category: "sans" },
  { key: "lato", label: "Lato", category: "sans" },
  { key: "montserrat", label: "Montserrat", category: "sans" },
  { key: "poppins", label: "Poppins", category: "sans" },
  { key: "systemmono", label: "System Monospace", category: "mono" },
  { key: "jetbrainsmono", label: "JetBrains Mono", category: "mono" },
  { key: "firacode", label: "Fira Code", category: "mono" },
  { key: "ibmplexmono", label: "IBM Plex Mono", category: "mono" },
];

export type CuratedFontKey = (typeof CURATED_FONTS)[number]["key"];

const CURATED_FONT_KEYS = new Set(CURATED_FONTS.map((f) => f.key));

export function isCuratedFontKey(key: string): key is CuratedFontKey {
  return CURATED_FONT_KEYS.has(key);
}

const SYSTEM_SANS_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO_STACK = '"Courier New", Courier, monospace';

/**
 * A curated key resolves to a CSS variable reference — @repo/ui defines
 * what --font-{key} actually is via next/font/local (ADR-005). "system"
 * and "systemmono" are the exception: no file to preload, so the literal
 * stack is emitted directly.
 */
function resolveFontValue(key: string): string {
  if (key === "system") return SYSTEM_SANS_STACK;
  if (key === "systemmono") return SYSTEM_MONO_STACK;
  return isCuratedFontKey(key) ? `var(--font-${key})` : SYSTEM_SANS_STACK;
}

// ─────────────────────────────────────────────────────────────
// Editable surface — mirrors the admin form field for field
// ─────────────────────────────────────────────────────────────

/** Tab 1. Exactly the seven swatches on the Colors & Branding screen. */
export interface BrandColors {
  primary: string; // Buttons, links, and highlights
  secondary: string; // Secondary accents and backgrounds
  success: string; // Deposits, profits, and approved statuses
  error: string; // Errors, losses, and failed statuses
  warning: string; // Warnings, pending statuses, and caution indicators
  info: string; // Informational badges, tips, and highlights
  accent: string; // Sidebar active items, hover states, subtle highlights
}

/** Tab 3. Authored once per mode. */
export interface SurfacePalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderLight: string;
  borderMedium: string;
}

/** Tab 2. */
export interface LayoutTokens {
  radiusBase: string;
  containerWidth: string;
  /** Curated font key (ADR-005), not a raw CSS font-stack. */
  fontSans: CuratedFontKey;
  fontMono: CuratedFontKey;
  /** 13–16px, per SKILL.md. */
  baseFontSize: string;
}

/**
 * Escape hatch, used rarely. A brand colour that reads well on white can be
 * wrong on a near-black surface. Populate only the keys that fail validation
 * in dark mode — the admin should surface these one at a time rather than
 * presenting a second full palette to fill in.
 */
export type BrandOverrides = Partial<BrandColors>;

// ─────────────────────────────────────────────────────────────
// Defaults (ADR-072 — the changes-20 design system)
//
// These are DEFAULTS, not the palette. The admin theme editor writes a
// Theme row and loadActiveTheme reads it; these values apply only where no
// row exists, and are what the seed writes into the default row. A
// redesign changes them here and nowhere else — never as literals in CSS.
//
// Mirrored by hand into packages/db/prisma/default-theme-tokens.json (the
// seed can't import this package, architecture.md #8); seed-sync.test.ts
// fails the moment the two disagree.
// ─────────────────────────────────────────────────────────────

export const DEFAULT_BRAND: BrandColors = {
  // The reference's bronze. Its label ink is engine-derived (#1A1A1A,
  // 6.01:1), NOT the reference's white (2.77:1) — ADR-072 §1.
  primary: "#C28D5A",
  secondary: "#2A2A29",
  // The AA-safe siblings of the reference's #3382E2/#E23C36: white labels
  // clear 4.5:1 on these and not on those (ADR-072 §3).
  success: "#2D72C7",
  error: "#D93A34",
  warning: "#FFA310",
  info: "#004284",
  accent: "#EAE5DE",
};

/** Slate neutrals (ADR-072 §4). */
export const DEFAULT_LIGHT_SURFACE: SurfacePalette = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  textPrimary: "#020817",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  borderLight: "#E2E8F0",
  // The input border. The reference reuses its divider colour (1.23:1); no
  // named slate step sits near 3:1 (400 = 2.56, 500 = 4.76), so this is the
  // point on the slate ramp that clears 3:1 on BOTH background and muted.
  borderMedium: "#7F8FA5",
};

/** shadcn slate dark — the canonical partner of the light set above. */
export const DEFAULT_DARK_SURFACE: SurfacePalette = {
  background: "#020817",
  surface: "#020817",
  surfaceMuted: "#1E293B",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  borderLight: "#1E293B",
  // 3:1 on the dark background, same derivation as the light value.
  borderMedium: "#4F5E73",
};

/**
 * #EAE5DE is a light-surface tint — on a dark background it becomes a
 * near-white block. #2A2A29 is near-black and disappears entirely. These two
 * are the only defaults that need a dark counterpart; the four status colours
 * and the primary all survive the mode switch. Dark accent is the muted
 * surface because the reference says so in its own markup: its active and
 * hover nav states are `dark:bg-muted`.
 */
export const DEFAULT_DARK_BRAND_OVERRIDES: BrandOverrides = {
  accent: "#1E293B",
  secondary: "#E8E6E3",
};

export const DEFAULT_LAYOUT: LayoutTokens = {
  // sm 4 / md 6 / lg 8 / xl 12 via @repo/ui's radius formula (ADR-072 §8).
  radiusBase: "6px",
  containerWidth: "1400px",
  // ADR-072: Inter is the brand typeface (superseding ADR-039's Outfit).
  // "system" and "outfit" stay selectable registry keys.
  fontSans: "inter",
  fontMono: "systemmono",
  baseFontSize: "16px",
};

// ─────────────────────────────────────────────────────────────
// Colour maths
// ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "").trim();
  const full =
    c.length === 3
      ? c
          .split("")
          .map((x) => x + x)
          .join("")
      : c;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance(hex: string): number {
  // .map() over a fixed [number, number, number] tuple loses the tuple type
  // (becomes number[]), so noUncheckedIndexedAccess sees r/g/b as possibly
  // undefined — reasserted since the map preserves the length by construction.
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  // Same noUncheckedIndexedAccess situation: .sort() on a 2-element array
  // returns number[], not a 2-tuple.
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => (amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return rgbToHex(f(r), f(g), f(b));
}

function readableOn(bg: string, light: string, dark: string): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/**
 * The important function.
 *
 * A brand colour has two jobs that pull against each other: it identifies the
 * product, and it has to be legible as link text. The brand primary #C28D5A
 * does the first well and fails the second at 2.89:1 on white — below even the
 * 3:1 floor for non-text UI. (#E8B98C, the value between changes-03 and
 * ADR-072, failed the same way at 1.79:1; the shape of the problem is a
 * property of warm mid-to-light brand tones, not of one particular swatch.)
 *
 * Rather than making an admin abandon their brand colour, keep it for identity
 * (fills, borders, chart series, swatches) and derive a same-hue sibling for
 * interactive text until it clears the threshold. #C28D5A resolves to
 * #936B44 on white, which passes 4.5:1 and still reads as the brand.
 *
 * ADR-018 rule 5 is the other half of this: because raw --primary clears
 * neither 4.5:1 nor the 3:1 non-text floor, it is for FILLS and large shapes
 * only. Thin borders, small icon glyphs and eyebrow labels use
 * --primary-interactive, which this function produces.
 */
export function deriveInteractive(color: string, background: string, target = 4.5): string {
  if (contrastRatio(color, background) >= target) return color;

  // Push away from the background: darken on light surfaces, lighten on dark.
  const direction = luminance(background) > 0.5 ? -1 : 1;

  for (let step = 1; step <= 20; step++) {
    const candidate = shade(color, direction * step * 0.04);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  // Out of headroom — fall back to a guaranteed-legible text colour.
  return direction < 0 ? "#1A1A1A" : "#FFFFFF";
}

// ─────────────────────────────────────────────────────────────
// Composition
// ─────────────────────────────────────────────────────────────

export interface ModeInput {
  brand: BrandColors;
  surface: SurfacePalette;
  layout: LayoutTokens;
  overrides?: BrandOverrides;
}

// Fixed label inks for text sitting ON a colored fill (button labels,
// badges). Deliberately NOT surface.textPrimary: in dark mode textPrimary
// is itself light, which left readableOn choosing between two light
// candidates — any mid-tone fill (the brand primary included) then "had no
// legible label", which was a bug in this file's logic, not in the fill.
// A fill's label ink is a property of the FILL, not of the surface mode.
const INK_LIGHT = "#FFFFFF";
const INK_DARK = "#1A1A1A";

export function tokensToCss({ brand, surface, layout, overrides }: ModeInput): string {
  const b: BrandColors = { ...brand, ...overrides };
  const bg = surface.background;
  const onLight = INK_DARK;
  const onDark = INK_LIGHT;

  const vars: Record<string, string> = {
    // Surfaces — full hex values (A5.3), not rgbChannels() triples.
    "--background": surface.background,
    "--foreground": surface.textPrimary,
    "--card": surface.surface,
    "--card-foreground": surface.textPrimary,
    "--popover": surface.surface,
    "--popover-foreground": surface.textPrimary,
    "--muted": surface.surfaceMuted,
    "--muted-foreground": surface.textSecondary,
    "--border": surface.borderLight,
    "--input": surface.borderMedium,

    // Primary. Identity value and interactive value are deliberately separate.
    "--primary": b.primary,
    "--primary-foreground": readableOn(b.primary, onDark, onLight),
    "--primary-interactive": deriveInteractive(b.primary, bg),
    // Derived, never admin-editable (ADR-003).
    "--primary-hover": shade(b.primary, -0.14),
    "--primary-active": shade(b.primary, -0.26),
    "--primary-subtle": shade(b.primary, 0.85),

    "--secondary": b.secondary,
    "--secondary-foreground": readableOn(b.secondary, onDark, onLight),

    "--accent": b.accent,
    "--accent-foreground": readableOn(b.accent, onDark, onLight),

    "--success": b.success,
    "--success-foreground": readableOn(b.success, onDark, onLight),
    "--success-interactive": deriveInteractive(b.success, bg),

    "--destructive": b.error,
    "--destructive-foreground": readableOn(b.error, onDark, onLight),
    "--destructive-interactive": deriveInteractive(b.error, bg),

    "--warning": b.warning,
    "--warning-foreground": readableOn(b.warning, onDark, onLight),
    "--warning-interactive": deriveInteractive(b.warning, bg),

    "--info": b.info,
    "--info-foreground": readableOn(b.info, onDark, onLight),
    "--info-interactive": deriveInteractive(b.info, bg),

    // The focus ring is a graphical indicator, so 3:1 is the correct bar,
    // not 4.5:1. Its hue is the PRIMARY (ADR-072 §5) — the reference's ring
    // is its bronze; it used to be derived from success (blue).
    "--ring": deriveInteractive(b.primary, bg, 3.0),

    "--text-muted": surface.textMuted,
    "--radius": layout.radiusBase,
    "--container-width": layout.containerWidth,
  };

  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}

// ─────────────────────────────────────────────────────────────
// Validation — what the admin form shows inline
// ─────────────────────────────────────────────────────────────

export type IssueSeverity = "error" | "warning";

export interface ContrastIssue {
  field: string;
  mode: "light" | "dark";
  label: string;
  ratio: number;
  required: number;
  severity: IssueSeverity;
  remedy?: string;
}

/**
 * All contrast checks are advisory (changes-05): every issue below is
 * `severity: "warning"`, shown with its ratio and a concrete remedy, but
 * none of them block Save. Previously the four checks in `blocking` and the
 * button-label check were `"error"` and refused to save at all — in
 * practice this meant repeatedly iterating a background/surface edit
 * reopened the same check with a freshly recomputed remedy each time (the
 * numbers are exact per current colors, so they don't stay valid across a
 * further edit), which read as the editor being broken rather than as
 * guidance. Explicit tradeoff, made with the admin: a legible-by-default
 * site is no longer enforced at save time, only surfaced. `IssueSeverity`
 * keeps the `"error"` member and `validateTheme`'s `canSave` keeps
 * computing it (currently always `true`, since nothing produces `"error"`
 * anymore) rather than deleting the plumbing, in case a future call wants
 * a narrower, genuinely-blocking check again.
 */
export function validateMode(
  brand: BrandColors,
  surface: SurfacePalette,
  mode: "light" | "dark",
  overrides?: BrandOverrides,
): ContrastIssue[] {
  const b = { ...brand, ...overrides };
  const bg = surface.background;
  const issues: ContrastIssue[] = [];

  const blocking: Array<[string, string, string, string, number]> = [
    ["textPrimary", "Body text on background", surface.textPrimary, bg, 4.5],
    ["textSecondary", "Secondary text on background", surface.textSecondary, bg, 4.5],
    ["textPrimary", "Body text on muted surface", surface.textPrimary, surface.surfaceMuted, 4.5],
    ["borderMedium", "Input border on background", surface.borderMedium, bg, 3.0],
  ];

  for (const [field, label, fg, background, required] of blocking) {
    const ratio = contrastRatio(fg, background);
    if (ratio < required) {
      // None of these four are engine-derived (unlike button-label ink or
      // link text, which the renderer swaps automatically) — textPrimary/
      // textSecondary/borderMedium all render as-is via CSS vars. Editing
      // the light/dark background or muted surface is the most common way
      // to trip any of them (the fg token itself is untouched but its
      // contrast against the new bg isn't), so give a concrete same-hue
      // value that clears the floor rather than leaving the admin to hunt
      // for one by hand — same technique deriveInteractive already uses
      // for link text, just aimed at each check's own required ratio.
      const suggested = deriveInteractive(fg, background, required);
      issues.push({
        field,
        mode,
        label,
        ratio: Math.round(ratio * 100) / 100,
        required,
        severity: "warning",
        remedy: `Try ${suggested.toUpperCase()} instead — clears ${required}:1 here.`,
      });
    }
  }

  const fills = ["primary", "success", "error", "warning", "info"] as const;

  // Flagged when BOTH the light and dark label inks fail — i.e. a true
  // mid-tone fill with no legible label color at all. Must use the same
  // fixed candidates tokensToCss's readableOn uses, or this would flag
  // palettes the engine renders fine (the dark-mode default-brand
  // false-blocking bug).
  for (const key of fills) {
    const fill = b[key];
    const best = Math.max(contrastRatio(fill, "#FFFFFF"), contrastRatio(fill, "#1A1A1A"));
    if (best < 4.5) {
      issues.push({
        field: key,
        mode,
        label: `${key} button label`,
        ratio: Math.round(best * 100) / 100,
        required: 4.5,
        severity: "warning",
        remedy: "No legible label colour exists on this fill. Darken or lighten it.",
      });
    }
  }

  // Advisory: raw swatch used directly as link or inline text.
  for (const key of fills) {
    const ratio = contrastRatio(b[key], bg);
    if (ratio < 4.5) {
      const derived = deriveInteractive(b[key], bg);
      issues.push({
        field: key,
        mode,
        label: `${key} used directly as link text`,
        ratio: Math.round(ratio * 100) / 100,
        required: 4.5,
        severity: "warning",
        remedy: `Links and inline text render as ${derived.toUpperCase()} instead. The swatch is unchanged for fills, borders, and charts.`,
      });
    }
  }

  return issues;
}

export function validateTheme(
  brand: BrandColors,
  light: SurfacePalette,
  dark: SurfacePalette,
  darkOverrides?: BrandOverrides,
): { issues: ContrastIssue[]; canSave: boolean } {
  const issues = [
    ...validateMode(brand, light, "light"),
    ...validateMode(brand, dark, "dark", darkOverrides),
  ];
  return { issues, canSave: !issues.some((i) => i.severity === "error") };
}

// ─────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────

export interface ResolvedTheme {
  key: string;
  lightCss: string;
  darkCss: string;
  layout: LayoutTokens;
}

/**
 * Pure DB read, exported (not just the cached `getActiveTheme`) so tests can
 * exercise the loader directly without depending on Next's "use cache"
 * compiler transform, which is inert outside a real Next.js build/dev
 * process (ADR-004).
 *
 * A5.1 fix: fetch both candidate rows and pick the exact scope in code.
 * `orderBy: { scope: "asc" }` sorted "both" before "web" alphabetically —
 * the opposite of "exact scope wins" — so a web request silently got the
 * "both" theme whenever both were active. Fetching both and preferring the
 * exact match makes the precedence correct regardless of row order.
 */
export async function loadActiveTheme(scope: "web" | "admin"): Promise<ResolvedTheme> {
  const rows = await db.theme.findMany({
    where: { isActive: true, scope: { in: [scope, "both"] } },
  });
  const theme = rows.find((r) => r.scope === scope) ?? rows.find((r) => r.scope === "both");

  // Prisma's Json scalar type doesn't statically overlap with our token
  // interfaces — these columns are validated shape-on-write (Module 09's
  // theme editor + validateTheme), not re-validated on every read.
  const brand = (theme?.brandColors as unknown as BrandColors) ?? DEFAULT_BRAND;
  const light = (theme?.lightSurface as unknown as SurfacePalette) ?? DEFAULT_LIGHT_SURFACE;
  const dark = (theme?.darkSurface as unknown as SurfacePalette) ?? DEFAULT_DARK_SURFACE;
  const overrides =
    (theme?.darkBrandOverrides as unknown as BrandOverrides) ?? DEFAULT_DARK_BRAND_OVERRIDES;
  const rawLayout = (theme?.layoutTokens as unknown as LayoutTokens) ?? DEFAULT_LAYOUT;
  // Defensive default: an invalid/removed curated font key (see ADR-005's
  // noted consequence) falls back to the DEFAULT_LAYOUT family rather than
  // emitting a var() reference to a font that no longer exists. ADR-039
  // made that fallback the brand typeface instead of the OS stack — a
  // broken key should land on the brand, not look like an unstyled page.
  const layout: LayoutTokens = {
    ...rawLayout,
    fontSans: isCuratedFontKey(rawLayout.fontSans) ? rawLayout.fontSans : DEFAULT_LAYOUT.fontSans,
    fontMono: isCuratedFontKey(rawLayout.fontMono) ? rawLayout.fontMono : DEFAULT_LAYOUT.fontMono,
  };

  return {
    key: theme?.key ?? "default",
    lightCss: tokensToCss({ brand, surface: light, layout }),
    darkCss: tokensToCss({ brand, surface: dark, layout, overrides }),
    layout,
  };
}

/**
 * Production entry point. `"use cache"` (ADR-004) replaces the reference
 * code's `unstable_cache`; tag `theme` is frozen API (architecture.md #12).
 * Module 09's theme-save action invalidates with
 * `revalidateTag("theme", { expire: 0 })` on every write.
 */
export async function getActiveTheme(scope: "web" | "admin" = "web"): Promise<ResolvedTheme> {
  "use cache";
  cacheTag("theme");
  cacheLife({ revalidate: 3600 });
  return loadActiveTheme(scope);
}

export function buildThemeStyleSheet(t: ResolvedTheme): string {
  const fontSans = resolveFontValue(t.layout.fontSans);
  const fontMono = resolveFontValue(t.layout.fontMono);
  return [
    `:root{${t.lightCss}--brand-font-sans:${fontSans};--brand-font-mono:${fontMono};--brand-base-font-size:${t.layout.baseFontSize};}`,
    `.dark{${t.darkCss}}`,
  ].join("");
}

// ─────────────────────────────────────────────────────────────
// Field registry — makes the admin form itself data-driven
// ─────────────────────────────────────────────────────────────

/**
 * The Colors & Branding screen currently hardcodes seven fields with their
 * labels and helper text. Driving the form from this registry means adding a
 * "Chart Positive" colour later is a seeder row rather than a code change,
 * and the labels become translatable like everything else in the interface.
 */
export interface TokenFieldDefinition {
  key: keyof BrandColors;
  labelKey: string;
  descriptionKey: string;
  group: "brand" | "status";
  sortOrder: number;
}

export const BRAND_FIELD_REGISTRY: TokenFieldDefinition[] = [
  {
    key: "primary",
    group: "brand",
    sortOrder: 1,
    labelKey: "theme.primary.label",
    descriptionKey: "theme.primary.help",
  },
  {
    key: "secondary",
    group: "brand",
    sortOrder: 2,
    labelKey: "theme.secondary.label",
    descriptionKey: "theme.secondary.help",
  },
  {
    key: "success",
    group: "status",
    sortOrder: 3,
    labelKey: "theme.success.label",
    descriptionKey: "theme.success.help",
  },
  {
    key: "error",
    group: "status",
    sortOrder: 4,
    labelKey: "theme.error.label",
    descriptionKey: "theme.error.help",
  },
  {
    key: "warning",
    group: "status",
    sortOrder: 5,
    labelKey: "theme.warning.label",
    descriptionKey: "theme.warning.help",
  },
  {
    key: "info",
    group: "status",
    sortOrder: 6,
    labelKey: "theme.info.label",
    descriptionKey: "theme.info.help",
  },
  {
    key: "accent",
    group: "brand",
    sortOrder: 7,
    labelKey: "theme.accent.label",
    descriptionKey: "theme.accent.help",
  },
];
