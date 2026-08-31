// packages/theme/src/theme-engine.ts  (v2)
//
// Revised to match the Theme Settings admin exactly:
//
//   Tab 1  Colors & Branding  → BrandColors      (7 fields, mode-independent)
//   Tab 2  Layout & Display   → LayoutTokens
//   Tab 3  Theme Modes        → SurfacePalette   (one per mode)
//   Tab 4  Logos & Favicons   → BrandAsset rows
//
// Change from v1: brand colours are authored once and shared across light and
// dark; surfaces are authored per mode. Everything that must satisfy a
// contrast rule is derived, never typed by a human.

import { unstable_cache } from "next/cache";
import { db } from "@repo/db";

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
  fontSans: string;
  fontMono: string;
}

/**
 * Escape hatch, used rarely. A brand colour that reads well on white can be
 * wrong on a near-black surface. Populate only the keys that fail validation
 * in dark mode — the admin should surface these one at a time rather than
 * presenting a second full palette to fill in.
 */
export type BrandOverrides = Partial<BrandColors>;

// ─────────────────────────────────────────────────────────────
// Defaults — the values currently in the admin
// ─────────────────────────────────────────────────────────────

export const DEFAULT_BRAND: BrandColors = {
  primary: "#C28D5A",
  secondary: "#2A2A29",
  success: "#3382E2",
  error: "#E23C36",
  warning: "#FFA310",
  info: "#004284",
  accent: "#EAE5DE",
};

export const DEFAULT_LIGHT_SURFACE: SurfacePalette = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8F8F8",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  textMuted: "#999999",
  borderLight: "#E5E5E5",
  borderMedium: "#D0D0D0",
};

export const DEFAULT_DARK_SURFACE: SurfacePalette = {
  background: "#141413",
  surface: "#1C1C1A",
  surfaceMuted: "#252523",
  textPrimary: "#F5F4F2",
  textSecondary: "#A8A6A2",
  textMuted: "#78766F",
  borderLight: "#2E2E2B",
  borderMedium: "#3D3D39",
};

/**
 * #EAE5DE is a light-surface tint — on a dark background it becomes a
 * near-white block. #2A2A29 is near-black and disappears entirely. These two
 * are the only defaults that need a dark counterpart; the four status colours
 * and the primary all survive the mode switch.
 */
export const DEFAULT_DARK_BRAND_OVERRIDES: BrandOverrides = {
  accent: "#332E27",
  secondary: "#E8E6E3",
};

export const DEFAULT_LAYOUT: LayoutTokens = {
  radiusBase: "4px",
  containerWidth: "1400px",
  fontSans:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontMono: "'Courier New', Courier, monospace",
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
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => (amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return rgbToHex(f(r), f(g), f(b));
}

function rgbChannels(hex: string): string {
  return hexToRgb(hex).join(" ");
}

function readableOn(bg: string, light: string, dark: string): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/**
 * The important function.
 *
 * A brand colour has two jobs that pull against each other: it identifies the
 * product, and it has to be legible as link text. #C28D5A does the first well
 * and fails the second at 2.90:1 on white — below even the 3:1 floor for
 * non-text UI.
 *
 * Rather than making an admin abandon their brand colour, keep it for identity
 * (fills, borders, chart series, swatches) and derive a same-hue sibling for
 * interactive text until it clears the threshold. #C28D5A resolves to about
 * #9A6A40 on white, which passes at 4.66:1 and still reads as the brand.
 */
function deriveInteractive(color: string, background: string, target = 4.5): string {
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

export function tokensToCss({ brand, surface, layout, overrides }: ModeInput): string {
  const b: BrandColors = { ...brand, ...overrides };
  const bg = surface.background;
  const onLight = surface.textPrimary;
  const onDark = "#FFFFFF";

  const vars: Record<string, string> = {
    // Surfaces
    "--background": rgbChannels(surface.background),
    "--foreground": rgbChannels(surface.textPrimary),
    "--card": rgbChannels(surface.surface),
    "--card-foreground": rgbChannels(surface.textPrimary),
    "--popover": rgbChannels(surface.surface),
    "--popover-foreground": rgbChannels(surface.textPrimary),
    "--muted": rgbChannels(surface.surfaceMuted),
    "--muted-foreground": rgbChannels(surface.textSecondary),
    "--border": rgbChannels(surface.borderLight),
    "--input": rgbChannels(surface.borderMedium),

    // Primary. Identity value and interactive value are deliberately separate.
    "--primary": rgbChannels(b.primary),
    "--primary-foreground": rgbChannels(readableOn(b.primary, onDark, onLight)),
    "--primary-interactive": rgbChannels(deriveInteractive(b.primary, bg)),
    "--primary-hover": rgbChannels(shade(b.primary, -0.14)),
    "--primary-active": rgbChannels(shade(b.primary, -0.26)),
    "--primary-subtle": rgbChannels(shade(b.primary, 0.85)),

    "--secondary": rgbChannels(b.secondary),
    "--secondary-foreground": rgbChannels(readableOn(b.secondary, onDark, onLight)),

    "--accent": rgbChannels(b.accent),
    "--accent-foreground": rgbChannels(readableOn(b.accent, onDark, onLight)),

    "--success": rgbChannels(b.success),
    "--success-foreground": rgbChannels(readableOn(b.success, onDark, onLight)),
    "--success-interactive": rgbChannels(deriveInteractive(b.success, bg)),

    "--destructive": rgbChannels(b.error),
    "--destructive-foreground": rgbChannels(readableOn(b.error, onDark, onLight)),
    "--destructive-interactive": rgbChannels(deriveInteractive(b.error, bg)),

    "--warning": rgbChannels(b.warning),
    "--warning-foreground": rgbChannels(readableOn(b.warning, onDark, onLight)),
    "--warning-interactive": rgbChannels(deriveInteractive(b.warning, bg)),

    "--info": rgbChannels(b.info),
    "--info-foreground": rgbChannels(readableOn(b.info, onDark, onLight)),
    "--info-interactive": rgbChannels(deriveInteractive(b.info, bg)),

    // The focus ring is a graphical indicator, so 3:1 is the correct bar,
    // not 4.5:1.
    "--ring": rgbChannels(deriveInteractive(b.success, bg, 3.0)),

    "--text-muted": rgbChannels(surface.textMuted),
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
 * Blocking vs advisory matters here.
 *
 * `error` blocks the save: body text, button labels, and input borders are
 * load-bearing, and a dismissible warning gets dismissed.
 *
 * `warning` is advisory: the raw brand swatch fails as link text, but the
 * engine already derives a passing variant, so the rendered site is compliant.
 * The admin should learn their swatch is not directly usable as text without
 * being blocked from saving their own brand colour.
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
      issues.push({
        field,
        mode,
        label,
        ratio: Math.round(ratio * 100) / 100,
        required,
        severity: "error",
      });
    }
  }

  const fills = ["primary", "success", "error", "warning", "info"] as const;

  // Button labels are solvable by derivation, so this is only an error when
  // BOTH white and the surface text colour fail — i.e. a mid-tone fill.
  for (const key of fills) {
    const fill = b[key];
    const best = Math.max(contrastRatio(fill, "#FFFFFF"), contrastRatio(fill, surface.textPrimary));
    if (best < 4.5) {
      issues.push({
        field: key,
        mode,
        label: `${key} button label`,
        ratio: Math.round(best * 100) / 100,
        required: 4.5,
        severity: "error",
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

async function loadActiveTheme(scope: "web" | "admin"): Promise<ResolvedTheme> {
  const theme = await db.theme.findFirst({
    where: { isActive: true, scope: { in: [scope, "both"] } },
    orderBy: { scope: "asc" }, // exact scope wins over "both"
  });

  const brand = (theme?.brandColors as BrandColors) ?? DEFAULT_BRAND;
  const light = (theme?.lightSurface as SurfacePalette) ?? DEFAULT_LIGHT_SURFACE;
  const dark = (theme?.darkSurface as SurfacePalette) ?? DEFAULT_DARK_SURFACE;
  const overrides = (theme?.darkBrandOverrides as BrandOverrides) ?? DEFAULT_DARK_BRAND_OVERRIDES;
  const layout = (theme?.layoutTokens as LayoutTokens) ?? DEFAULT_LAYOUT;

  return {
    key: theme?.key ?? "default",
    lightCss: tokensToCss({ brand, surface: light, layout }),
    darkCss: tokensToCss({ brand, surface: dark, layout, overrides }),
    layout,
  };
}

export const getActiveTheme = (scope: "web" | "admin" = "web") =>
  unstable_cache(() => loadActiveTheme(scope), ["active-theme", scope], {
    tags: ["theme"],
    revalidate: 3600,
  })();

export function buildThemeStyleSheet(t: ResolvedTheme): string {
  return [
    `:root{${t.lightCss}--font-sans:${t.layout.fontSans};--font-mono:${t.layout.fontMono};}`,
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
