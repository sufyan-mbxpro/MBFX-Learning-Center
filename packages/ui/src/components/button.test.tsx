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
