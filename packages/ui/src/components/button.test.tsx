// Regression: Base UI's Button defaults `nativeButton` to true, which
// assumes `render` (when supplied) still resolves to a real <button>. Every
// call site in this repo uses `render` to become a Next.js <Link> (an <a>)
// instead, which fired Base UI's dev-only mismatch warning at runtime
// ("A component that acts as a button expected a native <button>...").
// button.tsx now defaults `nativeButton` to false whenever `render` is
// supplied, unless the caller overrides it.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button.tsx";

afterEach(cleanup);

describe("Button — Base UI nativeButton semantics", () => {
  it("rendering as a non-<button> element via `render` does not trigger Base UI's nativeButton mismatch warning", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Button render={<a href="#" />}>Link-styled button</Button>);
    const mismatchWarning = spy.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes("nativeButton")),
    );
    expect(mismatchWarning).toBe(false);
    spy.mockRestore();
  });

  it("the default (no `render` prop) still renders a real <button> element", () => {
    const { getByRole } = render(<Button>Click</Button>);
    expect(getByRole("button").tagName).toBe("BUTTON");
  });

  it("an explicit `nativeButton` override is respected over the `render`-based default", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Forcing nativeButton=true while render resolves to <a> reproduces the
    // exact mismatch this fix otherwise avoids — proves the override path.
    render(
      <Button nativeButton render={<a href="#" />}>
        Forced native
      </Button>,
    );
    const mismatchWarning = spy.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes("nativeButton")),
    );
    expect(mismatchWarning).toBe(true);
    spy.mockRestore();
  });
});

// changes-10 / ADR-046: the intent variants exist so an action's colour
// carries its consequence. Pinning them here because the whole point is
// that "Archive" and "Publish" must NOT resolve to the same classes —
// a regression that reverts one to `default` is invisible to typecheck.
describe("Button — intent variants (ADR-046, ADR-073)", () => {
  const INTENTS = ["success", "warning", "info", "destructive"] as const;
  const TONAL = ["success", "warning", "info"] as const;

  it.each(TONAL)("the %s variant tints from its own token at /10, hovering at /15", (variant) => {
    const { getByRole } = render(<Button variant={variant}>Act</Button>);
    const className = getByRole("button").className;
    expect(className).toContain(`bg-${variant}/10`);
    expect(className).toContain(`hover:bg-${variant}/15`);
    // Labels use the *-interactive derivation, which ADR-073 guarantees at
    // 4.5:1 on its own tint up to /15 — never the raw fill hue, and never a
    // tint above the contract (the old dark-mode /20–/30 steps).
    expect(className).toContain(`text-${variant}-interactive`);
    expect(className).not.toMatch(/bg-\w+\/(2|3)0/);
  });

  it("destructive is SOLID, like the reference (ADR-072 §9)", () => {
    const { getByRole } = render(<Button variant="destructive">Delete</Button>);
    const className = getByRole("button").className;
    expect(className).toContain("bg-destructive");
    expect(className).toContain("text-destructive-foreground");
    expect(className).not.toContain("bg-destructive/10");
  });

  it("no two intents resolve to the same class string", () => {
    const seen = new Set(
      [...INTENTS, "default" as const].map((variant) => {
        const { getByRole } = render(<Button variant={variant}>Act</Button>);
        const className = getByRole("button").className;
        cleanup();
        return className;
      }),
    );
    expect(seen.size).toBe(INTENTS.length + 1);
  });
});

// changes-36 / ADR-117 — the button for a band that IS `--secondary`.
//
// Four call sites had each written the same 200-character class string by
// hand (the homepage hero, the footer's social buttons, the connect band, and
// then every photographic masthead). The variant is that string, once.
describe("Button — the inverted variant", () => {
  it("rides on --secondary-foreground, never on --primary-foreground", () => {
    const { getByRole } = render(<Button variant="inverted">Watch the videos</Button>);
    const className = getByRole("button").className;
    // The whole point: `--secondary-foreground` is derived readable ON
    // `--secondary` (ADR-003), which is the only contrast claim a band filled
    // with `--secondary` can make. `--primary-foreground` is derived against
    // `--primary` and carries no guarantee here at all.
    expect(className).toContain("text-secondary-foreground");
    expect(className).not.toContain("text-primary-foreground");
  });

  it("is not `secondary`, which on this band would be an invisible button", () => {
    const { getByRole } = render(<Button variant="inverted">Watch the videos</Button>);
    const className = getByRole("button").className;
    // `variant="secondary"` is `bg-secondary`. On a `bg-secondary` band that
    // is a control the same colour as the surface under it — which is what
    // every masthead was rendering before ADR-117 moved those bands off the
    // brand gradient. The tint here is an OPACITY of the band's own ink.
    expect(className).not.toMatch(/(^|\s)bg-secondary(\s|$)/);
    expect(className).toContain("bg-secondary-foreground/10");
  });

  it("carries its own edge, because it has no fill to be read by", () => {
    const { getByRole } = render(<Button variant="inverted">Watch the videos</Button>);
    expect(getByRole("button").className).toContain("ring-secondary-foreground/25");
  });
});
