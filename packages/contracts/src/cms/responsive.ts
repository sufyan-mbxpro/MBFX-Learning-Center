// Responsive value contracts (ADR-032 §3) — three fixed breakpoints (0 / 768
// / 1440, the composer's own preview widths). Only props a block definition
// marks `responsive: true` accept `ResponsiveValue<T>`; adding a fourth
// breakpoint is its own ADR because it changes every lookup table in
// `@repo/blocks/src/styles/tables.ts`.
import { z } from "zod";

export const RESPONSIVE_BREAKPOINTS = ["base", "md", "lg"] as const;
export type ResponsiveBreakpoint = (typeof RESPONSIVE_BREAKPOINTS)[number];

export const deviceSchema = z.enum(["mobile", "tablet", "desktop"]);
export type Device = z.infer<typeof deviceSchema>;

/** `T | { base: T; md?: T; lg?: T }` — a plain value is shorthand for "base only". */
export function responsiveValueSchema<T extends z.ZodType>(inner: T) {
  return z.union([
    inner,
    z.object({
      base: inner,
      md: inner.optional(),
      lg: inner.optional(),
    }),
  ]);
}

/** Reads a `ResponsiveValue<T>` down to its value for one breakpoint, falling back toward `base` — the same "smallest declared value wins downward" rule the CSS mobile-first cascade gives for free once classes are emitted (`styles/tables.ts` builds the class string across all three, this helper is for non-class consumers, e.g. tests and the composer's device toggle). */
export function readResponsiveValue<T>(
  value: T | { base: T; md?: T; lg?: T },
  breakpoint: ResponsiveBreakpoint,
): T {
  if (value === null || typeof value !== "object" || !("base" in (value as object))) {
    return value as T;
  }
  const record = value as { base: T; md?: T; lg?: T };
  if (breakpoint === "lg") return record.lg ?? record.md ?? record.base;
  if (breakpoint === "md") return record.md ?? record.base;
  return record.base;
}

/** The node envelope's own responsive field (ADR-032 §1/§3) — `hiddenOn` only. Per-block responsive props (columns.count, grid.columns, …) are declared by the block and typed `ResponsiveValue<T>` inside its own props schema, not here. */
export const responsiveOverridesSchema = z.object({
  hiddenOn: z.array(deviceSchema).max(3).optional(),
});
export type ResponsiveOverrides = z.infer<typeof responsiveOverridesSchema>;
