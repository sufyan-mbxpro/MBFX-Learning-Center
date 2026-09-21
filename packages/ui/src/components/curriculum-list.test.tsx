// Guards for the curriculum redesign (changes-24, ADR-082 #1 and #2).
//
// Four things here are load-bearing and none of them shows up in a type or a
// lint error when it breaks:
//
//   1. The timeline's marker is the play affordance, and it is OUTSIDE the
//      anchor. It is only clickable because the title's stretched `::after`
//      covers it — drop the overlay and the play button becomes decoration
//      with nothing on screen to say so; wrap the row in an anchor instead and
//      you nest anchors and get two entries in the accessibility tree.
//   2. That overlay resolves against the `<li>`. Position anything between the
//      anchor and the row and it silently shrinks to that box, with the
//      timeline still looking exactly right.
//   3. The rail never puts the duration on the title's line. That single line
//      is what squeezed a lesson title to ~78px and wrapped it one word per
//      line in a 16rem column — the reason the variant exists at all.
//   4. A locked lesson is never a link, in any variant.
//   5. (changes-33) The section header carries an ORDINAL and ONE accent. The
//      ordinal is what makes three sections distinguishable at a glance, and
//      the single accent is what stops the card tones from competing with the
//      tonal vocabulary difficulty and lesson state already own.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CurriculumList, type CurriculumSection } from "./curriculum-list.tsx";
import { LessonStateIcon } from "./lesson-state-icon.tsx";

afterEach(cleanup);

const LABELS = {
  states: {
    completed: "Completed",
    "in-progress": "In progress",
    "not-started": "Not started",
    locked: "Locked",
  },
  externalBadge: "External",
  opensInNewTab: "Opens in a new tab",
  optionalBadge: "Optional",
} as const;

const SECTIONS: CurriculumSection[] = [
  {
    id: "s1",
    title: "Reading Price Action: Candlesticks & Chart Patterns",
    countLabel: "2 lessons",
    lessons: [
      {
        id: "l1",
        href: "/learn/forex/price-action/candlesticks",
        title: "price-action-candlesticks",
        summary: "What a candle body actually tells you.",
        durationLabel: "42-min read",
        isExternal: true,
      },
      {
        id: "l2",
        href: "/learn/forex/price-action/indicators",
        title: "Technical Analysis Toolkit: Indicators That Matter",
        durationLabel: "55-min read",
        state: "in-progress",
        isCurrent: true,
      },
    ],
  },
];

function renderList(props: Partial<React.ComponentProps<typeof CurriculumList>> = {}) {
  return render(
    <CurriculumList
      sections={SECTIONS}
      labels={LABELS}
      defaultOpenSectionIds={["s1"]}
      {...props}
    />,
  );
}

describe("CurriculumList — the course outline is a timeline of play marks", () => {
  it("marks every lesson with a state icon and joins all but the last", () => {
    const { container } = renderList();

    // One marker per lesson; one connector fewer, because the last node has
    // nothing below it to join to.
    expect(screen.getAllByRole("img", { name: /Not started|In progress/ })).toHaveLength(2);
    expect(container.querySelectorAll("li > span > span.w-px")).toHaveLength(1);
  });

  it("makes the marker clickable by covering the row with a stretched link", () => {
    renderList();

    const title = screen.getByRole("link", { name: "price-action-candlesticks" });
    expect(title.getAttribute("href")).toBe("/learn/forex/price-action/candlesticks");
    expect(title.className).toContain("after:absolute");
    expect(title.className).toContain("after:inset-0");

    // The marker is a sibling of the anchor's column, not a child of it — the
    // overlay is the only thing making it part of the click target.
    const row = title.closest("li");
    const marker = within(row as HTMLElement).getByRole("img", { name: "Not started" });
    expect(marker.closest("a")).toBeNull();
    expect(row?.contains(marker)).toBe(true);
  });

  it("resolves that overlay against the row, not a box inside it", () => {
    // Both halves required: the `<li>` must be the positioned host, and
    // nothing between it and the anchor may be positioned, or `inset-0`
    // silently means "that inner box".
    const title = renderList() && screen.getByRole("link", { name: "price-action-candlesticks" });
    const row = title.closest("li");
    expect(row?.className).toContain("relative");

    const positioned = title.closest(".relative, .absolute, .fixed, .sticky");
    expect(positioned).toBe(row);
  });

  it("orders the lessons, because the timeline claims a sequence", () => {
    const { container } = renderList();
    expect(container.querySelector("ol")).not.toBeNull();
  });

  it("indents the lessons under their section with a guide rule (changes-46)", () => {
    // The owner could not tell a lesson from a section: both markers sat in
    // the same column. Logical properties only, so RTL mirrors it.
    const { container } = renderList();
    const lessons = container.querySelector("[data-slot=curriculum-lessons]");
    expect(lessons?.tagName).toBe("OL");
    expect(lessons?.className).toMatch(/\bms-\d/);
    expect(lessons?.className).toMatch(/\bps-\d/);
    expect(lessons?.className).toContain("border-s-2");
    expect(lessons?.className).not.toMatch(/\b(ml|pl|border-l)-/);
  });

  it("never links a locked lesson", () => {
    renderList({
      sections: [{ ...SECTIONS[0]!, lessons: [{ ...SECTIONS[0]!.lessons[0]!, state: "locked" }] }],
    });
    expect(screen.queryByRole("link", { name: "price-action-candlesticks" })).toBeNull();
    expect(screen.getByRole("img", { name: "Locked" })).not.toBeNull();
  });
});

describe("CurriculumList — the rail variant", () => {
  it("puts the reading time under the title rather than beside it", () => {
    // The regression this variant exists for. `full` lays the row out as
    // `[marker] [title …] [duration]`, which in a rail leaves the title a
    // sliver; `rail` gives the title the whole column and drops the meta to
    // its own line, so the duration must NOT be a sibling of the title.
    renderList({ variant: "rail" });

    const title = screen.getByText("price-action-candlesticks");
    const duration = screen.getByText("42-min read");
    const column = title.parentElement;
    expect(column?.className).toContain("flex-col");
    // The meta wrapper is the title's NEXT sibling in that column, so the
    // duration is on the line below rather than competing for the title's.
    expect(duration.parentElement?.previousElementSibling).toBe(title);

    // The contrast: `compact` is the variant that does share the line, and it
    // is used where there is room for it.
    cleanup();
    renderList({ variant: "compact" });
    expect(screen.getByText("42-min read").previousElementSibling).toBe(
      screen.getByText("price-action-candlesticks").parentElement,
    );
  });

  it("marks the lesson being read for a screen reader and for a glance", () => {
    renderList({ variant: "rail" });

    const current = screen.getByRole("link", {
      name: /Technical Analysis Toolkit/,
    });
    expect(current.getAttribute("aria-current")).toBe("page");
    // Not colour alone: the tint comes with an inline-start edge bar.
    expect(current.className).toContain("before:bg-primary");

    const other = screen.getByRole("link", { name: /price-action-candlesticks/ });
    expect(other.getAttribute("aria-current")).toBeNull();
  });

  it("does not underline a wrapped section title on hover", () => {
    // The Accordion's own `hover:underline` underlines all four wrapped lines
    // of a rail-width section title at once.
    const { container } = renderList({ variant: "rail" });
    const trigger = container.querySelector('[data-slot="accordion-trigger"]');
    expect(trigger?.className).toContain("hover:no-underline");
  });

  it("renders no card of its own — the caller supplies the chrome", () => {
    // It is used bare inside a Sheet; a second border there would be a panel
    // drawn inside a panel.
    const { container } = renderList({ variant: "rail" });
    expect(container.firstElementChild?.className ?? "").not.toContain("rounded-xl");
  });

  it("draws each lesson as its own card, indented under its section (changes-39)", () => {
    // A hairline between rows still read as one block at rail width.
    renderList({ variant: "rail" });
    const link = screen.getByRole("link", { name: /price-action-candlesticks/ });
    const row = link.closest("li");
    expect(row?.className).toContain("rounded-lg");
    expect(row?.className).toContain("ring-1");
    expect(row?.className).not.toContain("border-b");
    // Logical inset, never `pl-` (code-style.md #3).
    expect(row?.parentElement?.className).toMatch(/\bps-\d/);
    expect(row?.parentElement?.className).toContain("gap-2");
  });
});

describe("CurriculumList — the section header says which section it is (changes-33)", () => {
  // The bug: three sections rendered as three identically-weighted white
  // cards, and the only thing telling them apart was reading the titles. A
  // curriculum is a SEQUENCE, which is what the timeline inside each card
  // already says and what the headers above them did not.

  it.each(["full", "rail"] as const)("numbers each section in %s", (variant) => {
    const { container } = renderList({
      variant,
      sections: [
        { ...SECTIONS[0]!, id: "a", title: "First" },
        { ...SECTIONS[0]!, id: "b", title: "Second" },
      ],
      defaultOpenSectionIds: [],
    });
    const markers = [...container.querySelectorAll("[aria-hidden]")]
      .map((el) => el.textContent?.trim())
      .filter((text) => text === "1" || text === "2");
    expect(markers).toEqual(["1", "2"]);
  });

  it("marks the ordinal aria-hidden — it is the title that names the section", () => {
    const { container } = renderList({ defaultOpenSectionIds: [] });
    const ordinal = [...container.querySelectorAll("span")].find(
      (el) => el.textContent?.trim() === "1",
    );
    expect(ordinal?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses ONE accent, never a hue per section and never a tonal status", () => {
    // Two rules in one assertion. Cycling a hue per section would be
    // decoration that looks like meaning; so would dressing the lesson COUNT
    // as a status. This design system spends success/warning/info on
    // difficulty and on lesson state, and a third unrelated use on the same
    // pages is how a reader stops trusting any of them.
    const { container } = renderList({
      sections: [
        { ...SECTIONS[0]!, id: "a" },
        { ...SECTIONS[0]!, id: "b" },
        { ...SECTIONS[0]!, id: "c" },
      ],
      defaultOpenSectionIds: [],
    });
    const html = container.innerHTML;
    for (const tone of ["bg-success/", "bg-warning/", "bg-info/"]) {
      expect(html, tone).not.toContain(tone);
    }
  });

  it("shows the lesson count as a badge rather than as grey micro-type", () => {
    const { container } = renderList({ defaultOpenSectionIds: [] });
    const count = screen.getByText("2 lessons");
    expect(count.getAttribute("data-slot")).toBe("badge");
    // And it is not the smallest thing on the card any more.
    expect(container.innerHTML).not.toContain("text-2xs font-medium tracking-caps");
  });

  it("gives the reading time a badge too, in both list variants", () => {
    for (const variant of ["full", "rail"] as const) {
      cleanup();
      renderList({ variant });
      expect(screen.getByText("42-min read").getAttribute("data-slot")).toBe("badge");
    }
  });
});

describe("LessonStateIcon — the four states stay distinguishable", () => {
  it("draws not-started as a filled play mark, not an empty ring", () => {
    const { container } = render(<LessonStateIcon state="not-started" label="Not started" />);
    const glyph = container.querySelector("svg");
    expect(glyph?.getAttribute("class")).toContain("fill-current");
  });

  it("keeps a distinct glyph per state, so the marker survives greyscale", () => {
    const states = ["completed", "in-progress", "not-started", "locked"] as const;
    const shapes = states.map((state) => {
      const { container } = render(<LessonStateIcon state={state} label={state} />);
      const svg = container.querySelector("svg")?.innerHTML ?? "";
      cleanup();
      return svg;
    });
    expect(new Set(shapes).size).toBe(states.length);
  });

  it("grows for the timeline without the caller hand-sizing it", () => {
    const { container } = render(
      <LessonStateIcon state="not-started" label="Not started" size="lg" />,
    );
    expect(container.firstElementChild?.className).toContain("size-9");
  });
});
