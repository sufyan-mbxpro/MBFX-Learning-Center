import { describe, expect, it } from "vitest";

import { extractNumbers, normaliseDigits, numbersMatch } from "./numbers.ts";

describe("numbersMatch (ADR-160 #8)", () => {
  it("passes the same figures in a different order", () => {
    expect(numbersMatch("Leverage 1:100 from $10", "من 10$ برافعة 1:100")).toBe(true);
  });

  it("flags a changed figure — the failure that matters on a forex site", () => {
    expect(numbersMatch("Minimum deposit $10", "الحد الأدنى للإيداع 100$")).toBe(false);
    expect(numbersMatch("Pass mark 70%", "Nota mínima 7%")).toBe(false);
  });

  it("flags a dropped figure", () => {
    expect(numbersMatch("Open 24 hours, 5 days", "Abierto todos los días")).toBe(false);
  });

  it("reads Arabic-Indic and Urdu digits as the same numbers", () => {
    expect(normaliseDigits("١٠ ۱۰٫٥")).toBe("10 10.5");
    expect(numbersMatch("Deposit 10, leverage 1:100", "إيداع ١٠ ورافعة ١:١٠٠")).toBe(true);
  });

  it("ignores thousands separators but not decimals", () => {
    expect(numbersMatch("1,000 units", "1000 unidades")).toBe(true);
    expect(numbersMatch("1 000 units", "1.000 unités")).toBe(true);
    expect(numbersMatch("1.5 lots", "1,5 lotes")).toBe(true);
    expect(numbersMatch("1.5 lots", "15 lotes")).toBe(false);
  });

  it("ignores markup and entities", () => {
    expect(extractNumbers(`<h2 data-x="42">Step 1</h2>&#39;`)).toEqual(["1"]);
  });

  it("matches text with no numbers at all", () => {
    expect(numbersMatch("Hello", "Hola")).toBe(true);
  });
});
