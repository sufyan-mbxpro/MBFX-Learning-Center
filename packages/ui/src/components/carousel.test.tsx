// Carousel's contract is "the no-JS surface is complete, the client island is
// only an enhancement" (ADR-018 rule 2). jsdom has no layout engine and no
// IntersectionObserver, which makes it exactly the environment to prove that:
// every assertion below runs with the observer absent, and the component still
// has to render all of its content and keep its controls sane.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./carousel.tsx";

afterEach(cleanup);

beforeEach(() => {
  // Button/goTo read matchMedia for the reduced-motion short-circuit; jsdom
  // does not implement it (the same stub rtl.test.tsx installs).
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

function renderCarousel(slideCount = 3) {
  return render(
    <Carousel
      label="Platform sections"
      previousLabel="Previous sections"
      nextLabel="Next sections"
      slideLabels={Array.from({ length: slideCount }, (_, i) => `Slide ${i + 1}`)}
    >
      {Array.from({ length: slideCount }, (_, i) => (
        <article key={i}>Card {i + 1}</article>
      ))}
    </Carousel>,
  );
}

describe("Carousel — the no-JS surface", () => {
  it("renders every slide's content, not just the active one", () => {
    renderCarousel(5);
    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByText(`Card ${i}`)).toBeTruthy();
    }
  });

  it("nothing is hidden from assistive tech or a crawler", () => {
    renderCarousel(4);
    // Four slides as groups, each named — a slide the observer has not
    // reported on is still fully in the accessibility tree.
    expect(screen.getAllByRole("group")).toHaveLength(4);
    expect(screen.getByRole("group", { name: "Slide 4" })).toBeTruthy();
  });

  it("the track is a keyboard-reachable scroll region", () => {
    const { container } = renderCarousel();
    const track = container.querySelector("ul.carousel-track");
    expect(track).toBeTruthy();
    expect(track?.getAttribute("tabindex")).toBe("0");
  });
});

describe("Carousel — controls", () => {
  it("names the region as a carousel", () => {
    renderCarousel();
    const region = screen.getByRole("region", { name: "Platform sections" });
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
  });

  it("both arrows carry the caller's catalog labels — no hardcoded strings", () => {
    renderCarousel();
    expect(screen.getByRole("button", { name: "Previous sections" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next sections" })).toBeTruthy();
  });

  it("at rest on the first slide, previous is unavailable and next is not", () => {
    renderCarousel(4);
    const previous = screen.getByRole("button", { name: "Previous sections" });
    const next = screen.getByRole("button", { name: "Next sections" });
    expect(previous.hasAttribute("disabled")).toBe(true);
    // The fail-open half: with no IntersectionObserver the component must not
    // conclude it has reached the end and disable BOTH arrows, which would
    // leave the controls dead on any engine that lacks the observer.
    expect(next.hasAttribute("disabled")).toBe(false);
  });

  it("one dot per slide, and the first is current", () => {
    renderCarousel(6);
    const dots = screen.getAllByRole("button", { name: /^Slide \d$/ });
    expect(dots).toHaveLength(6);
    expect(dots[0]?.getAttribute("aria-current")).toBe("true");
    expect(dots[1]?.getAttribute("aria-current")).toBe(null);
  });
});

describe("Carousel — which controls render (changes-35, ADR-116 §1)", () => {
  const arrows = () => screen.queryAllByRole("button", { name: /^(Previous|Next) sections$/ });
  const dots = () => screen.queryAllByRole("button", { name: /^Slide \d$/ });

  function renderWith(props: Partial<React.ComponentProps<typeof Carousel>>, slideCount = 4) {
    return render(
      <Carousel
        label="Platform sections"
        previousLabel="Previous sections"
        nextLabel="Next sections"
        slideLabels={Array.from({ length: slideCount }, (_, i) => `Slide ${i + 1}`)}
        {...props}
      >
        {Array.from({ length: slideCount }, (_, i) => (
          <article key={i}>Card {i + 1}</article>
        ))}
      </Carousel>,
    );
  }

  it("defaults to both, which is what every pre-changes-35 call site got", () => {
    renderWith({});
    expect(arrows()).toHaveLength(2);
    expect(dots()).toHaveLength(4);
  });

  it("`arrows` renders no dot rail at all — not a hidden one", () => {
    renderWith({ controls: "arrows" });
    expect(arrows()).toHaveLength(2);
    // `display: none` would keep eight dead buttons in the payload of a band
    // that asked for arrows only. The assertion is absence, not invisibility.
    expect(dots()).toHaveLength(0);
  });

  it("`dots` renders no arrows", () => {
    renderWith({ controls: "dots" });
    expect(arrows()).toHaveLength(0);
    expect(dots()).toHaveLength(4);
  });

  it.each(["arrows", "dots", "both"] as const)(
    "%s keeps every slide named in the accessibility tree",
    (controls) => {
      renderWith({ controls });
      // Dropping a POINTER affordance must not drop the position readout: a
      // screen reader announces the named groups inside the labelled region,
      // and that is true in all three settings.
      expect(screen.getAllByRole("group")).toHaveLength(4);
      expect(screen.getByRole("group", { name: "Slide 3" })).toBeTruthy();
    },
  );

  it("the arrows keep their catalog labels when the dots are gone", () => {
    renderWith({ controls: "arrows" });
    expect(screen.getByRole("button", { name: "Previous sections" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next sections" })).toBeTruthy();
  });

  it("a one-slide track renders no controls in any setting", () => {
    // Both arrows would be permanently disabled and the rail would be one dot
    // that is already current. A control that cannot do anything is not an
    // affordance — `MetricRow`'s empty-group rule, applied to a control row.
    renderWith({}, 1);
    expect(arrows()).toHaveLength(0);
    expect(dots()).toHaveLength(0);
    // The slide itself is untouched: the no-JS surface is still complete.
    expect(screen.getByText("Card 1")).toBeTruthy();
  });

  it("centred alignment drops the rail's flex-1 so the arrows stay centred", () => {
    const { container } = renderWith({ controls: "arrows", controlsAlign: "center" });
    const row = container.querySelector("[data-slot=carousel] > div:last-of-type");
    expect(row?.className).toContain("justify-center");
  });

  it("start alignment is the default and keeps the rail spanning the row", () => {
    const { container } = renderWith({});
    const row = container.querySelector("[data-slot=carousel] > div:last-of-type");
    expect(row?.className).not.toContain("justify-center");
    // The dot rail, not the track: `ul:last-of-type` matches both, because
    // each is the only ul among its own siblings.
    expect(row?.querySelector("ul")?.className).toContain("flex-1");
  });
});

describe("Carousel — control tone", () => {
  // The `tone` prop is a CORRECTNESS switch, not a preference: the default
  // palette (--border, --primary-interactive) is derived for legibility
  // against --background, and on a `Section tone="inverted"` band the dots go
  // very nearly invisible. Pinning both palettes here because a regression
  // that quietly reverts one to the other is invisible to typecheck and to
  // every other test in this file.
  function dotClasses(container: HTMLElement) {
    return [...container.querySelectorAll("ul:last-of-type button")]
      .flatMap((el) => [...el.classList])
      .join(" ");
  }

  it("the default surface uses the background-derived palette", () => {
    const { container } = render(
      <Carousel label="L" previousLabel="P" nextLabel="N">
        <div>a</div>
        <div>b</div>
      </Carousel>,
    );
    const classes = dotClasses(container);
    expect(classes).toContain("bg-primary-interactive");
    expect(classes).toContain("bg-border");
    expect(classes).not.toContain("bg-secondary-foreground");
  });

  it("an inverted band uses --secondary-foreground, which is derived readable on it", () => {
    const { container } = render(
      <Carousel label="L" previousLabel="P" nextLabel="N" tone="inverted">
        <div>a</div>
        <div>b</div>
      </Carousel>,
    );
    const classes = dotClasses(container);
    expect(classes).toContain("bg-secondary-foreground");
    // The tokens computed against --background must be entirely absent, not
    // merely overridden — twMerge would keep both and the loser is a coin flip.
    expect(classes).not.toContain("bg-primary-interactive");
    expect(classes).not.toContain("bg-border");
  });
});

describe("Carousel — RTL", () => {
  it("emits no physical-direction utilities (code-style.md #3)", () => {
    const { container } = renderCarousel();
    const classes = [...container.querySelectorAll("*")]
      .flatMap((el) => [...el.classList])
      // `-mx-2`/`px-2` are symmetric axis utilities, not directional ones.
      .filter((c) => /^-?(pl|pr|ml|mr|left|right|text-(left|right))-/.test(c));
    expect(classes).toEqual([]);
  });

  it("scrolls by the LOGICAL inline axis, so RTL needs no [dir] branch", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderCarousel(4);
    screen.getByRole("button", { name: "Slide 3" }).click();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: "start", block: "nearest" }),
    );
  });

  it("honours prefers-reduced-motion by jumping instead of gliding", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderCarousel(4);
    screen.getByRole("button", { name: "Slide 2" }).click();
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
});

describe("Carousel — opt-in autoplay and hover arrows (changes-37, ADR-121 §4)", () => {
  function renderWith(props: Partial<React.ComponentProps<typeof Carousel>>, slideCount = 3) {
    return render(
      <Carousel
        label="Quotes"
        previousLabel="Previous quote"
        nextLabel="Next quote"
        slideLabels={Array.from({ length: slideCount }, (_, i) => `Slide ${i + 1}`)}
        {...props}
      >
        {Array.from({ length: slideCount }, (_, i) => (
          <article key={i}>Card {i + 1}</article>
        ))}
      </Carousel>,
    );
  }
  const autoplay = { pauseLabel: "Pause quotes", playLabel: "Play quotes" };

  it("renders no pause control and no hover arrows unless asked", () => {
    renderWith({ controls: "dots" });
    expect(screen.queryByRole("button", { name: "Pause quotes" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: /quote$/ })).toHaveLength(0);
  });

  it("autoplay renders a visible pause button that names the state it changes to", () => {
    renderWith({ controls: "dots", autoplay });
    const button = screen.getByRole("button", { name: "Pause quotes" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Play quotes" })).toBeTruthy();
  });

  it("autoplay loops, so neither arrow is disabled at the first slide", () => {
    renderWith({ controls: "arrows", autoplay });
    expect(screen.getByRole("button", { name: "Previous quote" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("hover arrows are absent, not disabled, where they cannot move", () => {
    renderWith({ controls: "dots", hoverArrows: true });
    // At rest on slide 0 of a non-looping carousel: next only.
    expect(screen.queryByRole("button", { name: "Previous quote" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next quote" })).toBeTruthy();
  });

  it("looping hover arrows offer both directions", () => {
    renderWith({ controls: "dots", hoverArrows: true, autoplay });
    expect(screen.getByRole("button", { name: "Previous quote" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next quote" })).toBeTruthy();
  });

  it("does not advance without an IntersectionObserver — motion fails closed", () => {
    vi.useFakeTimers();
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    renderWith({ controls: "dots", autoplay: { ...autoplay, interval: 1000 } });
    vi.advanceTimersByTime(5000);
    expect(scrollBy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
