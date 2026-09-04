// ADR-018 compliance tests. These pin the GUARANTEES, not the styling:
// content stays visible without JS, reduced motion short-circuits at the JS
// level (not just via the CSS duration reset), and the preloader's cap and
// once-per-session gate actually hold. Everything here is a behaviour a
// future refactor could silently break with no lint or type error.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrowRight } from "lucide-react";
import { Badge } from "./badge.tsx";
import { Button } from "./button.tsx";
import { Card } from "./card.tsx";
import { Counter } from "./counter.tsx";
import { IconCard } from "./icon-card.tsx";
import { ImageReveal } from "./image-reveal.tsx";
import { Marquee } from "./marquee.tsx";
import { PaginationLink } from "./pagination.tsx";
import { Reveal } from "./reveal.tsx";
import { RevealObserver } from "./reveal-observer.tsx";
import { ScrollToTop } from "./scroll-to-top.tsx";
import { SiteLoader } from "./site-loader.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-reveal-js");
  sessionStorage.clear();
});

/** jsdom implements neither of these; real browsers implement both. */
function stubBrowser({
  reducedMotion = false,
  supportsViewTimeline = false,
  withIntersectionObserver = true,
}: {
  reducedMotion?: boolean;
  supportsViewTimeline?: boolean;
  withIntersectionObserver?: boolean;
} = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      // The components query for "no-preference", so a reduced-motion user
      // is the one for whom this does NOT match.
      matches: query.includes("no-preference") ? !reducedMotion : reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal("CSS", { supports: () => supportsViewTimeline });

  const instances: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
  if (withIntersectionObserver) {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        targets: Element[] = [];
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          instances.push(this);
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve(target: Element) {
          this.targets = this.targets.filter((t) => t !== target);
        }
        disconnect() {
          this.targets = [];
        }
      },
    );
  } else {
    vi.stubGlobal("IntersectionObserver", undefined);
  }

  /** Fire an intersection for every element the component is watching. */
  function triggerIntersection(isIntersecting = true) {
    for (const instance of instances) {
      const entries = instance.targets.map(
        (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      );
      if (entries.length > 0) {
        act(() => {
          instance.callback(entries, {} as IntersectionObserver);
        });
      }
    }
  }

  return { triggerIntersection };
}

describe("Reveal — ADR-018 rule 2: content is visible without JS", () => {
  it("renders its children with no inline opacity/transform hiding them", () => {
    render(<Reveal variant="up">Headline</Reveal>);
    const el = screen.getByText("Headline");
    // The hidden state lives ONLY behind [data-reveal-js] in CSS, which
    // nothing has set here — so a no-JS render shows finished content.
    expect(el.style.opacity).toBe("");
    expect(el.style.transform).toBe("");
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(false);
  });

  it("uses logical start/end variant classes, never left/right", () => {
    render(
      <>
        <Reveal variant="start">A</Reveal>
        <Reveal variant="end">B</Reveal>
      </>,
    );
    expect(screen.getByText("A").className).toContain("reveal-start");
    expect(screen.getByText("B").className).toContain("reveal-end");
  });

  it("the `fade` variant adds no transform class at all", () => {
    render(<Reveal variant="fade">C</Reveal>);
    const className = screen.getByText("C").className;
    expect(className).toContain("reveal");
    expect(className).not.toMatch(/reveal-(up|start|end|scale)/);
  });
});

describe("RevealObserver — the fallback path can never strand content hidden", () => {
  it("does nothing at all when the browser supports scroll-driven animation natively", () => {
    stubBrowser({ supportsViewTimeline: true });
    render(
      <>
        <RevealObserver />
        <Reveal>Native</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(false);
  });

  it("does nothing under reduced motion, so the finished state shows immediately", () => {
    stubBrowser({ reducedMotion: true });
    render(
      <>
        <RevealObserver />
        <Reveal>Reduced</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(false);
  });

  it("refuses to set data-reveal-js when there is no IntersectionObserver to unhide with", () => {
    // The dangerous combination: fallback CSS path (no native support) but
    // no way to ever add .is-visible. Hiding here would be permanent.
    stubBrowser({ withIntersectionObserver: false });
    render(
      <>
        <RevealObserver />
        <Reveal>Stranded?</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(false);
  });

  it("on an unsupporting browser it hides, then unhides each target as it intersects", () => {
    const { triggerIntersection } = stubBrowser();
    render(
      <>
        <RevealObserver />
        <Reveal>Fallback</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(true);
    expect(screen.getByText("Fallback").classList.contains("is-visible")).toBe(false);

    triggerIntersection();
    expect(screen.getByText("Fallback").classList.contains("is-visible")).toBe(true);
  });

  it("removes data-reveal-js on unmount, so a stale attribute can't hide a later page", () => {
    stubBrowser();
    const { unmount } = render(
      <>
        <RevealObserver />
        <Reveal>Bye</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(false);
  });
});

describe("Counter — ADR-018 rule 3: reduced motion short-circuits in JS", () => {
  it("renders the final value in the initial markup (correct with no JS at all)", () => {
    stubBrowser();
    render(<Counter value={1500} />);
    expect(screen.getByText("1,500")).toBeTruthy();
  });

  it("never animates from zero under reduced motion — the final value stays put", () => {
    const { triggerIntersection } = stubBrowser({ reducedMotion: true });
    render(<Counter value={90} suffix="+" />);
    triggerIntersection();
    // A CSS duration reset alone could not prevent this: the count-up is a
    // JS rAF loop, so the component has to check the preference itself.
    expect((document.querySelector("[data-slot=counter]") as HTMLElement).textContent).toBe("90+");
  });

  it("counts up from zero once scrolled into view when motion is allowed", () => {
    const { triggerIntersection } = stubBrowser();
    render(<Counter value={90} suffix="+" duration={1000} />);
    triggerIntersection();
    // First frame of the animation: reset to 0 before the rAF ramp runs.
    expect((document.querySelector("[data-slot=counter]") as HTMLElement).textContent).toBe("0+");
  });

  it("renders prefix and suffix around the formatted number", () => {
    stubBrowser();
    render(<Counter value={2500} prefix="$" suffix="M" />);
    expect((document.querySelector("[data-slot=counter]") as HTMLElement).textContent).toBe(
      "$2,500M",
    );
  });
});

describe("SiteLoader — ADR-018 rule 4: bounded, skippable, once per session", () => {
  it("is skipped entirely under reduced motion", () => {
    stubBrowser({ reducedMotion: true });
    const { container } = render(<SiteLoader />);
    expect(container.querySelector("[data-slot=site-loader]")).toBeNull();
  });

  it("shows on the first visit of a session and marks the session", () => {
    stubBrowser();
    const { container } = render(<SiteLoader />);
    expect(container.querySelector("[data-slot=site-loader]")).not.toBeNull();
    expect(sessionStorage.getItem("mbfx:site-loader-shown")).toBe("1");
  });

  it("does not show again once the session is marked", () => {
    stubBrowser();
    sessionStorage.setItem("mbfx:site-loader-shown", "1");
    const { container } = render(<SiteLoader />);
    expect(container.querySelector("[data-slot=site-loader]")).toBeNull();
  });

  it("dismisses itself within the 900ms hard cap even if `load` never fires", () => {
    vi.useFakeTimers();
    stubBrowser();
    const { container } = render(<SiteLoader />);
    expect(container.querySelector("[data-slot=site-loader]")).not.toBeNull();

    // 900ms cap + the 200ms fade-out this component schedules after it.
    act(() => {
      vi.advanceTimersByTime(900 + 200);
    });
    expect(container.querySelector("[data-slot=site-loader]")).toBeNull();
    vi.useRealTimers();
  });

  it("never blocks interaction with the page underneath", () => {
    stubBrowser();
    const { container } = render(<SiteLoader />);
    const overlay = container.querySelector("[data-slot=site-loader]");
    expect(overlay?.className).toContain("pointer-events-none");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Marquee — CSS-only ticker with an accessible duplicate", () => {
  it("duplicates the track and hides the copy from assistive tech", () => {
    const { container } = render(
      <Marquee>
        <span>EUR/USD</span>
      </Marquee>,
    );
    // Two copies in the DOM (the seamless loop), one of them aria-hidden.
    expect(screen.getAllByText("EUR/USD")).toHaveLength(2);
    expect(container.querySelectorAll("[aria-hidden=true]")).toHaveLength(1);
  });

  it("exposes speed as a CSS variable rather than a JS animation loop", () => {
    const { container } = render(
      <Marquee speed={20}>
        <span>x</span>
      </Marquee>,
    );
    const marquee = container.querySelector<HTMLElement>("[data-slot=marquee]");
    expect(marquee?.style.getPropertyValue("--marquee-duration")).toBe("20s");
  });

  it("opts out of hover-pause only when asked", () => {
    const { container: on } = render(
      <Marquee>
        <span>x</span>
      </Marquee>,
    );
    expect(on.querySelector("[data-slot=marquee]")?.hasAttribute("data-pause-on-hover")).toBe(
      false,
    );

    cleanup();
    const { container: off } = render(
      <Marquee pauseOnHover={false}>
        <span>x</span>
      </Marquee>,
    );
    expect(off.querySelector("[data-slot=marquee]")?.getAttribute("data-pause-on-hover")).toBe(
      "false",
    );
  });
});

describe("ScrollToTop", () => {
  it("is hidden until the sentinel scrolls out of view, then appears", () => {
    const { triggerIntersection } = stubBrowser();
    render(<ScrollToTop label="Back to top" />);
    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.className).toContain("opacity-0");

    // Sentinel leaves the viewport => the user has scrolled past it.
    triggerIntersection(false);
    expect(button.className).toContain("opacity-100");
  });

  it("scrolls instantly rather than smoothly under reduced motion", () => {
    stubBrowser({ reducedMotion: true });
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    render(<ScrollToTop label="Back to top" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});

describe("variant additions (changes-03-plan.md §4.2)", () => {
  it("Card exposes its variant as a data attribute — the hook globals.css targets for `elevated`", () => {
    const { container } = render(<Card variant="elevated">x</Card>);
    const card = container.querySelector("[data-slot=card]");
    expect(card?.getAttribute("data-variant")).toBe("elevated");
    // The resting/hover shadow is a CSS rule keyed on that attribute, NOT a
    // hover:shadow-* utility class, which would lose to .card-hover:hover.
    expect(card?.className).not.toContain("hover:shadow-card");
  });

  it("Card's featured variant highlights with a border, not a ring card-hover would override", () => {
    const { container } = render(<Card variant="featured">x</Card>);
    const className = container.querySelector("[data-slot=card]")?.className ?? "";
    expect(className).toContain("border-primary-interactive");
    // --primary-subtle regression (found by a live Lighthouse audit,
    // 2026-09-04): it is a fixed near-white tint that does not adapt to
    // dark mode, so pairing it with dark-mode ink fails contrast. bg-
    // primary/10 shifts with the surface in both modes instead.
    expect(className).not.toContain("bg-primary-subtle");
  });

  it("Badge's eyebrow uses --primary-interactive text, never raw --primary (ADR-018 rule 5)", () => {
    render(<Badge variant="eyebrow">Account</Badge>);
    const className = screen.getByText("Account").className;
    expect(className).toContain("text-primary-interactive");
    expect(className).not.toMatch(/(?:^|\s)text-primary(?:\s|$)/);
  });

  it("Badge's eyebrow background is an alpha tint, not the mode-inconsistent --primary-subtle", () => {
    // Lighthouse measured 1.65:1 (expected 4.5:1) on this exact pairing in
    // dark mode before the fix: --primary-interactive is derived against
    // --background (correctly, per mode), but --primary-subtle stays a
    // fixed light tint regardless of mode — the two were never guaranteed
    // consistent together. bg-primary/10 is an alpha blend OVER the actual
    // current background, so it tracks --primary-interactive's assumption
    // in both modes.
    render(<Badge variant="eyebrow">Account</Badge>);
    const className = screen.getByText("Account").className;
    expect(className).toContain("bg-primary/10");
    expect(className).not.toContain("bg-primary-subtle");
  });

  it("IconCard's icon box uses the same alpha-tint fix, not --primary-subtle", () => {
    const { container } = render(<IconCard icon={ArrowRight} title="x" />);
    // IconCard doesn't export its icon-box span directly; assert on the
    // rendered markup instead of importing an internal selector.
    expect(container.innerHTML).toContain("bg-primary/10");
    expect(container.innerHTML).not.toContain("bg-primary-subtle");
  });

  it("Button's pill shape wins over the size's own radius", () => {
    render(
      <Button shape="pill" size="xs">
        x
      </Button>,
    );
    // twMerge keeps the last radius in the string; `shape` is declared after
    // `size` in the cva config specifically so pill wins for every size.
    const className = screen.getByRole("button").className;
    expect(className).toContain("rounded-full");
    // Only the BARE utility must be gone. `in-data-[slot=button-group]:
    // rounded-lg` legitimately survives — it's variant-prefixed, so it
    // applies in a different context and never competes with rounded-full.
    expect(className).not.toMatch(/(?:^|\s)rounded-lg(?:\s|$)/);
  });
});

describe("Pagination — numbered pills mark the current page", () => {
  it("sets aria-current='page' on the active link only", () => {
    render(
      <>
        <PaginationLink href="#1" isActive>
          1
        </PaginationLink>
        <PaginationLink href="#2">2</PaginationLink>
      </>,
    );
    expect(screen.getByText("1").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("2").getAttribute("aria-current")).toBeNull();
  });
});

describe("ImageReveal — decoupled from next/image (architecture.md #10)", () => {
  it("applies the zoom/wipe classes to whatever image element it is given", () => {
    const { container } = render(
      <ImageReveal>
        <img src="/x.png" alt="Chart" />
      </ImageReveal>,
    );
    const img = container.querySelector("img");
    expect(img?.className).toContain("media-zoom");
    expect(container.querySelector("[data-slot=aspect-ratio]")?.className).toContain("image-wipe");
  });

  it("can opt out of the entrance wipe", () => {
    const { container } = render(
      <ImageReveal wipe={false}>
        <img src="/x.png" alt="Chart" />
      </ImageReveal>,
    );
    expect(container.querySelector("[data-slot=aspect-ratio]")?.className).not.toContain(
      "image-wipe",
    );
  });
});
