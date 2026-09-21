import { pipSize } from "@repo/utils";

// Starting prices for the calculators that take prices (changes-41, ADR-135).
//
// A form that opens empty shows "fill in the fields" and nothing else, which
// tells a first-time reader nothing about what the tool does. A form that opens
// on a price we do not have would be worse, because a made-up 1.1000 reads as
// a quote. So the defaults come from the stored price when there is one, sit a
// round number of pips either side of it, and are EMPTY when there is not.

/** Decimal places a price in this pair is quoted to: a pipette past the pip. */
export function priceDecimals(pair: string): number {
  return pipSize(pair) === 0.01 ? 3 : 5;
}

/** `price` moved `pips` pips (negative for down), as the string an input holds. */
export function priceAt(pair: string, price: number | null, pips = 0): string {
  if (price === null || !Number.isFinite(price) || price <= 0) return "";
  const moved = price + pips * pipSize(pair);
  return moved > 0 ? moved.toFixed(priceDecimals(pair)) : "";
}

/** A number from an input, or null when it is empty or not a positive number. */
export function positive(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
