// AmbientMotif's guarantees, pinned. Everything here is a property a future
// arrangement or a careless call site could break with no type or lint
// error — which is exactly the set worth a test.
//
// What is NOT asserted: how it looks. jsdom has no layout engine and does
// not apply the stylesheet, so the mask, the drift and the `md:` breakpoint
// are not observable here. They ride with the Playwright/axe suite deferred
// with Module 14. What jsdom CAN see is the contract between the component
// and that stylesheet — the class names, the custom properties, the
// accessibility posture and the arrangement data itself.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AmbientMotif, MOTIF_ARRANGEMENTS, type MotifVariant } from "./ambient-motif.tsx";
import { PageHero } from "./page-hero.tsx";

afterEach(cleanup);

const VARIANTS = Object.keys(MOTIF_ARRANGEMENTS) as MotifVariant[];

function field(container: HTMLElement) {
  const el = container.querySelector<HTMLElement>('[data-slot="ambient-motif"]');
  if (!el) throw new Error("no ambient-motif field rendered");
  return el;
}

describe("AmbientMotif — accessibility posture", () => {
  it("is hidden from assistive tech and inert to the pointer", () => {
    const { container } = render(<AmbientMotif />);
    const el = field(container);

    // aria-hidden is inherited, so one attribute on the field covers every
    // glyph inside it. A screen reader announcing "dollar sign, chart,
    // percent" ahead of the headline would be strictly worse than silence.
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("pointer-events-none");
    expect(el.className).toContain("select-none");
  });

  it("contributes no focusable node", () => {
    const { container } = render(<AmbientMotif variant="chart" />);
    expect(
      container.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(0);
    // lucide renders <svg> without focusable="false"; IE-era Edge and some
    // AT put unqualified SVGs in the tab order. Cheap to set, so it is set.
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("carries no text content — nothing here needs translating", () => {
    const { container } = render(<AmbientMotif variant="currency" />);
    // The guard behind code-style.md #2: if a glyph were ever swapped for a
    // literal "$" or "EUR", this fails and the string gets routed through a
    // catalog (or the change gets reconsidered) before it ships.
    expect(field(container).textContent).toBe("");
  });
});

describe("AmbientMotif — stylesheet contract", () => {
  it("wires each glyph's drift through the custom properties globals.css reads", () => {
    const { container } = render(<AmbientMotif variant="mixed" />);
    const glyphs = container.querySelectorAll<HTMLElement>(".motif-glyph");

    expect(glyphs).toHaveLength(MOTIF_ARRANGEMENTS.mixed.length);
    for (const glyph of glyphs) {
      for (const prop of [
        "--motif-duration",
        "--motif-delay",
        "--motif-drift-x",
        "--motif-drift-y",
        "--motif-spin",
      ]) {
        // A missing property would silently fall back to the keyframe's own
        // default, and every glyph would drift identically — the effect
        // still "works", which is what makes it worth pinning.
        expect(glyph.style.getPropertyValue(prop)).not.toBe("");
      }
    }
  });

  it("keeps `position` a Tailwind utility, never a hand-written one", () => {
    // The cascade-layer trap .pulse-ring documents in globals.css: a
    // hand-written utility beats a generated one at equal specificity, so a
    // `position` inside .motif-glyph would drop every glyph into normal flow
    // and stack them down the page.
    const { container } = render(<AmbientMotif />);
    for (const glyph of container.querySelectorAll<HTMLElement>(".motif-glyph")) {
      expect(glyph.className).toContain("absolute");
    }
    expect(field(container).className).toContain("motif-field");
  });

  it("places glyphs on the INLINE axis so the field mirrors under RTL", () => {
    const { container } = render(<AmbientMotif variant="learn" />);
    for (const glyph of container.querySelectorAll<HTMLElement>(".motif-glyph")) {
      // rtl.test.tsx's invariant, restated for inline styles: a physical
      // `left`/`right` here would pin the arrangement to one direction.
      expect(glyph.style.insetInlineStart).not.toBe("");
      expect(glyph.style.left).toBe("");
      expect(glyph.style.right).toBe("");
    }
  });
});

describe("AmbientMotif — readability budget", () => {
  it.each(VARIANTS)("keeps every %s glyph faint and out of the centre column", (variant) => {
    for (const glyph of MOTIF_ARRANGEMENTS[variant]) {
      // The ceiling the component's docblock states. Above it the field
      // starts competing with body copy on a muted band.
      expect(glyph.ink).toBeLessThanOrEqual(8);
      expect(glyph.ink).toBeGreaterThan(0);
      // Edge-biased placement. The stylesheet's mask enforces this too —
      // this is the half that keeps the mask from having to do visible work.
      expect(glyph.x <= 22 || glyph.x >= 72).toBe(true);
      // A glyph that spun would read as a loading spinner, which promises
      // something this component cannot deliver.
      expect(Math.abs(glyph.spin ?? 0)).toBeLessThanOrEqual(10);
    }
  });

  it.each(VARIANTS)("keeps at least one %s glyph on small screens", (variant) => {
    // Everything else is `md:` and up. With none marked compact the effect
    // would vanish entirely on a phone rather than thinning out.
    expect(MOTIF_ARRANGEMENTS[variant].some((g) => g.compact)).toBe(true);
  });

  it.each(VARIANTS)("staggers %s so no two glyphs pulse together", (variant) => {
    const phases = MOTIF_ARRANGEMENTS[variant].map((g) => `${g.duration}/${g.delay}`);
    // Identical duration AND delay is what makes a field read as one
    // blinking object instead of ambient drift.
    expect(new Set(phases).size).toBe(phases.length);
  });

  it("scales ink by `intensity` and refuses to spend past the budget", () => {
    const { container: dim } = render(<AmbientMotif variant="chart" intensity={0.5} />);
    const { container: full } = render(<AmbientMotif variant="chart" />);
    const { container: over } = render(<AmbientMotif variant="chart" intensity={4} />);

    const first = (c: HTMLElement) =>
      Number(c.querySelector<HTMLElement>(".motif-glyph")!.style.opacity);

    expect(first(dim)).toBeCloseTo(first(full) / 2, 5);
    // A call site is not the place to overspend the readability budget.
    expect(first(over)).toBeCloseTo(first(full), 5);
  });
});

describe("PageHero — motif slot", () => {
  it("renders the motif alongside, not instead of, the backdrop", () => {
    const { container } = render(
      <PageHero
        title="Markets"
        backdrop={<div data-testid="backdrop" />}
        motif={<AmbientMotif variant="chart" />}
      />,
    );

    expect(container.querySelector('[data-testid="backdrop"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="ambient-motif"]')).not.toBeNull();
  });

  it("keeps the motif out of the backdrop's 25% opacity clamp", () => {
    const { container } = render(
      <PageHero title="Markets" backdrop={<div />} motif={<AmbientMotif />} />,
    );
    // The clamp exists for artwork that would eat the tone's contrast. The
    // motif already carries single-digit ink; nested inside the clamp it
    // would round to invisible, which is why it is its own slot.
    expect(field(container).closest(".opacity-25")).toBeNull();
  });

  it("renders nothing extra when no motif is passed", () => {
    const { container } = render(<PageHero title="Markets" />);
    expect(container.querySelector('[data-slot="ambient-motif"]')).toBeNull();
  });
});
