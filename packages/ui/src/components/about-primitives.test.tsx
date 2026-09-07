// ADR-047 §2 and ADR-018 compliance for the About-section primitives
// (changes-09-plan.md PR 2). These pin GUARANTEES, not styling:
//
//   - an empty collection renders nothing at all (no heading, no empty
//     grid, no stray <ul>), because a page must never advertise a fact it
//     does not have;
//   - the timeline's hidden entries stay in the DOM, so a crawler and a
//     no-JS visitor read the whole history;
//   - the map's legend is the interactive surface and the pins are not,
//     so the tab order has one stop per destination rather than two.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AwardCard } from "./award-card.tsx";
import { AwardGrid } from "./award-grid.tsx";
import { CheckList } from "./check-list.tsx";
import { HotspotMap } from "./hotspot-map.tsx";
import { PageHero } from "./page-hero.tsx";
import { SplitCallout } from "./split-callout.tsx";
import { StatBand } from "./stat-band.tsx";
import { Timeline, type TimelineItem } from "./timeline.tsx";

afterEach(cleanup);

const TIMELINE: TimelineItem[] = Array.from({ length: 9 }, (_, i) => ({
  id: `y${i}`,
  marker: 2016 + i,
  title: `Milestone ${i}`,
  body: `What happened in year ${i}`,
}));

describe("the empty rule (ADR-047 §2) — no data, no section furniture", () => {
  it("CheckList renders nothing for an empty list", () => {
    const { container } = render(<CheckList items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("AwardGrid renders nothing with no children", () => {
    const { container } = render(<AwardGrid />);
    expect(container.innerHTML).toBe("");
  });

  it("StatBand renders nothing with no children — including its caption", () => {
    const { container } = render(<StatBand caption="Figures as of March 2026" />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("Figures as of March 2026")).toBeNull();
  });

  it("Timeline renders nothing for an empty history", () => {
    const { container } = render(<Timeline items={[]} expandLabel="Show" collapseLabel="Hide" />);
    expect(container.innerHTML).toBe("");
  });

  it("HotspotMap renders nothing without points — no empty map box", () => {
    const { container } = render(<HotspotMap points={[]} legendLabel="Where we operate" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("CheckList", () => {
  it("renders one row per item", () => {
    render(<CheckList items={["Never sells signals", "No paid broker placement"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Never sells signals")).toBeTruthy();
  });
});

describe("AwardGrid / AwardCard", () => {
  it("renders the issuer and year as given — they are facts, not decoration", () => {
    render(
      <AwardGrid>
        <AwardCard title="Best Education" issuer="Example Awards" year={2026} />
      </AwardGrid>,
    );
    expect(screen.getByText("Best Education")).toBeTruthy();
    expect(screen.getByText("Example Awards · 2026")).toBeTruthy();
  });
});

describe("Timeline", () => {
  it("keeps every entry in the DOM when collapsed, so crawlers and no-JS visitors read them all", () => {
    render(
      <Timeline items={TIMELINE} collapsedCount={4} expandLabel="Show" collapseLabel="Close" />,
    );
    for (const item of TIMELINE) expect(screen.getByText(item.title as string)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(TIMELINE.length);
  });

  it("collapses the overflow behind a native <details>, with both toggle labels present", () => {
    const { container } = render(
      <Timeline items={TIMELINE} collapsedCount={4} expandLabel="Show" collapseLabel="Close" />,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    // Four visible, five inside the disclosure.
    expect(details?.querySelectorAll("li")).toHaveLength(5);
    expect(screen.getByText("Show")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("renders no disclosure at all when everything fits", () => {
    const { container } = render(
      <Timeline items={TIMELINE.slice(0, 3)} expandLabel="Show" collapseLabel="Close" />,
    );
    expect(container.querySelector("details")).toBeNull();
  });
});

describe("HotspotMap", () => {
  const POINTS = [
    { id: "gb", label: "United Kingdom", detail: "Support desk", x: 47, y: 30 },
    { id: "ae", label: "United Arab Emirates", detail: "Operations", x: 60, y: 45 },
  ];

  it("gives each destination exactly one tab stop — the legend row, not the pin", () => {
    render(<HotspotMap points={POINTS} legendLabel="Where we operate" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(POINTS.length);
    expect(buttons[0]?.textContent).toContain("United Kingdom");
  });

  it("marks the hovered destination active, and clears it on leave", () => {
    const { container } = render(<HotspotMap points={POINTS} legendLabel="Where we operate" />);
    const row = screen.getAllByRole("button")[0];
    fireEvent.mouseEnter(row!);
    expect(container.querySelectorAll("[data-active]").length).toBeGreaterThan(0);
    fireEvent.mouseLeave(row!);
    expect(container.querySelectorAll("[data-active]")).toHaveLength(0);
  });

  // Reversed deliberately (ADR-051 §5). This component shipped positioning
  // pins with `inset-inline-start`, which is the right default everywhere
  // else in this repo — and the wrong one here. A pin's x is a LONGITUDE: on
  // an RTL page the logical property mirrors the pin field while the map
  // artwork underneath stays put, and New York lands in Asia. Reading order
  // flips; geography does not.
  //
  // The test now guards the physical property, so restoring the logical one
  // "for consistency" fails loudly instead of silently scrambling the map.
  it("positions pins on the PHYSICAL axis — a longitude does not mirror in RTL", () => {
    const { container } = render(<HotspotMap points={POINTS} legendLabel="Where we operate" />);
    const pin = container.querySelector<HTMLElement>("[style*='left']");
    expect(pin).not.toBeNull();
    expect(container.querySelector("[style*='inset-inline-start']")).toBeNull();
    // calc(x% - half) rather than translateX(-50%): the translate would fight
    // the hover scale on the same property.
    expect(pin?.style.transform).toBe("");
    expect(pin?.style.left).toContain("47%");
  });

  it("keeps the pins in the same box as the map, not the padded frame", () => {
    const { container } = render(
      <HotspotMap
        points={POINTS}
        legendLabel="Where we operate"
        mapSlot={<div data-testid="map" />}
      />,
    );
    // Percentages resolve against the absolute ancestor. If the pins and the
    // map artwork do not share ONE un-padded box, every pin drifts by the
    // padding's share of the width.
    const pin = container.querySelector<HTMLElement>("[style*='left']");
    const map = container.querySelector("[data-testid=map]");
    expect(pin?.parentElement).toBe(map?.parentElement);
    expect(pin?.parentElement?.className).not.toContain("p-4");
  });
});

describe("PageHero", () => {
  it("renders the h1, and omits the media column when no media is supplied", () => {
    const { container } = render(<PageHero title="About MBX" lead="Who we are." />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("About MBX");
    expect(container.querySelector("[data-slot=container]")?.className).not.toContain(
      "lg:grid-cols-2",
    );
  });

  it("renders eyebrow, actions and footnote when given", () => {
    render(
      <PageHero
        eyebrow="About"
        title="About MBX"
        actions={<button type="button">Start learning</button>}
        footnote="Figures are illustrative."
      />,
    );
    expect(screen.getByText("About")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start learning" })).toBeTruthy();
    expect(screen.getByText("Figures are illustrative.")).toBeTruthy();
  });
});

describe("SplitCallout", () => {
  it("renders a gradient panel instead of a broken image when no media is supplied", () => {
    const { container } = render(
      <SplitCallout title="Structured curriculum">
        <p>Body copy.</p>
      </SplitCallout>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[aria-hidden].bg-gradient-to-br")).not.toBeNull();
  });

  it("shows the step twice when numbered — the marker and the panel watermark — and not at all otherwise", () => {
    const { rerender } = render(<SplitCallout title="One" step={1} />);
    // Both are aria-hidden decoration; the ordering is carried by the DOM.
    expect(screen.getAllByText("1")).toHaveLength(2);
    rerender(<SplitCallout title="One" />);
    expect(screen.queryByText("1")).toBeNull();
  });

  it("drops the watermark when the caller supplies real media", () => {
    render(<SplitCallout title="One" step={3} media={<img alt="" src="/x.jpg" />} />);
    expect(screen.getAllByText("3")).toHaveLength(1);
  });

  it("reverses by reordering, never by repositioning", () => {
    const { container } = render(<SplitCallout title="One" reverse />);
    expect(container.innerHTML).toContain("lg:order-2");
    expect(container.innerHTML).not.toContain("flex-row-reverse");
  });
});
