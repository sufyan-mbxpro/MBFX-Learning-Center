// Market platform contracts (Module 13, ADR-087).
//
// Two rules in this file are load-bearing and are why it exists rather than
// the schemas living beside their service:
//
//   1. **A PAIR requires a base and a quote.** Without both, `getRateSnapshot`
//      cannot place the row against USD and the pip calculators cannot size a
//      position — so a PAIR with a missing leg is a row that silently
//      contributes nothing rather than an error anyone sees.
//   2. **A blank API key means UNCHANGED.** The field is write-only and renders
//      empty over a stored key, so treating empty as a deletion would wipe the
//      key on every unrelated save of the same form.
//
// Both are enforced here so the admin form, the server action and the service
// fail identically (security.md #6's "parse, don't spread").
import { z } from "zod";

export const MARKET_INSTRUMENT_KINDS = [
  "CURRENCY",
  "PAIR",
  "CRYPTO",
  "METAL",
  "INDEX",
  "COMMODITY",
] as const;
export type MarketInstrumentKindValue = (typeof MARKET_INSTRUMENT_KINDS)[number];

export const MARKET_DRIVERS = ["ALPHAVANTAGE", "MANUAL"] as const;
export type MarketDriverValue = (typeof MARKET_DRIVERS)[number];

/** A currency code or a slashed pair — no spaces, no lower case. */
const symbolSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9]{1,10}(\/[A-Z0-9]{1,10})?$/, "Use a code like EUR, or a pair like EUR/USD");

const currencyCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[A-Z0-9]+$/, "Use an upper-case code");

export const marketInstrumentSchema = z
  .object({
    id: z.string().max(40).nullish(),
    kind: z.enum(MARKET_INSTRUMENT_KINDS),
    symbol: symbolSchema,
    displayName: z.string().min(1).max(80),
    base: currencyCodeSchema.nullish(),
    quote: currencyCodeSchema.nullish(),
    providerSymbol: z.string().max(40).nullish(),
    /** Null means derive from the quote currency (0.01 for JPY, else 0.0001). */
    pipSize: z.number().positive().max(1).nullish(),
    decimals: z.number().int().min(0).max(10),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
  })
  .refine((v) => v.kind !== "PAIR" || (Boolean(v.base) && Boolean(v.quote)), {
    message: "A pair needs both a base and a quote currency",
    path: ["base"],
  });

export type MarketInstrumentSaveInput = z.infer<typeof marketInstrumentSchema>;

export const marketProviderSchema = z.object({
  driver: z.enum(MARKET_DRIVERS),
  baseUrl: z.url().max(255).nullish().or(z.literal("")),
  /**
   * Write-only (ADR-087 #5). **Blank means unchanged, never erase** — the
   * field renders empty over a stored key, so an admin who edits the refresh
   * interval must not lose the credential by leaving it alone.
   */
  apiKey: z.string().max(200).optional(),
  refreshSeconds: z.number().int().min(30).max(86_400),
  staleSeconds: z.number().int().min(60).max(30 * 86_400),
  isEnabled: z.boolean(),
});

export type MarketProviderSaveInput = z.infer<typeof marketProviderSchema>;

export const marketInstrumentFilterSchema = z.object({
  kind: z.enum(MARKET_INSTRUMENT_KINDS).nullish(),
  isActive: z.boolean().nullish(),
  search: z.string().max(100).nullish(),
});

export type MarketInstrumentFilter = z.infer<typeof marketInstrumentFilterSchema>;

export const marketReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1).max(40)).max(500),
});
