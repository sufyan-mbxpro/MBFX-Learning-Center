import { describe, expect, it } from "vitest";

import { formatBytes } from "./file-size.ts";

describe("formatBytes", () => {
  it("prints whole bytes without a decimal", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(999)).toBe("999 B");
  });

  it("steps to KB at 1024 and keeps kilobytes whole", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("2 KB");
    expect(formatBytes(1024 * 500)).toBe("500 KB");
  });

  it("keeps one decimal from MB up", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.5 MB");
    expect(formatBytes(1024 * 1024 * 1024 * 2.25)).toBe("2.3 GB");
  });

  it("steps up rather than printing 1024 of the smaller unit", () => {
    // 1023.99 KB. Rounding to one decimal inside KB would print "1024 KB",
    // which is the bug the re-check in formatBytes exists to prevent.
    expect(formatBytes(1024 * 1024 - 10)).toBe("1 MB");
  });

  it("caps at the largest known unit instead of running off the end", () => {
    expect(formatBytes(1024 ** 5)).toBe("1024 TB");
  });

  it("degrades rather than throwing on unusable input", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 B");
  });
});
