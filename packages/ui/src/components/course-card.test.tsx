// Guards for the learn design pass (2026-09-09).
//
// Two things here are load-bearing and neither is visible in a type or a lint
// error if it breaks:
//
//   1. The card is ONE link to the course, painted over the whole header
//      region by a stretched `::after`. Get it wrong in either direction and
//      the failure is silent — a wrapper <a> would nest anchors (invalid, and
//      it swallows the CTA), while dropping the overlay class puts the page
//      back where it started, with a cover nobody can click.
//   2. Every control inside that region is raised above the overlay. A
//      control that is not raised is UNREACHABLE with a pointer while still
//      being present, focusable and perfectly fine in a snapshot.
//
// Plus the tonal badges the level chips ride on: their whole point is an
// alpha tint with derived ink, which is the pairing badge.tsx documents
// having got wrong once already.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./badge.tsx";
import { CourseCard } from "./course-card.tsx";

afterEach(cleanup);

const LABELS = {
  start: "Start",
  openExternal: "Open course",
  showLessons: "Show lessons",
  hideLessons: "Hide lessons",
  noArtwork: "No cover image",
  externalBadge: "External",
  opensInNewTab: "opens in a new tab",
  optionalBadge: "Optional",
  states: {
    completed: "Completed",
    "in-progress": "In progress",
    "not-started": "Not started",
    locked: "Locked",
  },
} as const;

const SECTIONS = [
  {
    id: "s1",
    title: "Getting started",
    description: null,
    countLabel: "2 lessons",
    lessons: [
      { id: "l1", href: "/learn/forex-101/what-is-forex", title: "What is forex?" },
      { id: "l2", href: "/learn/forex-101/pips", title: "Pips" },
    ],
  },
];

function renderCard(overrides: Partial<React.ComponentProps<typeof CourseCard>> = {}) {
  return render(
    <CourseCard
      href="/learn/forex-101"
      title="Forex 101"
      summary="Currency markets from the ground up."
      difficultyLabel="Beginner"
      lessonsLabel="2 lessons"
      sections={SECTIONS}
      labels={LABELS}
      {...overrides}
    />,
  );
}

describe("CourseCard — the whole card opens the course", () => {
  it("links the title with a stretched overlay rather than wrapping the card in an anchor", () => {
    const { container } = renderCard();

    const title = screen.getByRole("link", { name: "Forex 101" });
    expect(title.getAttribute("href")).toBe("/learn/forex-101");
    // The overlay IS the click target for the cover and the summary. Without
    // it the card is back to a title-only hit area.
    expect(title.className).toContain("after:absolute");
    expect(title.className).toContain("after:inset-0");

    // ...and no ancestor anchor, which is what a naive "make the card
    // clickable" change reaches for. Nested anchors are invalid markup and
    // would make the CTA inside unreachable.
    const article = container.querySelector("article");
    expect(article?.tagName).toBe("ARTICLE");
    expect(article?.closest("a")).toBeNull();
  });

  it("scopes the overlay to the header region so the expanded lesson list stays clickable", () => {
    const { container } = renderCard();
    const title = screen.getByRole("link", { name: "Forex 101" });

    // The overlay resolves against the nearest POSITIONED ancestor. If that
    // is the <article>, an expanded curriculum below is covered by it and
    // every lesson row stops responding.
    const positioned = title.closest(".relative");
    expect(positioned).not.toBeNull();
    expect(positioned?.tagName).toBe("DIV");
    const header = positioned as HTMLElement;
    // The disclosure is INSIDE the overlay's box (hence the raising test
    // above); the panel it opens is a sibling OUTSIDE it.
    expect(within(header).getByRole("button", { name: /Show lessons/ })).not.toBeNull();
    const article = container.querySelector("article");
    expect(article?.contains(header)).toBe(true);
    expect(article).not.toBe(header);
  });

  it("raises the CTA and the disclosure above the overlay", () => {
    renderCard();

    // Both sit inside the stretched link's box; both would be dead to a
    // pointer without their own stacking context above it.
    for (const control of [
      // The CTA is an <a> that Button gives role="button" — it is a
      // control, not a destination, in the accessibility tree.
      screen.getByRole("button", { name: "Start" }),
      screen.getByRole("button", { name: /Show lessons/ }),
    ]) {
      const raised = control.closest(".z-10");
      expect(
        raised,
        `${control.textContent} is not raised above the stretched link`,
      ).not.toBeNull();
    }
  });

  it("exposes exactly one LINK to the course — the stretched title", () => {
    renderCard();
    // Both the title and the CTA point at the course, but Button stamps
    // role="button" on its anchor, so a screen-reader user is offered the
    // destination once and the control once. Two links with the same name
    // and target would be the duplicate a wrapper anchor introduces.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("Forex 101");
    expect(links[0]?.getAttribute("href")).toBe("/learn/forex-101");
  });
});

describe("CourseCard — level tone and the video chip", () => {
  it("defaults the level chip to the eyebrow tone", () => {
    renderCard();
    expect(screen.getByText("Beginner").className).toContain("text-primary-interactive");
  });

  it("renders the caller's tone when one is given", () => {
    renderCard({ difficultyTone: "success" });
    const chip = screen.getByText("Beginner").className;
    expect(chip).toContain("text-success-interactive");
    expect(chip).toContain("bg-success/10");
  });

  it("shows a video chip only when the caller counted videos", () => {
    renderCard();
    expect(screen.queryByText("2 videos")).toBeNull();

    cleanup();
    renderCard({ videoLabel: "2 videos" });
    expect(screen.getByText("2 videos")).not.toBeNull();
  });

  it("falls back to the no-artwork state when a cover has no renderer", () => {
    // The renderer is the only path to an image (architecture.md #10) — a
    // silent <img> fallback here would opt every cover out of next/image.
    renderCard({ coverUrl: "/learn/track-forex.svg" });
    expect(screen.getByRole("img", { name: "No cover image" })).not.toBeNull();
  });
});

describe("Badge — tonal chips are alpha tints with derived ink", () => {
  // Same guarantee `eyebrow` is already tested for, and for the same reason:
  // a fixed tint paired with mode-derived ink fails contrast in one mode.
  it.each([
    ["success", "bg-success/10", "text-success-interactive"],
    ["warning", "bg-warning/10", "text-warning-interactive"],
    ["info", "bg-info/10", "text-info-interactive"],
  ] as const)("%s tints the surface and uses the -interactive ink", (variant, tint, ink) => {
    render(<Badge variant={variant}>Level</Badge>);
    const className = screen.getByText("Level").className;
    expect(className).toContain(tint);
    expect(className).toContain(ink);
    // Never the raw hue as small text: --success at 1.x:1 on white is the
    // exact trap ADR-018 rule 5 closes.
    expect(className).not.toMatch(new RegExp(`(?:^|\\s)text-${variant}(?:\\s|$)`));
  });
});
