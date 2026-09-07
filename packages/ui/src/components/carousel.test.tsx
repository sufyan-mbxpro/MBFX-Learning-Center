// Carousel's contract is "the no-JS surface is complete, the client island is
// only an enhancement" (ADR-018 rule 2). jsdom has no layout engine and no
// IntersectionObserver, which makes it exactly the environment to prove that:
// every assertion below runs with the observer absent, and the component still
// has to render all of its content and keep its controls sane.
import { cleanup, render, screen } from "@testing-library/react";
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
