// Regression + contract for ADR-064 (testing.md #2).
//
// The bug: next-themes' ThemeProvider rendered the pre-paint init script from
// inside a CLIENT component. React 19.2 warns on that path ("Encountered a
// script tag while rendering React component") and substitutes a <div>, because
// a script React creates on the client never executes.
//
// Moving it to a server component was NOT enough — the element still lived in
// the RSC payload, and Next's client prerender/recovery passes create host
// instances from that payload, so the warning came back pointing at the new
// file. The script therefore has to leave the React element tree entirely:
// <ThemeScript> injects it through useServerInsertedHTML, whose callback runs
// only on the server, and renders null in the browser.
//
// So NEITHER component may put a <script> in the tree. Both are asserted here.
import { cleanup, render, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildThemeInitScript, THEME_STORAGE_KEY } from "@repo/ui/lib/theme-mode.ts";
import { ThemeProvider, useTheme } from "./theme-provider.tsx";
import { ThemeScript } from "./theme-script.tsx";

function matchMediaStub(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

beforeEach(() => {
  window.matchMedia = matchMediaStub(false);
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

afterEach(cleanup);

describe("ThemeProvider — no script in the client tree (ADR-064)", () => {
  it("renders no <script> element", () => {
    const { container } = render(
      <ThemeProvider>
        <p>child</p>
      </ThemeProvider>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });

  it("does not trigger React's client-rendered-script warning", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ThemeProvider>
        <p>child</p>
      </ThemeProvider>,
    );

    const warned = spy.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes("script tag while rendering")),
    );
    expect(warned).toBe(false);
    spy.mockRestore();
  });
});

describe("ThemeScript — server-only injection (ADR-064)", () => {
  it("renders nothing in the browser", () => {
    const { container } = render(<ThemeScript nonce="test-nonce" />);

    expect(container.innerHTML).toBe("");
    expect(container.querySelector("script")).toBeNull();
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });

  it("does not trigger React's client-rendered-script warning", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ThemeScript />);

    const warned = spy.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes("script tag while rendering")),
    );
    expect(warned).toBe(false);
    spy.mockRestore();
  });
});

describe("ThemeProvider — mode state", () => {
  function Probe() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    return (
      <button data-theme={theme} data-resolved={resolvedTheme} onClick={() => setTheme("dark")}>
        toggle
      </button>
    );
  }

  it("adopts the stored mode after mount and stamps <html>", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const { getByRole } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(getByRole("button").dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("resolves 'system' against the OS preference", () => {
    window.matchMedia = matchMediaStub(true);

    const { getByRole } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(getByRole("button").dataset.theme).toBe("system");
    expect(getByRole("button").dataset.resolved).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme persists the choice and swaps the class", () => {
    const { getByRole } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("light")).toBe(true);

    act(() => getByRole("button").click());

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("useTheme outside a provider returns a stub instead of throwing", () => {
    const { getByRole } = render(<Probe />);
    expect(getByRole("button").dataset.theme).toBe("system");
  });
});

describe("buildThemeInitScript — the pre-paint guard", () => {
  it("applies the stored mode when evaluated, before any React render", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    // Indirect eval: the point of the test is that this string is valid,
    // self-contained JS the browser can run on its own.
    (0, eval)(buildThemeInitScript());

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("is self-contained — it closes over no module-scope binding", () => {
    // A minifier renames module-scope names; the script would then throw a
    // ReferenceError in the browser and the mode would only apply after
    // hydration. Every value it needs must arrive as a literal argument.
    const script = buildThemeInitScript();
    expect(script).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(script).toContain('["light","dark"]');
  });
});
