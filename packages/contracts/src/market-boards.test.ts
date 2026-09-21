import { describe, expect, it } from "vitest";

import {
  MARKET_BOARD_GROUPS,
  MARKET_BOARD_GROUP_KEYS,
  MARKET_BOARD_SYMBOLS,
} from "./market-boards.ts";

describe("MARKET_BOARD_GROUPS (ADR-136 §4)", () => {
  it("declares exactly the four groups the reference opens on, in its order", () => {
    expect(Object.keys(MARKET_BOARD_GROUPS)).toEqual([...MARKET_BOARD_GROUP_KEYS]);
    expect(MARKET_BOARD_GROUP_KEYS).toEqual(["major", "minor", "exotic", "commodities"]);
  });

  it("gives every group at least one instrument", () => {
    for (const key of MARKET_BOARD_GROUP_KEYS) {
      expect(MARKET_BOARD_GROUPS[key].length, key).toBeGreaterThan(0);
    }
  });

  it("names no instrument twice, in any group", () => {
    expect(new Set(MARKET_BOARD_SYMBOLS).size).toBe(MARKET_BOARD_SYMBOLS.length);
  });

  it("spells our symbols as BASE/QUOTE, the MarketInstrument.symbol shape", () => {
    for (const symbol of MARKET_BOARD_SYMBOLS) expect(symbol).toMatch(/^[A-Z]{3}\/[A-Z]{3}$/);
  });

  it("spells every vendor ticker as EXCHANGE:TICKER with nothing a URL could smuggle", () => {
    for (const key of MARKET_BOARD_GROUP_KEYS) {
      for (const instrument of MARKET_BOARD_GROUPS[key]) {
        expect(instrument.tradingView).toMatch(/^[A-Z]+:[A-Z0-9]+$/);
      }
    }
  });
});
