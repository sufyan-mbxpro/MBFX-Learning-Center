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

// ─── Gain & loss (changes-25 T2) ─────────────────────────────

export type GainLossDirection = "gain" | "loss";

/**
 * Which of the three the caller supplied. The reference's widget is "tell us
 * one of these and we'll tell you the other two", so the input is a tagged
 * union rather than three optional numbers — three optionals make "all of
 * them" and "none of them" representable, and both are states nobody would
 * have written a branch for.
 */
export type GainLossKnown =
  | { kind: "amount"; value: number }
  | { kind: "percent"; value: number }
  | { kind: "endingBalance"; value: number };

export interface GainLossInput {
  startBalance: number;
  direction: GainLossDirection;
  known: GainLossKnown;
}

export interface GainLossResult {
  /** The move, always POSITIVE; `direction` carries the sign. */
  amount: number;
  /** The move as a percentage of the starting balance, always positive. */
  percent: number;
  endingBalance: number;
  /**
   * The gain needed to get back to the starting balance, as a percentage of
   * the ENDING balance. Zero for a gain — you are already there. This is the
   * asymmetry the tool exists to show: a 50% loss needs a 100% gain back.
   */
  breakevenPercent: number;
}

/** Solve a gain or loss from whichever one of the three figures is known. */
export function gainLoss({ startBalance, direction, known }: GainLossInput): GainLossResult {
  if (startBalance <= 0) throw new RangeError("startBalance must be positive");
  const sign = direction === "gain" ? 1 : -1;

  let amount: number;
  switch (known.kind) {
    case "amount":
      if (known.value < 0) throw new RangeError("amount must not be negative");
      amount = known.value;
      break;
    case "percent":
      if (known.value < 0) throw new RangeError("percent must not be negative");
      amount = (startBalance * known.value) / 100;
      break;
    case "endingBalance": {
      if (known.value < 0) throw new RangeError("endingBalance must not be negative");
      // The direction the caller declared wins over the one the numbers
      // imply: the form has a gain/loss toggle, and someone who types an
      // ending balance BELOW their start while the toggle says "gain" has
      // made a typo, not asked for a negative gain.
      amount = Math.abs(known.value - startBalance);
      break;
    }
  }

  const endingBalance = startBalance + sign * amount;
  const percent = (amount / startBalance) * 100;
  const breakevenPercent =
    sign > 0 || endingBalance <= 0 ? 0 : ((startBalance - endingBalance) / endingBalance) * 100;

  return { amount, percent, endingBalance, breakevenPercent };
}

// ─── Pivot points (changes-25 T2) ────────────────────────────
//
// The five formula sets are transcribed from the reference's own "About Pivot
// Points" section. Each returns R4…S4 with absent levels `null` rather than
// omitted, so one table can render a row per level without branching on which
// method it is looking at — and a null renders as a dash, where a zero would
// render as a price of zero.

export type PivotMethodName = "floor" | "woodie" | "camarilla" | "demark" | "fibonacci";

export interface PivotInput {
  open: number;
  high: number;
  low: number;
  close: number;
  method: PivotMethodName;
}

export interface PivotLevels {
  pp: number;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number | null;
}

/** Pivot levels for one period of OHLC, by method. */
export function pivotPoints({ open, high, low, close, method }: PivotInput): PivotLevels {
  if (!(high >= low)) throw new RangeError("high must be at or above low");
  if (high <= 0 || low <= 0 || close <= 0 || open <= 0)
    throw new RangeError("prices must be positive");
  const range = high - low;
  const noFourth = { r4: null, s4: null } as const;

  switch (method) {
    case "floor": {
      const pp = (high + low + close) / 3;
      return {
        pp,
        r1: 2 * pp - low,
        s1: 2 * pp - high,
        r2: pp + range,
        s2: pp - range,
        r3: high + 2 * (pp - low),
        s3: low - 2 * (high - pp),
        ...noFourth,
      };
    }
    case "woodie": {
      // Woodie weights the opening price double, which is the whole
      // difference from Floor: the levels are built the same way off a pivot
      // that leans toward where the period started.
      const pp = (high + low + 2 * open) / 4;
      return {
        pp,
        r1: 2 * pp - low,
        s1: 2 * pp - high,
        r2: pp + range,
        s2: pp - range,
        r3: high + 2 * (pp - low),
        s3: low - 2 * (high - pp),
        ...noFourth,
      };
    }
    case "camarilla": {
      // The one method with four levels a side, and the one whose levels are
      // close-relative rather than pivot-relative.
      const pp = (high + low + close) / 3;
      return {
        pp,
        r1: close + (range * 1.1) / 12,
        r2: close + (range * 1.1) / 6,
        r3: close + (range * 1.1) / 4,
        r4: close + (range * 1.1) / 2,
        s1: close - (range * 1.1) / 12,
        s2: close - (range * 1.1) / 6,
        s3: close - (range * 1.1) / 4,
        s4: close - (range * 1.1) / 2,
      };
    }
    case "demark": {
      // X depends on where the close sits against the open, and DeMark yields
      // ONE level a side. The rest are null, not zero.
      const x =
        close < open
          ? high + 2 * low + close
          : close > open
            ? 2 * high + low + close
            : high + low + 2 * close;
      const pp = x / 4;
      return {
        pp,
        r1: x / 2 - low,
        s1: x / 2 - high,
        r2: null,
        r3: null,
        s2: null,
        s3: null,
        ...noFourth,
      };
    }
    case "fibonacci": {
      const pp = (high + low + close) / 3;
      return {
        pp,
        r1: pp + 0.382 * range,
        r2: pp + 0.618 * range,
        r3: pp + range,
        s1: pp - 0.382 * range,
        s2: pp - 0.618 * range,
        s3: pp - range,
        ...noFourth,
      };
    }
  }
}

// ─── Rates: cross-rates and the account-currency leg ─────────

/** Currency code → units of that currency per 1 USD (ADR-087 #7's snapshot). */
export type UsdRates = Readonly<Record<string, number>>;

/**
 * Units of `to` per 1 unit of `from`, assembled through USD.
 *
 * Returns `null` rather than throwing when either leg is missing: a converter
 * whose provider is down has to render a labelled empty state, not a stack
 * trace, and a `NaN` reaching a `toFixed` is exactly the bug this return type
 * prevents.
 */
export function crossRate(from: string, to: string, usdRates: UsdRates): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;
  const perUsdFrom = f === "USD" ? 1 : usdRates[f];
  const perUsdTo = t === "USD" ? 1 : usdRates[t];
  if (
    perUsdFrom === undefined ||
    perUsdTo === undefined ||
    !Number.isFinite(perUsdFrom) ||
    !Number.isFinite(perUsdTo) ||
    perUsdFrom <= 0 ||
    perUsdTo <= 0
  ) {
    return null;
  }
  return perUsdTo / perUsdFrom;
}

/** `amount` of `from` in `to`, or `null` when the rate cannot be assembled. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  usdRates: UsdRates,
): number | null {
  const rate = crossRate(from, to, usdRates);
  return rate === null ? null : amount * rate;
}

export interface AccountPipValueInput {
  pair: string;
  /** Position size in UNITS, not lots — what the reference form asks for. */
  units: number;
  /** Current price of the pair (quote per base). */
  price: number;
  accountCurrency: string;
  rates: UsdRates;
}

/**
 * One pip of the position, valued in the ACCOUNT currency — the leg
 * `pipValue` deliberately left to its caller, now that there is a caller able
 * to supply rates.
 *
 * The account leg is `null` when it cannot be assembled, for `crossRate`'s
 * reason; the quote-currency figure is always available, because it needs no
 * rate at all.
 */
export function accountPipValue({
  pair,
  units,
  price,
  accountCurrency,
  rates,
}: AccountPipValueInput): { quoteCurrency: number; accountCurrency: number | null } {
  if (units <= 0) throw new RangeError("units must be positive");
  if (price <= 0) throw new RangeError("price must be positive");
  const quote = pair.split("/")[1]?.toUpperCase() ?? "";
  const inQuote = pipSize(pair) * units;
  const leg = crossRate(quote, accountCurrency, rates);
  return { quoteCurrency: inQuote, accountCurrency: leg === null ? null : inQuote * leg };
}

export interface MarkupQuoteInput {
  amount: number;
  /** The mid-market rate: units of `to` per 1 unit of `from`. */
  midRate: number;
  /** The markup as a percentage, 0 for a mid-market quote. */
  markupPercent: number;
}

export interface MarkupQuote {
  /** The rate actually applied, after the markup. */
  effectiveRate: number;
  /** What the reader would receive at that rate. */
  converted: number;
  /** What they would have received at the mid-market rate. */
  atMid: number;
  /** The difference — what the markup costs, in the TO currency. */
  cost: number;
}

/**
 * What a marked-up rate really gives you (changes-25 T7).
 *
 * The markup makes the rate you GET worse, so it comes OFF the mid rate. A
 * naive `mid * (1 + markup)` reads as "the bank gives you more", which is the
 * wrong sign and would present a cost as a bonus.
 *
 * **The mid-market figure is returned alongside, never replaced.** The whole
 * point of the control is the comparison, and a tool that silently swapped one
 * number for the other would hide exactly what it exists to show.
 *
 * Lives here rather than in the island so that the one piece of money
 * arithmetic on the public side sits under the 90% pure-logic floor.
 */
export function quoteWithMarkup({ amount, midRate, markupPercent }: MarkupQuoteInput): MarkupQuote {
  if (amount < 0) throw new RangeError("amount must not be negative");
  if (midRate <= 0) throw new RangeError("midRate must be positive");
  if (markupPercent < 0 || markupPercent >= 100) {
    throw new RangeError("markupPercent must be in [0, 100)");
  }

  const effectiveRate = midRate * (1 - markupPercent / 100);
  const atMid = amount * midRate;
  const converted = amount * effectiveRate;
  return { effectiveRate, converted, atMid, cost: atMid - converted };
}

// ─── Margin, profit/loss and risk/reward (changes-41, ADR-135) ──────
//
// The three calculators the owner's reference site carries and ours did not.
// Same conventions as the rest of this file: pure, no rate fetching, and the
// account-currency leg is `null` when it cannot be assembled — never a zero,
// which would read as "free" on a margin figure and "break-even" on a P/L.

function baseOf(pair: string): string {
  return pair.split("/")[0]?.toUpperCase() ?? "";
}

function quoteOf(pair: string): string {
  return pair.split("/")[1]?.toUpperCase() ?? "";
}

/**
 * A price distance in pips, with binary floating-point noise removed.
 *
 * `(1.1 - 1.097) / 0.0001` is 29.999999999999805, not 30, and a ratio built
 * from two such distances comes out at 1.9999… — which printed "1 : 2.00"
 * beside a note saying the reward was below 2. Prices are quoted to at most
 * six decimals, so nothing real is lost at a millionth of a pip.
 */
function pipsBetween(a: number, b: number, pair: string): number {
  return Math.round(((a - b) / pipSize(pair)) * 1e6) / 1e6;
}

export interface AccountMarginInput {
  pair: string;
  /** Position size in UNITS (1 standard lot = 100,000). */
  units: number;
  /** Leverage as N in 1:N. */
  leverage: number;
  accountCurrency: string;
  rates: UsdRates;
  /** The account balance, when free margin and margin level are wanted. */
  balance?: number | null;
}

export interface AccountMarginResult {
  /** Required margin in the pair's BASE currency — needs no rate at all. */
  inBase: number;
  baseCurrency: string;
  /** Required margin in the account currency, or null without a rate. */
  inAccount: number | null;
  /** Balance minus required margin; null without a balance or a rate. */
  freeMargin: number | null;
  /**
   * Equity ÷ used margin × 100. With no position open yet, equity IS the
   * balance — the explainer says so rather than implying a P/L we do not have.
   */
  marginLevel: number | null;
}

/**
 * What it takes to open a position, in the account's own currency.
 *
 * A position's notional is `units` of the BASE currency, so the deposit is
 * `units / leverage` of the base. That is why a USD account opening USD/JPY
 * needs no exchange rate at all, and one opening EUR/USD needs exactly one.
 */
export function accountMargin({
  pair,
  units,
  leverage,
  accountCurrency,
  rates,
  balance,
}: AccountMarginInput): AccountMarginResult {
  if (units <= 0) throw new RangeError("units must be positive");
  if (leverage <= 0) throw new RangeError("leverage must be positive");
  if (balance !== undefined && balance !== null && balance < 0) {
    throw new RangeError("balance must not be negative");
  }

  const baseCurrency = baseOf(pair);
  const inBase = units / leverage;
  const inAccount = convertAmount(inBase, baseCurrency, accountCurrency, rates);
  const hasBalance = balance !== undefined && balance !== null;

  return {
    inBase,
    baseCurrency,
    inAccount,
    freeMargin: hasBalance && inAccount !== null ? balance - inAccount : null,
    marginLevel:
      hasBalance && inAccount !== null && inAccount > 0 ? (balance / inAccount) * 100 : null,
  };
}

export type TradeDirection = "buy" | "sell";

export interface TradeProfitInput {
  pair: string;
  direction: TradeDirection;
  /** Position size in UNITS. */
  units: number;
  open: number;
  close: number;
  accountCurrency: string;
  rates: UsdRates;
}

export interface TradeProfitResult {
  /** Signed: positive is a profit for the declared direction. */
  pips: number;
  /** Signed P/L in the pair's QUOTE currency — needs no rate. */
  inQuote: number;
  quoteCurrency: string;
  /** Signed P/L in the account currency, or null without a rate. */
  inAccount: number | null;
}

/**
 * One trade's profit or loss from its open and close prices.
 *
 * The sign follows the DIRECTION: a sell that closes lower is a profit. The
 * quote-currency figure is converted at the stored rate, which is the honest
 * reading for a trade being planned rather than one being reconciled.
 */
export function tradeProfit({
  pair,
  direction,
  units,
  open,
  close,
  accountCurrency,
  rates,
}: TradeProfitInput): TradeProfitResult {
  if (units <= 0) throw new RangeError("units must be positive");
  if (open <= 0) throw new RangeError("open must be positive");
  if (close <= 0) throw new RangeError("close must be positive");

  const sign = direction === "buy" ? 1 : -1;
  const move = (close - open) * sign;
  const quoteCurrency = quoteOf(pair);
  const inQuote = move * units;

  return {
    pips: pipsBetween(close, open, pair) * sign,
    inQuote,
    quoteCurrency,
    inAccount: convertAmount(inQuote, quoteCurrency, accountCurrency, rates),
  };
}

export type RiskLevel = "conservative" | "moderate" | "aggressive";

export interface RiskLevelThresholds {
  /** At or below this percentage, a trade is conservative. */
  conservativeMax: number;
  /** At or below this (and above the first), moderate; above it, aggressive. */
  moderateMax: number;
}

/** Name a risk percentage. The thresholds are CONFIG — an admin's call. */
export function riskLevel(riskPercent: number, thresholds: RiskLevelThresholds): RiskLevel {
  if (riskPercent <= thresholds.conservativeMax) return "conservative";
  if (riskPercent <= thresholds.moderateMax) return "moderate";
  return "aggressive";
}

export interface RiskRewardInput {
  balance: number;
  /** Risk per trade as a PERCENTAGE, 0 < x < 100. */
  riskPercent: number;
  pair: string;
  entry: number;
  stop: number;
  /** Take-profit price; null when the reader has not set one. */
  target: number | null;
  accountCurrency: string;
  rates: UsdRates;
}

export interface RiskRewardResult {
  /** Inferred from the stop: below the entry is a long, above it a short. */
  side: "long" | "short";
  amountAtRisk: number;
  stopPips: number;
  /** Null without a target, or with one on the losing side of the entry. */
  targetPips: number | null;
  /** Reward ÷ risk, e.g. 2 for "1 : 2". Null wherever `targetPips` is. */
  ratio: number | null;
  /** What the target pays at this size. Needs no rate: it is `ratio × risk`. */
  reward: number | null;
  /** True when a target was given on the wrong side of the entry. */
  targetOnWrongSide: boolean;
  /** Size in units, or null when the pip value needs a rate we lack. */
  units: number | null;
  /** One pip per standard lot in the account currency, or null. */
  pipValuePerLot: number | null;
}

/**
 * Risk, reward and size from three prices.
 *
 * The position-size tool asks for a stop in PIPS; this one asks for PRICES,
 * which is how a chart presents a trade, and works the distances out itself.
 * A take profit on the wrong side of the entry is a state the form can reach,
 * so it is reported rather than thrown, and never rendered as a negative ratio.
 */
export function riskReward({
  balance,
  riskPercent,
  pair,
  entry,
  stop,
  target,
  accountCurrency,
  rates,
}: RiskRewardInput): RiskRewardResult {
  if (balance <= 0) throw new RangeError("balance must be positive");
  if (riskPercent <= 0 || riskPercent >= 100) {
    throw new RangeError("riskPercent must be in (0, 100)");
  }
  if (entry <= 0) throw new RangeError("entry must be positive");
  if (stop <= 0) throw new RangeError("stop must be positive");
  if (stop === entry) throw new RangeError("stop must differ from entry");
  if (target !== null && target <= 0) throw new RangeError("target must be positive");

  const side = stop < entry ? "long" : "short";
  const pip = pipSize(pair);
  const amountAtRisk = (balance * riskPercent) / 100;
  const stopPips = Math.abs(pipsBetween(entry, stop, pair));

  const targetOnWrongSide =
    target !== null && (side === "long" ? target <= entry : target >= entry);
  const targetPips =
    target === null || targetOnWrongSide ? null : Math.abs(pipsBetween(target, entry, pair));
  const ratio = targetPips === null ? null : targetPips / stopPips;

  const leg = crossRate(quoteOf(pair), accountCurrency, rates);
  const pipValuePerLot = leg === null ? null : pip * 100_000 * leg;
  const units =
    pipValuePerLot === null ? null : (amountAtRisk / (stopPips * pipValuePerLot)) * 100_000;

  return {
    side,
    amountAtRisk,
    stopPips,
    targetPips,
    ratio,
    reward: ratio === null ? null : amountAtRisk * ratio,
    targetOnWrongSide,
    units,
    pipValuePerLot,
  };
}
