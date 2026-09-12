// Tools contracts (Module 13, ADR-086).
//
// ADR-086 #1 draws the line this file exists to hold: **the set of tools is
// code, and everything a tool SAYS is data.** What lives here is the code
// half — which tools exist, what URL each one owns, what kind of data it
// needs, and the shape of the `config` column an admin edits. What lives in a
// `Tool` row is every word, default, limit and instrument list.
//
// A calculator is not composable from admin fields. Module 16 (ADR-042) is
// what that looks like when it is tried, so the registry below is deliberately
// the only place the eight are enumerated, and `tools.test.ts` fails in both
// directions when it drifts from `ROUTE_PATHS`.
import { z } from "zod";

import { ROUTE_PATHS, type RouteKey } from "./navigation.ts";

// ─── The eight (ADR-086 #1) ──────────────────────────────────

export const TOOL_KEYS = [
  "position-size",
  "pip-value",
  "gain-loss",
  "pivot-points",
  "market-hours",
  "currency-converter",
  "correlation",
  "risk-sentiment",
] as const;

export type ToolKey = (typeof TOOL_KEYS)[number];

export function isToolKey(key: string): key is ToolKey {
  return (TOOL_KEYS as readonly string[]).includes(key);
}

/**
 * What data a tool's page has to read before it can render.
 *
 * `"none"` tools work on a laptop with no network and no provider key at all,
 * which is why five of the eight ship in T6 ahead of the platform. `"rates"`
 * takes ADR-087 #7's single cached snapshot; `"history"` reads daily bars.
 */
export type ToolNeeds = "none" | "rates" | "history";

export interface ToolSpec {
  readonly key: ToolKey;
  readonly routeKey: RouteKey;
  readonly needs: ToolNeeds;
  /**
   * A lucide icon NAME, resolved to a component in the app.
   *
   * Held as a string here for ADR-048's reason: @repo/contracts depends only
   * on zod and may not import lucide-react, and `LEARN_TRACKS` sets the same
   * precedent for its message keys. The app's `TOOL_ICONS` map is what turns
   * it into a component, and a name with no entry there fails that map's own
   * exhaustiveness check rather than rendering nothing.
   */
  readonly icon: string;
  /** Seeded `Tool.relatedCount` for this tool (ADR-086 #4). */
  readonly defaultRelatedCount: number;
  /** The feature flag that gates the whole tool, if any (ADR-086 #5). */
  readonly flag?: string;
}

export const TOOLS = {
  "position-size": {
    key: "position-size",
    routeKey: "tool-position-size",
    needs: "rates",
    icon: "calculator",
    defaultRelatedCount: 6,
    flag: "calculators",
  },
  "pip-value": {
    key: "pip-value",
    routeKey: "tool-pip-value",
    needs: "rates",
    icon: "coins",
    defaultRelatedCount: 6,
    flag: "calculators",
  },
  "gain-loss": {
    key: "gain-loss",
    routeKey: "tool-gain-loss",
    needs: "none",
    icon: "percent",
    defaultRelatedCount: 6,
    flag: "calculators",
  },
  "pivot-points": {
    key: "pivot-points",
    routeKey: "tool-pivot-points",
    needs: "history",
    icon: "git-fork",
    defaultRelatedCount: 6,
    flag: "calculators",
  },
  "market-hours": {
    key: "market-hours",
    routeKey: "tool-market-hours",
    needs: "none",
    icon: "clock",
    defaultRelatedCount: 6,
  },
  "currency-converter": {
    key: "currency-converter",
    routeKey: "tool-currency-converter",
    needs: "rates",
    icon: "arrow-left-right",
    defaultRelatedCount: 6,
    flag: "currency_converter",
  },
  correlation: {
    key: "correlation",
    routeKey: "tool-correlation",
    needs: "history",
    icon: "grid-3x3",
    defaultRelatedCount: 6,
  },
  "risk-sentiment": {
    key: "risk-sentiment",
    routeKey: "tool-risk-sentiment",
    needs: "history",
    icon: "gauge",
    defaultRelatedCount: 6,
  },
} as const satisfies Record<ToolKey, ToolSpec>;

/**
 * The join between `TOOL_KEYS` and `ROUTE_PATHS`, in `LEARN_TRACK_ROUTE_KEYS`'
 * role.
 *
 * DERIVED from `TOOLS` rather than typed out a second time beside it: the
 * binding already exists as `ToolSpec.routeKey`, and a hand-written copy would
 * be a second thing to keep honest about a fact the first one already states.
 * The literals that must stay literal are in `ROUTE_PATHS` itself, which is
 * what keeps `RouteKey` a union; nothing here widens it.
 */
export const TOOL_ROUTE_KEYS: Record<ToolKey, RouteKey> = Object.fromEntries(
  TOOL_KEYS.map((key) => [key, TOOLS[key].routeKey]),
) as Record<ToolKey, RouteKey>;

/** Registry order — the seeded `sortOrder` and the section bar's order. */
export const TOOL_KEYS_IN_ORDER: readonly ToolKey[] = TOOL_KEYS;

/** `/tools/<key>` — the registry key IS the segment (ADR-086 #3). */
export function toolPath(key: ToolKey): string {
  return ROUTE_PATHS[TOOLS[key].routeKey];
}

// ─── Config schemas (ADR-086 #2) ─────────────────────────────
//
// One schema per tool, validated in three places against this one definition:
// the admin form (`useFieldErrors`), the server action, and the service. An
// invalid configuration therefore fails identically wherever it is entered —
// ADR-068's rule for videos, applied again.

/** An instrument id, stored in a tool's config as an opaque cuid. */
const instrumentIdSchema = z.string().min(1).max(40);

/** A percentage markup, 0–100, one decimal place of meaning (ADR-086, T7). */
const markupSchema = z.number().min(0).max(100);

export const CORRELATION_WINDOWS = ["5d", "10d", "30d", "60d", "90d", "180d", "250d"] as const;
export type CorrelationWindow = (typeof CORRELATION_WINDOWS)[number];
export const correlationWindowSchema = z.enum(CORRELATION_WINDOWS);

export const PIVOT_INTERVALS = ["1D", "1W", "1M", "1Y"] as const;
export type PivotInterval = (typeof PIVOT_INTERVALS)[number];
export const pivotIntervalSchema = z.enum(PIVOT_INTERVALS);

export const PIVOT_METHODS = ["floor", "woodie", "camarilla", "demark", "fibonacci"] as const;
export type PivotMethod = (typeof PIVOT_METHODS)[number];

/** Which way a basket member moves when risk is ON (ADR-088 #4). */
export const RISK_DIRECTIONS = ["risk-on", "risk-off"] as const;
export type RiskDirection = (typeof RISK_DIRECTIONS)[number];

export const riskComponentSchema = z.object({
  instrumentId: instrumentIdSchema,
  /** Relative weight. Normalised at read; never assumed to sum to anything. */
  weight: z.number().min(0).max(100),
  direction: z.enum(RISK_DIRECTIONS),
});

export const positionSizeConfigSchema = z.object({
  defaultAccountCurrency: z.string().min(2).max(10),
  defaultPairId: instrumentIdSchema.nullish(),
  defaultRiskPercent: z.number().min(0.01).max(100),
  minRiskPercent: z.number().min(0).max(100),
  maxRiskPercent: z.number().min(0).max(100),
  pairIds: z.array(instrumentIdSchema).max(200),
  accountCurrencyIds: z.array(instrumentIdSchema).max(200),
});

export const pipValueConfigSchema = z.object({
  defaultAccountCurrency: z.string().min(2).max(10),
  defaultPairId: instrumentIdSchema.nullish(),
  defaultUnits: z.number().int().min(1),
  pairIds: z.array(instrumentIdSchema).max(200),
  accountCurrencyIds: z.array(instrumentIdSchema).max(200),
});

export const gainLossConfigSchema = z.object({
  defaultStartBalance: z.number().min(0),
  decimals: z.number().int().min(0).max(8),
});

export const pivotPointsConfigSchema = z.object({
  /**
   * 1D/1W/1M/1Y only. 1Y folds daily bars exactly as 1W and 1M do
   * (ADR-087 #4), so it needs nothing intraday would need; the reference's
   * 1m…4h intervals are out of scope because the store is daily bars.
   */
  intervals: z.array(pivotIntervalSchema).min(1),
  defaultInterval: pivotIntervalSchema,
  symbolIds: z.array(instrumentIdSchema).max(200),
  defaultSymbolId: instrumentIdSchema.nullish(),
});

export const marketSessionSchema = z.object({
  /** Free-text; the admin owns the words (ADR-086 #1). */
  name: z.string().min(1).max(60),
  city: z.string().min(1).max(60),
  /** An IANA zone. DST is `Intl`'s job, never a stored UTC offset. */
  timeZone: z.string().min(1).max(60),
  /** "HH:MM" in the session's OWN zone. */
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const marketHoursConfigSchema = z.object({
  sessions: z.array(marketSessionSchema).min(1).max(12),
  /** Overlapping-session counts at which the volume band steps up. */
  mediumVolumeFrom: z.number().int().min(1).max(12),
  highVolumeFrom: z.number().int().min(1).max(12),
});

export const currencyConverterConfigSchema = z.object({
  currencyIds: z.array(instrumentIdSchema).max(200),
  defaultFrom: z.string().min(2).max(10),
  defaultTo: z.string().min(2).max(10),
  defaultAmount: z.number().min(0),
  decimals: z.number().int().min(0).max(8),
  /**
   * Typical markups over the mid-market rate, as percentages. Arithmetic on
   * the same snapshot — no second request, and the stored mid-market figure is
   * never touched. The copy calls them typical and names no provider.
   */
  rateMarkups: z.object({
    bank: markupSchema,
    atm: markupSchema,
    card: markupSchema,
    kiosk: markupSchema,
  }),
  /** Which of the four are offered at all. */
  offeredRateTypes: z.array(z.enum(["market", "bank", "atm", "card", "kiosk"])).min(1),
});

export const correlationConfigSchema = z.object({
  windows: z.array(correlationWindowSchema).min(1),
  defaultWindow: correlationWindowSchema,
  instrumentIds: z.array(instrumentIdSchema).max(60),
});

export const riskSentimentConfigSchema = z
  .object({
    components: z.array(riskComponentSchema).min(1).max(40),
    /** Trading days of history the percentile rank is taken over. */
    lookbackDays: z.number().int().min(10).max(500),
    /** ADR-088 #4 — seeded 35 and 65. */
    riskOffBelow: z.number().min(0).max(100),
    riskOnAbove: z.number().min(0).max(100),
  })
  .refine((c) => c.riskOffBelow < c.riskOnAbove, {
    message: "riskOffBelow must be below riskOnAbove",
    path: ["riskOffBelow"],
  })
  .refine((c) => c.components.reduce((sum, x) => sum + x.weight, 0) > 0, {
    // ADR-088 #6: refused at the contract, not at render. A division by zero
    // that reaches a component has already travelled too far.
    message: "Component weights must sum to more than zero",
    path: ["components"],
  });

export const TOOL_CONFIG_SCHEMAS = {
  "position-size": positionSizeConfigSchema,
  "pip-value": pipValueConfigSchema,
  "gain-loss": gainLossConfigSchema,
  "pivot-points": pivotPointsConfigSchema,
  "market-hours": marketHoursConfigSchema,
  "currency-converter": currencyConverterConfigSchema,
  correlation: correlationConfigSchema,
  "risk-sentiment": riskSentimentConfigSchema,
} as const satisfies Record<ToolKey, z.ZodType>;

export type ToolConfigSchemas = typeof TOOL_CONFIG_SCHEMAS;
export type ToolConfig<K extends ToolKey> = z.infer<ToolConfigSchemas[K]>;

/** The schema for one key — the single door all three validators go through. */
export function toolConfigSchema<K extends ToolKey>(key: K): ToolConfigSchemas[K] {
  return TOOL_CONFIG_SCHEMAS[key];
}

/**
 * Parse an unknown `config` column against its key's schema.
 *
 * Returns a discriminated result rather than throwing, because both callers
 * that matter — a public page rendering a widget and an admin form showing
 * errors — have something better to do than crash on a row an older deploy
 * wrote.
 */
export function parseToolConfig<K extends ToolKey>(
  key: K,
  value: unknown,
): { ok: true; config: ToolConfig<K> } | { ok: false; error: z.ZodError } {
  const result = TOOL_CONFIG_SCHEMAS[key].safeParse(value);
  return result.success
    ? { ok: true, config: result.data as ToolConfig<K> }
    : { ok: false, error: result.error };
}

// ─── Admin input (T5) ────────────────────────────────────────

export const toolKeySchema = z.enum(TOOL_KEYS);

export const toolFaqEntrySchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(4000),
});

export const toolTranslationSchema = z.object({
  locale: z.string().min(2).max(10),
  title: z.string().min(1).max(160),
  tagline: z.string().max(220).nullish(),
  intro: z.string().max(20_000).nullish(),
  body: z.string().max(200_000).nullish(),
  faq: z.array(toolFaqEntrySchema).max(30).nullish(),
  seoTitle: z.string().max(70).nullish(),
  seoDescription: z.string().max(180).nullish(),
  seoFocusKeyword: z.string().max(100).nullish(),
});

/** One related item, any content type (ADR-086 #4 — the strip is mixed). */
export const TOOL_RELATION_TYPES = ["lesson", "article", "glossary", "video", "course"] as const;
export type ToolRelationType = (typeof TOOL_RELATION_TYPES)[number];

export const toolRelatedItemSchema = z.object({
  targetType: z.enum(TOOL_RELATION_TYPES),
  targetId: z.string().min(1).max(40),
});

export const saveToolSchema = z.object({
  key: toolKeySchema,
  isEnabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  coverAssetId: z.string().max(40).nullish(),
  relatedCount: z.number().int().min(0).max(24),
  showRelated: z.boolean(),
  /** Validated against `TOOL_CONFIG_SCHEMAS[key]` by the service, which is
   * the only caller that knows the key at the type level. */
  config: z.unknown(),
  translation: toolTranslationSchema,
  related: z.array(toolRelatedItemSchema).max(24),
});

export type SaveToolInput = z.infer<typeof saveToolSchema>;
export type ToolTranslationInput = z.infer<typeof toolTranslationSchema>;
export type ToolFaqEntry = z.infer<typeof toolFaqEntrySchema>;
export type ToolRelatedItem = z.infer<typeof toolRelatedItemSchema>;
export type RiskComponent = z.infer<typeof riskComponentSchema>;
export type MarketSessionSpec = z.infer<typeof marketSessionSchema>;
