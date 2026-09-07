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
describe("Button — intent variants (ADR-046)", () => {
  const INTENTS = ["success", "warning", "info", "destructive"] as const;

  it.each(INTENTS)("the %s variant tints from its own semantic token", (variant) => {
    const { getByRole } = render(<Button variant={variant}>Act</Button>);
    const className = getByRole("button").className;
    const token = variant === "destructive" ? "destructive" : variant;
    expect(className).toContain(`bg-${token}/10`);
    // Labels use the *-interactive derivation @repo/theme contrast-checks
    // (ADR-003), never the raw fill hue. `destructive` predates that and
    // keeps its own label token.
    if (variant !== "destructive") expect(className).toContain(`text-${token}-interactive`);
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
