// Trading calculators (Module 13) — pure functions, no I/O, 90% floor.
// Conventions:
//  - a "pip" is 0.0001 for most pairs and 0.01 for JPY-quoted pairs;
//  - lot size 1.0 = 100,000 units (standard), 0.1 = mini, 0.01 = micro;
//  - all monetary results are in the QUOTE currency unless converted by
//    the caller with a real rate — these functions never fetch rates.

/** Pip size for a pair symbol like "EUR/USD" or "USD/JPY". */
export function pipSize(pair: string): number {
  const quote = pair.split("/")[1]?.toUpperCase() ?? "";
  return quote === "JPY" ? 0.01 : 0.0001;
}

export interface PipValueInput {
  pair: string;
  /** Lots, where 1.0 = 100,000 units. */
  lots: number;
  /** Current price of the pair (quote per base). */
  price: number;
}

/**
 * Value of ONE pip for the position, in the QUOTE currency per pip, and
 * in the BASE currency (converted at the given price).
 */
export function pipValue({ pair, lots, price }: PipValueInput): {
  quoteCurrency: number;
  baseCurrency: number;
} {
  if (lots <= 0) throw new RangeError("lots must be positive");
  if (price <= 0) throw new RangeError("price must be positive");
  const units = lots * 100_000;
  const quote = pipSize(pair) * units;
  return { quoteCurrency: quote, baseCurrency: quote / price };
}

export interface PositionSizeInput {
  /** Account balance in account currency. */
  balance: number;
  /** Risk per trade as a fraction (0.01 = 1%). */
  riskFraction: number;
  /** Stop-loss distance in pips. */
  stopLossPips: number;
  /** Value of one pip PER LOT in account currency (from pipValue + any conversion). */
  pipValuePerLot: number;
}

/** Lots such that hitting the stop loses exactly balance × riskFraction. */
export function positionSize({
  balance,
  riskFraction,
  stopLossPips,
  pipValuePerLot,
}: PositionSizeInput): number {
  if (balance <= 0) throw new RangeError("balance must be positive");
  if (riskFraction <= 0 || riskFraction >= 1)
    throw new RangeError("riskFraction must be in (0, 1)");
  if (stopLossPips <= 0) throw new RangeError("stopLossPips must be positive");
  if (pipValuePerLot <= 0) throw new RangeError("pipValuePerLot must be positive");
  return (balance * riskFraction) / (stopLossPips * pipValuePerLot);
}

export interface MarginInput {
  /** Lots, where 1.0 = 100,000 units. */
  lots: number;
  /** Current price (quote per base). */
  price: number;
  /** Leverage as N in N:1 (e.g. 30 for 30:1). */
  leverage: number;
}

/** Required margin in the QUOTE currency. */
export function marginRequired({ lots, price, leverage }: MarginInput): number {
  if (lots <= 0) throw new RangeError("lots must be positive");
  if (price <= 0) throw new RangeError("price must be positive");
  if (leverage <= 0) throw new RangeError("leverage must be positive");
  return (lots * 100_000 * price) / leverage;
}
