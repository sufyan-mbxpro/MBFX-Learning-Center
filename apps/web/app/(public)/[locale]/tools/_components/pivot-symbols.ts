// Which instruments the pivot calculator offers, and which it opens on.
//
// changes-46: the symbol dropdown did not render on /tools/pivot-points. The
// registry's config names its list `symbolIds` (instrument IDS, like every
// other tool's list — `pivotPointsConfigSchema` in @repo/contracts), but the
// widget read `config.symbols`, a shape nothing has ever written. That was
// `undefined`, so the dropdown got zero options and drew nothing. The ids are
// now resolved to symbols HERE, once, and the page and the widget both use the
// result, so the autofill the page reads and the list the reader picks from
// cannot disagree about which instruments exist.

export interface PivotInstrument {
  id: string;
  symbol: string;
  displayName: string;
  kind: string;
}

export interface PivotSymbolOption {
  symbol: string;
  label: string;
}

/**
 * A bound on how many instruments the page reads a period for. Every one is a
 * cached read per interval; a config can name up to 200, and four intervals
 * over 200 instruments is 800 reads on a cold cache for one page. An
 * instrument past the bound is still OFFERED — it simply opens in manual mode.
 */
export const PIVOT_AUTOFILL_LIMIT = 40;

export function pivotSymbols(
  config: Record<string, unknown>,
  instruments: readonly PivotInstrument[],
): { options: PivotSymbolOption[]; defaultSymbol: string | null } {
  const byId = new Map(instruments.map((i) => [i.id, i]));
  const ids = Array.isArray(config.symbolIds) ? (config.symbolIds as unknown[]) : [];

  // An id whose instrument is gone or inactive drops out rather than
  // rendering a blank row (`instruments` is the ACTIVE list).
  let offered = ids
    .map((id) => byId.get(String(id)))
    .filter((i): i is PivotInstrument => i !== undefined);

  // Nothing chosen (or everything chosen was retired): every active tradable
  // instrument rather than an empty control. A bare currency is not a market
  // with a high and a low, so it is not offered.
  if (offered.length === 0) offered = instruments.filter((i) => i.kind !== "CURRENCY");

  const options = offered.map((i) => ({
    symbol: i.symbol,
    // A pair's display name is often the symbol itself ("EUR/USD — EUR/USD").
    label:
      i.displayName && i.displayName !== i.symbol ? `${i.symbol} — ${i.displayName}` : i.symbol,
  }));

  const preferred = byId.get(String(config.defaultSymbolId ?? ""))?.symbol;
  const defaultSymbol =
    (preferred && options.some((o) => o.symbol === preferred) ? preferred : null) ??
    options[0]?.symbol ??
    null;

  return { options, defaultSymbol };
}
