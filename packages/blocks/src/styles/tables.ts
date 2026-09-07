// Every enum -> class mapping in this package is a literal lookup table
// (ADR-032 §4): Tailwind v4 only emits classes it finds statically in
// source, so a table entry's VALUE must be the complete class string, never
// built from concatenated fragments — `${tone}/${strength}` would produce
// text Tailwind's scanner never sees as a whole and the class silently
// would not exist in the built CSS. The `classes-exist` test
// (render.test.tsx) renders every entry below and asserts the class is
// present in the CSS the package's own vitest globalSetup builds.
import type { Background, Overlay, StyleChoices } from "@repo/contracts";
import type { Device, ResponsiveBreakpoint } from "@repo/contracts";

export const PADDING_CLASS: Record<NonNullable<StyleChoices["padding"]>, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-8",
  lg: "p-12",
  xl: "p-16",
};

export const GAP_CLASS: Record<NonNullable<StyleChoices["gap"]>, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-8",
};

export const RADIUS_CLASS: Record<NonNullable<StyleChoices["radius"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
};

export const SHADOW_CLASS: Record<NonNullable<StyleChoices["shadow"]>, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

export const BORDER_CLASS: Record<NonNullable<StyleChoices["border"]>, string> = {
  none: "border-0",
  hairline: "border border-border",
  strong: "border-2 border-border",
};

export const WIDTH_CLASS: Record<NonNullable<StyleChoices["width"]>, string> = {
  narrow: "container-narrow",
  default: "container-page",
  wide: "container-page container-wide",
  full: "w-full",
};

export const BACKGROUND_TOKEN_CLASS: Record<
  Extract<Background, { kind: "token" }>["token"],
  string
> = {
  none: "",
  "surface-1": "bg-surface-1",
  "surface-2": "bg-surface-2",
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
};

export const TEXT_TONE_CLASS: Record<NonNullable<StyleChoices["textTone"]>, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  "on-primary": "text-primary-foreground",
  "on-image": "text-white",
};

export const GRADIENT_TOKEN_CLASS = {
  from: {
    primary: "from-primary",
    secondary: "from-secondary",
    accent: "from-accent",
  },
  to: {
    primary: "to-primary",
    secondary: "to-secondary",
    accent: "to-accent",
  },
} as const;

export const GRADIENT_DIRECTION_CLASS: Record<
  Extract<Background, { kind: "gradient" }>["direction"],
  string
> = {
  "to-b": "bg-gradient-to-b",
  "to-r": "bg-gradient-to-r",
  "to-br": "bg-gradient-to-br",
  radial: "bg-radial",
};

/** Two-level literal table (tone × strength) — the only shape that keeps every emitted overlay class a complete literal (ADR-032 §2/§4). */
export const OVERLAY_CLASS: Record<Overlay["tone"], Record<Overlay["strength"], string>> = {
  none: { sm: "", md: "", lg: "" },
  light: { sm: "bg-white/20", md: "bg-white/40", lg: "bg-white/60" },
  dark: { sm: "bg-black/20", md: "bg-black/40", lg: "bg-black/60" },
  brand: { sm: "bg-primary/20", md: "bg-primary/40", lg: "bg-primary/60" },
};

/** ADR-024 §2 motion — `hover` is a plain class, `entrance` wraps the node in the shipped `Reveal` component (render.tsx), never a class. */
export const HOVER_MOTION_CLASS: Record<"none" | "lift" | "zoom", string> = {
  none: "",
  lift: "card-hover",
  zoom: "media-zoom",
};

export const BACKGROUND_POSITION_CLASS: Record<
  Extract<Background, { kind: "image" }>["position"],
  string
> = {
  center: "bg-center",
  top: "bg-top",
  bottom: "bg-bottom",
};

/** `columns`/`grid` block column counts — a `ResponsiveValue<"1"|"2"|"3"|"4">` prop (ADR-032 §3). */
export const GRID_COLUMNS_CLASS: Record<
  ResponsiveBreakpoint,
  Record<"1" | "2" | "3" | "4", string>
> = {
  base: { "1": "grid-cols-1", "2": "grid-cols-2", "3": "grid-cols-3", "4": "grid-cols-4" },
  md: {
    "1": "md:grid-cols-1",
    "2": "md:grid-cols-2",
    "3": "md:grid-cols-3",
    "4": "md:grid-cols-4",
  },
  lg: {
    "1": "lg:grid-cols-1",
    "2": "lg:grid-cols-2",
    "3": "lg:grid-cols-3",
    "4": "lg:grid-cols-4",
  },
};

export const SPACER_HEIGHT_CLASS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-4",
  md: "h-8",
  lg: "h-16",
  xl: "h-24",
};

export const HIDDEN_ON_CLASS: Record<Device, string> = {
  mobile: "max-md:hidden",
  tablet: "md:max-lg:hidden",
  desktop: "lg:hidden",
};

/**
 * Builds the class list for a `ResponsiveValue<T>` prop against a
 * per-breakpoint literal table, e.g. `{ base: { "2": "grid-cols-2" }, md: {
 * "2": "md:grid-cols-2" }, lg: { "2": "lg:grid-cols-2" } }`. A plain
 * (non-object) value is shorthand for "base only" (ADR-032 §3).
 */
export function responsiveClasses<T extends string>(
  table: Record<ResponsiveBreakpoint, Record<T, string>>,
  value: T | { base: T; md?: T; lg?: T },
): string[] {
  const record =
    value !== null && typeof value === "object" && "base" in value
      ? (value as { base: T; md?: T; lg?: T })
      : { base: value as T };
  const classes = [table.base[record.base]];
  if (record.md) classes.push(table.md[record.md]);
  if (record.lg) classes.push(table.lg[record.lg]);
  return classes.filter(Boolean);
}
