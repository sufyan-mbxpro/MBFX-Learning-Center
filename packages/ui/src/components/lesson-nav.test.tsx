// Guards for the lesson pager redesign (changes-24, ADR-082 #3).
//
// The bug this replaced was invisible to every automated check the repo has:
// the "Next" label rendered at `text-xs opacity-80` on the brand ground, which
// types, lints and passes axe (axe does not compute contrast through an
// `opacity` on an ancestor of the text). It just could not be read. So the
// rule is asserted structurally instead: the eyebrow separates from the title
// by SIZE, and no cell dims its own ink.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LessonNav } from "./lesson-nav.tsx";

afterEach(cleanup);

const LABELS = { previous: "Previous lesson", next: "Next lesson", navAria: "Lesson navigation" };

const PREVIOUS = { href: "/learn/forex/price-action/candlesticks", title: "Candlesticks" };
const NEXT = {
  href: "/learn/forex/price-action/indicators",
  title: "Technical Analysis Toolkit: Indicators That Matter",
};

function renderNav(props: Partial<React.ComponentProps<typeof LessonNav>> = {}) {
  return render(<LessonNav previous={PREVIOUS} next={NEXT} labels={LABELS} {...props} />);
}

describe("LessonNav", () => {
  it("renders nothing when a lesson stands alone", () => {
    const { container } = renderNav({ previous: null, next: null });
    expect(container.firstChild).toBeNull();
  });

  it("offers each neighbour as one link carrying its label and its title", () => {
    renderNav();
    const back = screen.getByRole("link", { name: /Previous lesson/ });
    const forward = screen.getByRole("link", { name: /Next lesson/ });
    expect(back.getAttribute("href")).toBe(PREVIOUS.href);
    expect(forward.getAttribute("href")).toBe(NEXT.href);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("emphasises the forward step and not the backward one", () => {
    // The two steps are not equal. Back is an outline card on `bg-card`;
    // forward is the filled one, which is the whole point of the pair.
    renderNav();
    expect(screen.getByRole("link", { name: /Next lesson/ }).className).toContain("bg-primary");
    expect(screen.getByRole("link", { name: /Previous lesson/ }).className).toContain("bg-card");
  });

  it("separates the eyebrow from the title by size, never by dimming it", () => {
    // `opacity-80` on the brand ground is what this replaced, and it is the
    // one failure mode neither axe nor the contrast property test can see.
    const { container } = renderNav();
    const forward = screen.getByRole("link", { name: /Next lesson/ });
    const eyebrow = screen.getByText("Next lesson");

    expect(eyebrow.className).toContain("text-2xs");
    expect(eyebrow.className).toContain("uppercase");
    expect(eyebrow.className).not.toMatch(/opacity-\d/);
    expect(forward.className).not.toMatch(/text-primary-foreground\//);
    expect(container.querySelectorAll('[class*="opacity-"]')).toHaveLength(0);
  });

  it("holds the empty column so the forward step stays at the end", () => {
    // First lesson of a course: without the spacer, "Next" slides to the
    // start of the bar and the pager reads as a back button.
    const { container } = renderNav({ previous: null });
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("points both chevrons along the reading direction", () => {
    // plan §10 names these arrows as one of the area's highest-risk RTL
    // surfaces: a chevron that does not flip is a pager pointing backwards.
    const { container } = renderNav();
    const chevrons = container.querySelectorAll("svg");
    expect(chevrons).toHaveLength(2);
    for (const chevron of chevrons) {
      expect(chevron.getAttribute("class")).toContain("rtl:rotate-180");
    }
  });

  it("states its one-column base so a phone cannot scroll sideways", () => {
    const { container } = renderNav();
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("grid-cols-1");
    expect(nav?.getAttribute("aria-label")).toBe("Lesson navigation");
  });
});
