// ADR-018 compliance tests. These pin the GUARANTEES, not the styling:
// content stays visible without JS, reduced motion short-circuits at the JS
// level (not just via the CSS duration reset), and the preloader's cap and
// once-per-session gate actually hold. Everything here is a behaviour a
// future refactor could silently break with no lint or type error.
import { StrictMode } from "react";
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

  /**
   * Fire an intersection for every element the component is watching.
   *
   * `ratio` is the part that matters since ADR-111: the observer reveals when
   * the ratio reaches the threshold and hides only when it is exactly 0, so a
   * stub that reports `isIntersecting` alone cannot express the case the two
   * thresholds exist for.
   */
  function triggerIntersection(ratio = 1) {
    for (const instance of instances) {
      const entries = instance.targets.map(
        (target) =>
          ({
            target,
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
          }) as IntersectionObserverEntry,
      );
      if (entries.length > 0) {
        act(() => {
          instance.callback(entries, {} as IntersectionObserver);
        });
      }
    }
  }

  /** How many elements are still being watched across every observer. */
  function watchedCount() {
    return instances.reduce((total, instance) => total + instance.targets.length, 0);
  }

  return { triggerIntersection, watchedCount };
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

describe("RevealObserver — the primary path can never strand content hidden", () => {
  // ADR-104 §2 made the observer the path that runs even on a browser with
  // native scroll-driven animation. ADR-111 then reversed its run-once half at
  // the owner's ask: a reveal now REPLAYS, so the assertions below are about
  // an element that can arrive more than once.
  it("runs even where the browser supports scroll-driven animation natively", () => {
    const { triggerIntersection } = stubBrowser({ supportsViewTimeline: true });
    render(
      <>
        <RevealObserver />
        <Reveal>Native</Reveal>
      </>,
    );
    expect(document.documentElement.hasAttribute("data-reveal-js")).toBe(true);
    triggerIntersection();
    expect(screen.getByText("Native").classList.contains("is-visible")).toBe(true);
  });

  it("leaves a `timeline` opt-in to the CSS path — never hidden by the observer", () => {
    const { triggerIntersection } = stubBrowser({ supportsViewTimeline: true });
    render(
      <>
        <RevealObserver />
        <Reveal timeline>Linked</Reveal>
      </>,
    );
    const el = screen.getByText("Linked");
    expect(el.hasAttribute("data-reveal-timeline")).toBe(true);
    // Not observed, so an intersection cannot mark it — the CSS owns it, and
    // the `:not([data-reveal-timeline])` guard keeps this path off it.
    triggerIntersection();
    expect(el.classList.contains("is-visible")).toBe(false);
  });

  // ADR-111 §1, and the inverse of the ADR-104 test it replaces. Written as
  // one journey rather than three assertions because the bug it guards is a
  // `unobserve` creeping back in, which only shows up on the SECOND arrival.
  it("REPLAYS — it keeps watching, and a target can arrive again (ADR-111 §1)", () => {
    const { triggerIntersection, watchedCount } = stubBrowser();
    render(
      <>
        <RevealObserver />
        <Reveal>Again</Reveal>
      </>,
    );
    const el = screen.getByText("Again");
    expect(watchedCount()).toBe(1);

    triggerIntersection();
    expect(el.classList.contains("is-visible")).toBe(true);
    // Still watched: an `unobserve` here is what made the reveal one-way.
    expect(watchedCount()).toBe(1);

    triggerIntersection(0);
    expect(el.classList.contains("is-visible")).toBe(false);

    triggerIntersection();
    expect(el.classList.contains("is-visible")).toBe(true);
  });

  // The failure a single threshold would have: an element taller than the
  // viewport can never show 15% of itself, so hiding at the ARRIVAL threshold
  // would tear a long band away from a reader still in the middle of it.
  it("hides only when a target is GONE, never merely below the threshold", () => {
    const { triggerIntersection } = stubBrowser();
    render(
      <>
        <RevealObserver />
        <Reveal>Tall</Reveal>
      </>,
    );
    const el = screen.getByText("Tall");

    triggerIntersection();
    expect(el.classList.contains("is-visible")).toBe(true);

    // Barely on screen, well under the 0.15 default — and it stays.
    triggerIntersection(0.02);
    expect(el.classList.contains("is-visible")).toBe(true);

    triggerIntersection(0);
    expect(el.classList.contains("is-visible")).toBe(false);
  });

  it("picks up a reveal added after mount — bands stream in under ADR-095", async () => {
    const { triggerIntersection } = stubBrowser();
    render(<RevealObserver />);

    const late = document.createElement("div");
    late.className = "reveal reveal-up";
    late.textContent = "Streamed";
    act(() => {
      document.body.append(late);
    });
    // MutationObserver callbacks are microtask-scheduled.
    await act(async () => {
      await Promise.resolve();
    });

    triggerIntersection();
    expect(late.classList.contains("is-visible")).toBe(true);
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
    expect(sessionStorage.getItem("mbx:site-loader-shown")).toBe("1");
  });

  it("does not show again once the session is marked", () => {
    stubBrowser();
    sessionStorage.setItem("mbx:site-loader-shown", "1");
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

  it("still dismisses when its mount effect is replayed before `load` (changes-46)", () => {
    // The admin's Preview / View live tab: a fresh session, a document still
    // loading at hydration, and a mount effect React runs, cleans up and runs
    // again (StrictMode). The replay used to find the session claimed and
    // return early, with the cleanup having removed every way to dismiss —
    // the overlay stayed until a refresh.
    vi.useFakeTimers();
    stubBrowser();
    const readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const { container } = render(
      <StrictMode>
        <SiteLoader />
      </StrictMode>,
    );
    expect(container.querySelector("[data-slot=site-loader]")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(900 + 200);
    });
    expect(container.querySelector("[data-slot=site-loader]")).toBeNull();
    readyState.mockRestore();
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

    // Sentinel leaves the viewport => the user has scrolled past it. A ratio
    // of 0 is what the stub turns into `isIntersecting: false`, which is the
    // only thing ScrollToTop reads.
    triggerIntersection(0);
    expect(button.className).toContain("opacity-100");
  });

  it("marks itself visible for the arrival flash and draws a progress ring (changes-44 #2)", () => {
    const { triggerIntersection } = stubBrowser();
    render(<ScrollToTop label="Back to top" />);
    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button.hasAttribute("data-visible")).toBe(false);
    expect(button.querySelector("[data-slot=scroll-to-top-progress]")).not.toBeNull();

    triggerIntersection(0);
    expect(button.hasAttribute("data-visible")).toBe(true);
    // Written straight to the element, never through React state.
    expect(button.style.getPropertyValue("--scroll-progress")).not.toBe("");
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

  it("every button size keeps the derived rounded-md, at every size", () => {
    // ADR-107 deleted the `pill` shape, and with it the test that pinned
    // pill-beats-size. What is worth guarding now is the opposite: no size
    // may declare a radius of its own, so the whole surface moves with
    // `--radius` when an admin changes `radiusBase`.
    for (const size of ["xs", "default", "xl"] as const) {
      const { unmount } = render(<Button size={size}>x</Button>);
      const className = screen.getByRole("button").className;
      expect(className).toMatch(/(?:^|\s)rounded-md(?:\s|$)/);
      expect(className).not.toContain("rounded-full");
      unmount();
    }
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
