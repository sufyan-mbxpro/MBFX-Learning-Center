import type { VolatilityLevel } from "@repo/utils";

// One tone per level, shared by the board's badges and the explainer's key,
// so the legend can never disagree with the cards it explains. The tonal
// Badge variants (ADR-073) are the design system's status inks, and the
// order goes from quiet to loud.
export const VOLATILITY_LEVEL_BADGE = {
  low: "success",
  medium: "info",
  high: "warning",
  extreme: "danger",
} as const satisfies Record<VolatilityLevel, "success" | "info" | "warning" | "danger">;

export const VOLATILITY_LEVEL_ORDER: readonly VolatilityLevel[] = [
  "low",
  "medium",
  "high",
  "extreme",
];
