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
  /** `serif` is the display category added by ADR-102. */
  category: "sans" | "serif" | "mono";
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
  // Display serifs (ADR-102). `fontDisplay` picks from these; nothing stops an
  // admin picking a sans key there instead, which is what a site that wants no
  // serif does. Fraunces is the default for its optical-size axis — the
  // reference's headline is a display cut, and a text serif scaled to 64px
  // looks thin and wide in exactly the way that headline does not.
  { key: "fraunces", label: "Fraunces", category: "serif" },
  { key: "playfair", label: "Playfair Display", category: "serif" },
  { key: "cormorant", label: "Cormorant Garamond", category: "serif" },
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

// `system-ui` leads because it is what the owner's reference site (mbfx.co)
// actually renders in (ADR-140 §1): Segoe UI on Windows, San Francisco on a
// Mac. The named faces behind it cover browsers that predate the keyword.
const SYSTEM_SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
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
  /**
   * The public display face (ADR-102) — headings, the hero line, stat
   * numerals, pull quotes. OPTIONAL, and absent means `fontSans`: every Theme
   * row that exists predates this field, so requiring it would break saves it
   * was never meant to touch (the same reason `baseFontSize` is optional in
   * the contracts schema). The admin surface does not use it — code-style #6
   * keeps the admin on one typeface.
   */
  fontDisplay?: CuratedFontKey;
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
  // The owner's saved bronze (ADR-143). Its label ink is fixed white, by the
  // owner's rule, not a contrast pick.
  primary: "#C8986B",
  secondary: "#2A2A29",
  // `error` is the AA-safe sibling of the reference's #E23C36: white labels
  // clear 4.5:1 on it (ADR-072 §3).
  //
  // ADR-142 (changes-45): NO BLUE. `success` was #2D72C7 and `info` #004284,
  // so every "Published" badge, every confirmation and every tip on both
  // surfaces was the one colour the site's palette does not contain. The
  // owner's rule is "use the site's default colours": `success` is the brand
  // bronze darkened until white clears 4.5:1 — the same value
  // `--primary-solid` derives, and the owner's reference user page marks
  // ACTIVE / APPROVED / Verified in exactly that fill — and `info` is a warm
  // graphite from the neutral ramp, the reference's charcoal status chip.
  success: "#936B44",
  error: "#D93A34",
  warning: "#FFA310",
  info: "#5A524B",
  accent: "#EAE5DE",
};

/**
 * Warm neutrals (ADR-101 §2, superseding ADR-072 §4's slate).
 *
 * The changes-31 reference shares our bronze `primary` almost exactly, so the
 * whole colour delta between our surface and its was TEMPERATURE: slate is
 * blue-biased at every step, and a bronze primary on it reads as a brown
 * button on a grey site rather than as one material.
 *
 * `background` is the ivory ground and `surface` stays white on purpose: that
 * 1.11:1 step is what separates a card from the page, which is why the public
 * card can drop its resting shadow (ADR-101 §4). A lighter ivory was tried
 * first and measured 1.04:1 — too small to separate anything, which would have
 * put the border back to do the ground's job.
 */
export const DEFAULT_LIGHT_SURFACE: SurfacePalette = {
  background: "#F7F3ED",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EBE3",
  textPrimary: "#1E1B18",
  // The value the warm rotation constrained. The first candidate (`#77706A`)
  // cleared the background at 4.64:1 and FAILED the muted surface at 4.32:1 —
  // the exact pair the slate note this replaces was written about. Darkened
  // until both pass (4.96 background, 4.62 muted) rather than lightening the
  // muted surface, which is the tint the reference is actually made of.
  textSecondary: "#6F6862",
  // Captions only, and never the sole carrier of meaning. 3.20:1 on the
  // background — better than the slate value it replaces (2.60:1 on white).
  textMuted: "#8F877E",
  borderLight: "#E6DFD4",
  // The input border. Same derivation ADR-072 §4 recorded for slate, re-run on
  // the warm ramp: the point that clears 3:1 on BOTH background (3.37) and the
  // muted surface (3.14), so a field inside a muted panel also passes.
  borderMedium: "#8C837A",
};

/**
 * The warm ramp on a near-black espresso ground (ADR-101 §2).
 *
 * Derived, not copied: the reference has no dark mode, and ADR-008 makes mode
 * the USER's and never the admin's, so a dark counterpart has to be reasoned
 * out rather than left as the cool set under a warm light set.
 */
export const DEFAULT_DARK_SURFACE: SurfacePalette = {
  background: "#14110F",
  surface: "#1B1714",
  surfaceMuted: "#241F1A",
  textPrimary: "#F7F3EE",
  textSecondary: "#A79E94",
  textMuted: "#7E766C",
  borderLight: "#2B251F",
  // 3:1 on both the dark background (3.61) and its muted surface (3.13), same
  // derivation as the light value.
  borderMedium: "#756B60",
};

/**
 * #EAE5DE is a light-surface tint — on a dark background it becomes a
 * near-white block. #2A2A29 is near-black and disappears entirely. These two
 * are the only defaults that need a dark counterpart; the four status colours
 * and the primary all survive the mode switch. Dark accent is the muted
 * surface because the reference says so in its own markup: its active and
 * hover nav states are `dark:bg-muted` — which is why it moves with the muted
 * surface when that surface goes warm (ADR-101 §2).
 */
export const DEFAULT_DARK_BRAND_OVERRIDES: BrandOverrides = {
  accent: "#241F1A",
  secondary: "#E8E6E3",
};

export const DEFAULT_LAYOUT: LayoutTokens = {
  // sm 4 / md 6 / lg 8 / xl 12 via @repo/ui's radius formula (ADR-072 §8).
  radiusBase: "6px",
  containerWidth: "1400px",
  // ADR-140 §1: the operating system's UI face, which is what the owner's
  // reference site renders in (it declares a webfont and applies it nowhere).
  // Inter (ADR-072) and Outfit (ADR-039) stay selectable registry keys.
  fontSans: "system",
  fontMono: "systemmono",
  // ADR-140 §1 retires ADR-102's serif default: display type is the same
  // system face, set bold. The slot stays, so a serif is one key away.
  fontDisplay: "system",
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
 * #936B44 against bare white, which passes 4.5:1 and still reads as the
 * brand. The emitted tokens go through deriveTonalInk below (ADR-073), which
 * asks the same question against a harder surface.
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

/**
 * How strong a tint of its own hue an `*-interactive` ink is contracted to
 * stay legible on (ADR-073). Tonal chips and intent buttons rest at /10 and
 * hover at /15 — the reference's status language — so the ink must hold on
 * the /15 surface, not only on the bare page.
 */
export const TONAL_TINT_CONTRACT = 0.15;

/** `color` laid over `background` at `amount` opacity, as the browser composites it. */
function mixOver(color: string, background: string, amount: number): string {
  const c = hexToRgb(color);
  const b = hexToRgb(background);
  return rgbToHex(
    c[0] * amount + b[0] * (1 - amount),
    c[1] * amount + b[1] * (1 - amount),
    c[2] * amount + b[2] * (1 - amount),
  );
}

/**
 * The derivation every `*-interactive` token uses (ADR-073): deriveInteractive
 * measured against the colour's own tint at TONAL_TINT_CONTRACT, which is the
 * harder surface in both modes — darker than a light page, lighter than a
 * dark one — so an ink that clears it clears the bare page as well.
 * Measured against the page alone, success/destructive/primary landed at
 * 3.95–4.41:1 inside their own tonal chips.
 */
export function deriveTonalInk(color: string, background: string, target = 4.5): string {
  const tinted = mixOver(color, background, TONAL_TINT_CONTRACT);

  // BOTH surfaces, not just the tint.
  //
  // This used to delegate straight to `deriveInteractive(color, tinted)` on the
  // reasoning quoted above: the tint is the harder surface, so an ink that
  // clears it clears the page too. That held only while the page was PURE
  // WHITE. Once the light ground became ivory (ADR-101), a near-white fill
  // tints to something LIGHTER than the page, and the implication runs the
  // other way — the fast-check contract found it immediately, at 4.4894:1
  // against a 4.5 floor.
  //
  // So the search tests both rather than assuming which one is harder. That is
  // correct for any background an admin can set, which is the property the
  // contract is actually asserting.
  const clears = (candidate: string) =>
    contrastRatio(candidate, tinted) >= target && contrastRatio(candidate, background) >= target;

  if (clears(color)) return color;

  const direction = luminance(background) > 0.5 ? -1 : 1;
  for (let step = 1; step <= 20; step++) {
    const candidate = shade(color, direction * step * 0.04);
    if (clears(candidate)) return candidate;
  }
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
    // Every *-interactive ink is tint-aware (ADR-073): legible on the page AND
    // inside its own tonal chip, up to TONAL_TINT_CONTRACT.
    "--primary": b.primary,
    // ADR-143: text and icons ON a primary fill are always white, and do not
    // follow the theme colour — the owner's rule, not a contrast pick.
    "--primary-foreground": INK_LIGHT,
    "--primary-interactive": deriveTonalInk(b.primary, bg),
    // Derived, never admin-editable (ADR-003).
    "--primary-hover": shade(b.primary, -0.14),
    "--primary-active": shade(b.primary, -0.26),
    "--primary-subtle": shade(b.primary, 0.85),
    // ADR-143 (superseding ADR-140 §6's fill): the SOLID button fill is the
    // primary the admin SAVED, never a contrast-derived sibling — what the
    // theme editor shows is what a button shows. The label is always white,
    // at the owner's request, whatever contrast that gives on the fill.
    "--primary-solid": b.primary,
    "--primary-solid-foreground": INK_LIGHT,
    "--primary-solid-hover": shade(b.primary, -0.12),

    "--secondary": b.secondary,
    "--secondary-foreground": readableOn(b.secondary, onDark, onLight),

    "--accent": b.accent,
    "--accent-foreground": readableOn(b.accent, onDark, onLight),

    "--success": b.success,
    // ADR-143: ink on the brand status fills is fixed white, like primary —
    // editing the theme colours never flips it. Warning (amber) keeps its
    // contrast pick: white on a yellow is the one pairing nobody can read.
    "--success-foreground": INK_LIGHT,
    "--success-interactive": deriveTonalInk(b.success, bg),

    "--destructive": b.error,
    "--destructive-foreground": INK_LIGHT,
    "--destructive-interactive": deriveTonalInk(b.error, bg),

    "--warning": b.warning,
    "--warning-foreground": readableOn(b.warning, onDark, onLight),
    "--warning-interactive": deriveTonalInk(b.warning, bg),

    "--info": b.info,
    "--info-foreground": INK_LIGHT,
    "--info-interactive": deriveTonalInk(b.info, bg),

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

/**
 * What a check measured (changes-46). The editor turns this into a sentence
 * from the catalog; `label` and `remedy` stay as the developer-facing English
 * the tests and the audit trail read, never as the admin's message.
 *
 * - `surfaceText` — a text colour on a surface; rendered as-is, so it is
 *   genuinely hard to read until it changes.
 * - `border` — the input border on a surface (3:1, a graphical object).
 * - `buttonLabel` — no label ink (white or near-black) is legible on a fill.
 * - `linkText` — the raw swatch as link text. The renderer already swaps in
 *   a derived ink (`rendered`), so this one needs NO action.
 */
export type ContrastIssueKind = "surfaceText" | "border" | "buttonLabel" | "linkText";

export interface ContrastIssue {
  field: string;
  mode: "light" | "dark";
  label: string;
  ratio: number;
  required: number;
  severity: IssueSeverity;
  remedy?: string;
  kind: ContrastIssueKind;
  /**
   * Which editor input holds `field`: a brand swatch (shared by both modes),
   * one mode's surface palette, or a dark-mode brand override — which the
   * editor does not expose, so an issue on one carries no suggestion.
   */
  palette: "brand" | "light" | "dark" | "darkOverride";
  /** The colour currently in that input. */
  current: string;
  /** The surface field it was measured against (`linkText`/`surfaceText`/`border`). */
  against?: "background" | "surfaceMuted";
  /** `tooLight` or `tooDark` relative to what it was measured against. */
  direction: "tooLight" | "tooDark";
  /** `linkText` only: the ink the site actually renders instead. */
  rendered?: string;
  /**
   * A value for the input that clears this check. Absent when the input is
   * not one the editor exposes (a dark-mode override).
   */
  suggestion?: string;
  /**
   * `linkText` on a brand swatch: the suggestion clears this mode but newly
   * fails the same check in the other one (see `flagCrossModeConflict`).
   */
  conflictsAcrossModes?: boolean;
}

/**
 * Which way a failing colour is wrong, in the words a fix uses: on a light
 * surface it is too light (the fix darkens it), on a dark one too dark. The
 * same split `deriveInteractive` pushes along, so the words and the
 * suggestion always agree.
 */
function directionOf(_color: string, against: string): "tooLight" | "tooDark" {
  return luminance(against) > 0.5 ? "tooLight" : "tooDark";
}

const LABEL_INKS = ["#FFFFFF", "#1A1A1A"] as const;

/**
 * The nearest fill to `fill` that a label ink can be read on at `target` —
 * darkened toward white labels or lightened toward near-black ones,
 * whichever needs the smaller move. Pure; exported for the tests.
 */
export function suggestButtonFill(fill: string, target = 4.5): string {
  const candidates = LABEL_INKS.map((ink) => deriveInteractive(fill, ink, target));
  const distance = (hex: string) => {
    const a = hexToRgb(hex);
    const b = hexToRgb(fill);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  };
  return [...candidates].sort((a, b) => distance(a) - distance(b))[0] ?? fill;
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

  const blocking: Array<[keyof SurfacePalette, string, string, string, number]> = [
    ["textPrimary", "Body text on background", surface.textPrimary, bg, 4.5],
    ["textSecondary", "Secondary text on background", surface.textSecondary, bg, 4.5],
    ["textPrimary", "Body text on muted surface", surface.textPrimary, surface.surfaceMuted, 4.5],
    // The pair this list was MISSING, and the one the defaults failed.
    // `--muted-foreground` on `--muted` is everywhere — a sub-nav's inactive
    // tab, a `<kbd>`, a badge, any secondary line inside a muted tray — and
    // checking secondary text only against the background quietly permitted
    // all of it at 4.34:1.
    [
      "textSecondary",
      "Secondary text on muted surface",
      surface.textSecondary,
      surface.surfaceMuted,
      4.5,
    ],
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
        kind: field === "borderMedium" ? "border" : "surfaceText",
        palette: mode,
        current: fg.toUpperCase(),
        against: background === bg ? "background" : "surfaceMuted",
        direction: directionOf(fg, background),
        suggestion: suggested.toUpperCase(),
      });
    }
  }

  const fills = ["primary", "success", "error", "warning", "info"] as const;
  // A dark-mode override is its own stored value the editor does not expose;
  // an issue on it names the swatch but offers nothing to apply.
  const paletteOf = (key: string): ContrastIssue["palette"] =>
    mode === "dark" && overrides && key in overrides ? "darkOverride" : "brand";

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
        kind: "buttonLabel",
        palette: paletteOf(key),
        current: fill.toUpperCase(),
        // Relative to the ink it is nearest to reading with.
        direction: luminance(fill) > 0.18 ? "tooLight" : "tooDark",
        ...(paletteOf(key) === "brand"
          ? { suggestion: suggestButtonFill(fill).toUpperCase() }
          : {}),
      });
    }
  }

  // Advisory: raw swatch used directly as link or inline text.
  for (const key of fills) {
    const ratio = contrastRatio(b[key], bg);
    if (ratio < 4.5) {
      // The same derivation tokensToCss emits (ADR-073), so the remedy names
      // the colour the renderer actually uses.
      const derived = deriveTonalInk(b[key], bg);
      issues.push({
        field: key,
        mode,
        label: `${key} used directly as link text`,
        ratio: Math.round(ratio * 100) / 100,
        required: 4.5,
        severity: "warning",
        remedy: `Links and inline text render as ${derived.toUpperCase()} instead. The swatch is unchanged for fills, borders, and charts.`,
        kind: "linkText",
        palette: paletteOf(key),
        current: b[key].toUpperCase(),
        against: "background",
        direction: directionOf(b[key], bg),
        rendered: derived.toUpperCase(),
        ...(paletteOf(key) === "brand"
          ? { suggestion: deriveInteractive(b[key], bg, 4.5).toUpperCase() }
          : {}),
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
  ].map((issue) => flagCrossModeConflict(issue, brand, light, dark, darkOverrides));
  return { issues, canSave: !issues.some((i) => i.severity === "error") };
}

/**
 * A brand swatch is ONE value used in both modes, so a suggestion made for
 * one mode is checked against the other (changes-46). For link text there is
 * usually NO value that passes on both the ivory and the espresso page — the
 * luminance windows do not overlap — so darkening `primary` to read on light
 * makes it fail on dark. That is flagged, not hidden: link text is always
 * compensated by the derived ink, so applying the value costs readability
 * nowhere, but it moves the brand colour and moves the advisory to the other
 * mode, and the admin should know that before pressing Apply.
 */
function flagCrossModeConflict(
  issue: ContrastIssue,
  brand: BrandColors,
  light: SurfacePalette,
  dark: SurfacePalette,
  darkOverrides?: BrandOverrides,
): ContrastIssue {
  if (issue.palette !== "brand" || !issue.suggestion || issue.kind !== "linkText") return issue;
  const otherMode = issue.mode === "light" ? "dark" : "light";
  // The other mode renders the override when there is one, so the brand
  // value cannot affect it there.
  if (otherMode === "dark" && darkOverrides && issue.field in darkOverrides) return issue;
  const otherBg = otherMode === "light" ? light.background : dark.background;
  const before = contrastRatio(brand[issue.field as keyof BrandColors], otherBg);
  const after = contrastRatio(issue.suggestion, otherBg);
  return after < issue.required && before >= issue.required
    ? { ...issue, conflictsAcrossModes: true }
    : issue;
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
/** The active theme's tokens as VALUES rather than CSS. */
export interface ActiveThemeTokens {
  key: string;
  brand: BrandColors;
  light: SurfacePalette;
  dark: SurfacePalette;
  overrides: BrandOverrides;
  layout: LayoutTokens;
}

/**
 * For consumers that cannot use custom properties at all: email clients
 * (ADR-078 #7), generated art, anything rendered outside a browser. Same rows
 * and the same fallbacks as `loadActiveTheme`, which is built on this — so a
 * re-brand reaches email without a second copy of the defaults drifting here.
 */
export async function loadActiveThemeTokens(
  scope: "web" | "admin" = "web",
): Promise<ActiveThemeTokens> {
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
  const fontSans = isCuratedFontKey(rawLayout.fontSans)
    ? rawLayout.fontSans
    : DEFAULT_LAYOUT.fontSans;
  const layout: LayoutTokens = {
    ...rawLayout,
    fontSans,
    fontMono: isCuratedFontKey(rawLayout.fontMono) ? rawLayout.fontMono : DEFAULT_LAYOUT.fontMono,
    // ADR-102 §2: absent or unknown means the SANS, not the default display
    // face. A row saved before this field existed must render exactly as it
    // did, and silently promoting it to a serif would be a redesign nobody
    // asked for — which is a different failure from the invalid-key fallback
    // the two lines above make (there, a named-but-missing family would emit a
    // var() reference to nothing).
    fontDisplay: isCuratedFontKey(rawLayout.fontDisplay ?? "") ? rawLayout.fontDisplay : fontSans,
  };

  return { key: theme?.key ?? "default", brand, light, dark, overrides, layout };
}

export async function loadActiveTheme(scope: "web" | "admin"): Promise<ResolvedTheme> {
  const { key, brand, light, dark, overrides, layout } = await loadActiveThemeTokens(scope);
  return {
    key,
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

/**
 * The admin portal's typeface (ADR-141). The owner's reference for the admin
 * is its sister portal, which is set in Inter; the PUBLIC reference renders
 * in the system face (ADR-140 §1). One `layoutTokens` row cannot say both, and
 * the font controls are the paused Layout & Display tab (ADR-038), so no admin
 * setting was ever deciding this — ADR-140's migration moved the admin with
 * the public site as a side effect. The admin surfaces pin it here instead.
 */
export const ADMIN_FONT_SANS = "inter" satisfies CuratedFontKey;

/** `theme` with the admin typeface in both text slots. Mono is untouched. */
export function withAdminTypeface(t: ResolvedTheme): ResolvedTheme {
  return {
    ...t,
    layout: { ...t.layout, fontSans: ADMIN_FONT_SANS, fontDisplay: ADMIN_FONT_SANS },
  };
}

export function buildThemeStyleSheet(t: ResolvedTheme): string {
  const fontSans = resolveFontValue(t.layout.fontSans);
  const fontMono = resolveFontValue(t.layout.fontMono);
  // ADR-102. `loadActiveThemeTokens` already resolved an absent slot to the
  // sans key, so this never emits an empty value — but a ResolvedTheme handed
  // in directly by a test or a preview would, hence the second fallback here
  // rather than a non-null assertion.
  const fontDisplay = resolveFontValue(t.layout.fontDisplay ?? t.layout.fontSans);
  return [
    `:root{${t.lightCss}--brand-font-sans:${fontSans};--brand-font-mono:${fontMono};--brand-font-display:${fontDisplay};--brand-base-font-size:${t.layout.baseFontSize};}`,
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
