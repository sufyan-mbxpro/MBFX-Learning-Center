// The all-blocks render suite (plan "every block ships with... a render
// test in light and dark"). jsdom has no layout engine, so "light/dark"
// means: every fixture renders without throwing under both a `light` and a
// `dark` wrapper class (the actual color values are the theme's job,
// covered by its own contrast contract — this suite is the renderer's).
// The physical-utility check mirrors @repo/ui's rtl.test.tsx.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AxeFixturePage, BLOCK_FIXTURES } from "./axe-fixture.tsx";
import { ALL_BLOCK_DEFINITIONS } from "./definitions/index.ts";
import { listRegisteredBlocks } from "./registry.ts";
import "./blocks-list.ts";

afterEach(cleanup);

vi.stubGlobal(
  "matchMedia",
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);

const PHYSICAL_UTILITY = /(?:^|[\s:])(?:-?p[lr]-|-?m[lr]-|text-left|text-right|-?left-|-?right-)/;

function expectNoPhysicalUtilities(container: HTMLElement) {
  for (const el of [container, ...container.querySelectorAll<HTMLElement>("*")]) {
    const className = typeof el.className === "string" ? el.className : "";
    expect(PHYSICAL_UTILITY.test(className), `physical directional utility in: ${className}`).toBe(
      false,
    );
  }
}

describe("registry — every registered block has a fixture (check:block-fixtures covers the file layout)", () => {
  it("has a fixture entry for every registered block type", () => {
    const registeredTypes = listRegisteredBlocks().map((b) => b.definition.type);
    for (const type of registeredTypes) {
      expect(Object.keys(BLOCK_FIXTURES), `no fixture for "${type}"`).toContain(type);
    }
  });

  it("ALL_BLOCK_DEFINITIONS lists exactly the registered types", () => {
    const registeredTypes = new Set(listRegisteredBlocks().map((b) => b.definition.type));
    const listedTypes = new Set(ALL_BLOCK_DEFINITIONS.map((d) => d.type));
    expect(listedTypes).toEqual(registeredTypes);
  });
});

describe.each(["light", "dark"] as const)("all-blocks fixture page — %s", (theme) => {
  it(`renders every registered block's fixture without throwing (${theme})`, async () => {
    const page = await AxeFixturePage();
    const { container } = render(<div className={theme}>{page}</div>);
    expect(container.querySelector('[data-testid="axe-fixture"]')).not.toBeNull();
  });

  it(`emits no physical-direction utility classes (${theme}, RTL readiness)`, async () => {
    const page = await AxeFixturePage();
    const { container } = render(<div className={theme}>{page}</div>);
    expectNoPhysicalUtilities(container);
  });
});

describe("all-blocks fixture page — every block renders its authored text", () => {
  it("renders text content for every text-bearing fixture", async () => {
    const page = await AxeFixturePage();
    const { container } = render(page);
    const text = container.textContent ?? "";
    expect(text).toContain("Learn forex the right way"); // heading
    expect(text).toContain("Everything you need to trade with confidence."); // paragraph
    expect(text).toContain("Start learning"); // button
    expect(text).toContain("Ready to start?"); // cta-band
    expect(text).toContain("Is this free?"); // faq
    expect(text).toContain("EUR/USD"); // table
    expect(text).toContain("Regulated brokers"); // icon-card
  });
});
