import { expect, test, type Page } from "@playwright/test";

// changes-25 T10 — the client-JS budget on the tools routes (ADR-086 risk #4).
//
// **What this is, and what it is not.** The plan asked for a Lighthouse
// budget. This repo has never had a Lighthouse harness — every module so far
// has recorded "Lighthouse budgets owed to Module 14" — and standing one up is
// its own piece of infrastructure. What that does NOT excuse is the substance:
// ADR-086's risk #4 is specifically that eight interactive islands are "the
// first real client-JS weight on a public route since the quiz runner", and
// that is a number Playwright can weigh directly. LCP, CLS and the rest are
// still owed to Module 14, and the DEVLOG says so.
//
// **The structural half of the rule is NOT here.** An assertion that
// `/tools/gain-loss` pulls in no other island was written first and deleted:
// Turbopack's dev chunk names are hashed and carry no source filename, so the
// assertion passed even when `tool-widget.tsx` was turned into a client
// component by hand. A green check that cannot fail is worse than no check.
// `tools-area.test.ts` guards the same fact where it can actually be seen —
// that file must not start with `"use client"` — and that guard was verified
// by breaking it.

/** Bytes of JavaScript a first, uncached visit transfers. */
async function scriptBytes(page: Page, path: string): Promise<number> {
  let total = 0;
  const seen = new Set<string>();

  page.on("response", (response) => {
    const url = response.url();
    if (seen.has(url) || !new URL(url).pathname.endsWith(".js")) return;
    seen.add(url);
    const length = Number(response.headers()["content-length"] ?? 0);
    if (Number.isFinite(length)) total += length;
  });

  await page.goto(path, { waitUntil: "networkidle" });
  return total;
}

// Generous, and deliberately so: a budget that fails on a routine dependency
// bump teaches people to raise it. What it catches is the thing worth
// catching — a charting library, a date library, or all eight islands landing
// on one page.
//
// RELATIVE to the homepage rather than absolute, because `next dev` ships
// unminified development bundles and an absolute kB figure here would mean
// nothing about production. The homepage carries the same header, footer and
// theme runtime, so the ratio isolates what the tool page itself adds.
const MAX_RATIO_OVER_HOME = 2.5;

test.describe("client-JS budget on /tools (ADR-086 risk #4)", () => {
  test("a tool page does not weigh dramatically more than the homepage", async ({ page }) => {
    const home = await scriptBytes(page, "/");
    expect(home, "homepage shipped no JavaScript — the measurement is broken").toBeGreaterThan(0);

    for (const path of ["/tools", "/tools/gain-loss", "/tools/risk-sentiment"]) {
      const fresh = await page.context().newPage();
      const bytes = await scriptBytes(fresh, path);
      const ratio = bytes / home;
      expect(
        ratio,
        `${path} shipped ${Math.round(bytes / 1024)}kB of JS vs the homepage's ` +
          `${Math.round(home / 1024)}kB (${ratio.toFixed(2)}×). ADR-086 risk #4: one island ` +
          `per page, never eight, and no charting library.`,
      ).toBeLessThan(MAX_RATIO_OVER_HOME);
      await fresh.close();
    }
  });
});
