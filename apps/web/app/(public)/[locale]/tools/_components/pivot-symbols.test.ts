import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pivotSymbols } from "./pivot-symbols.ts";

const INSTRUMENTS = [
  { id: "usd", symbol: "USD", displayName: "US dollar", kind: "CURRENCY" },
  { id: "eurusd", symbol: "EUR/USD", displayName: "Euro / US dollar", kind: "PAIR" },
  { id: "gbpusd", symbol: "GBP/USD", displayName: "Pound / US dollar", kind: "PAIR" },
  { id: "xau", symbol: "XAU/USD", displayName: "Gold", kind: "METAL" },
];

describe("pivotSymbols (changes-46: the dropdown rendered nothing)", () => {
  it("resolves the config's symbolIds — the key the registry actually writes", () => {
    const { options, defaultSymbol } = pivotSymbols(
      { symbolIds: ["gbpusd", "eurusd"], defaultSymbolId: "eurusd" },
      INSTRUMENTS,
    );
    expect(options.map((o) => o.symbol)).toEqual(["GBP/USD", "EUR/USD"]);
    expect(options[0]?.label).toBe("GBP/USD — Pound / US dollar");
    expect(defaultSymbol).toBe("EUR/USD");
  });

  it("does not repeat a display name that is the symbol itself", () => {
    const { options } = pivotSymbols({ symbolIds: ["x"] }, [
      { id: "x", symbol: "EUR/USD", displayName: "EUR/USD", kind: "PAIR" },
    ]);
    expect(options[0]?.label).toBe("EUR/USD");
  });

  it("drops an id whose instrument is inactive or deleted", () => {
    const { options } = pivotSymbols({ symbolIds: ["gone", "xau"] }, INSTRUMENTS);
    expect(options.map((o) => o.symbol)).toEqual(["XAU/USD"]);
  });

  it("offers every tradable instrument when nothing is chosen, never an empty control", () => {
    const { options, defaultSymbol } = pivotSymbols({ symbolIds: [] }, INSTRUMENTS);
    expect(options.map((o) => o.symbol)).toEqual(["EUR/USD", "GBP/USD", "XAU/USD"]);
    expect(defaultSymbol).toBe("EUR/USD");
  });

  it("ignores a default that is not on offer", () => {
    const { defaultSymbol } = pivotSymbols(
      { symbolIds: ["gbpusd"], defaultSymbolId: "eurusd" },
      INSTRUMENTS,
    );
    expect(defaultSymbol).toBe("GBP/USD");
  });

  it("the widget no longer reads the `symbols` key nothing writes", () => {
    const widget = readFileSync(join(__dirname, "../_widgets/pivot-points.tsx"), "utf8");
    expect(widget).not.toMatch(/config\.symbols\b/);
    const switcher = readFileSync(join(__dirname, "tool-widget.tsx"), "utf8");
    expect(switcher).toContain("pivotSymbols(");
  });
});
