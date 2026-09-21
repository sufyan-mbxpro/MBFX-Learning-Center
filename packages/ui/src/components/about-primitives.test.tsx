// ADR-047 §2 and ADR-018 compliance for the primitives the About section
// introduced (changes-09-plan.md PR 2).
//
// **The section is gone (changes-33, ADR-109) and this file is not.** The
// components stayed in `@repo/ui`, and so did the rule they exist to keep:
// `/support` is data-gated by ADR-047 §2 exactly as its predecessor was, and
// `PageHero` is on every public masthead. The NAME is stale; renaming it
// would be churn against a file whose subject has not changed.
//
// `AwardGrid`, `HotspotMap` and `Timeline` have no call site today. Kept
// deliberately — they are tested, and the next company-facts page will want
// them (ADR-109 Consequences).
//
// These pin GUARANTEES, not styling:
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

// ADR-117 — a masthead that was given a photograph shows the photograph.
//
// The owner's report was "remove the yellow cover/shade on all banners, also
// the text should be visible after remove the yellow shade", and both halves
// of that sentence are load-bearing. The brand gradient came off; something
// has to take over the contrast guarantee it was carrying, and a text-shadow
// over an arbitrary photograph is not a guarantee.
//
// Every assertion here is about the band's CLASS LIST rather than about how
// it looks, which is the only thing jsdom can settle — but the class list is
// where the decision lives: `--secondary-foreground` on `--secondary` is a
// pairing the theme engine derives readable (ADR-003), and the scrim is what
// makes `--secondary` the thing actually behind the words.
describe("PageHero — the photo tone", () => {
  const band = (c: HTMLElement) => c.querySelector("[data-slot=page-hero]")!;
  const backdrop = <img data-testid="art" alt="" src="/banners/news.webp" />;

  it("a backdrop selects `photo`, and `photo` is not the brand fill", () => {
    const { container } = render(<PageHero title="News" backdrop={backdrop} />);
    const el = band(container);
    expect(el.getAttribute("data-tone")).toBe("photo");
    expect(el.className).toContain("bg-secondary");
    expect(el.className).toContain("text-secondary-foreground");
    // The yellow. `--primary` is #C8986B by default (ADR-143), and a
    // full-band gradient of it is what every masthead was wearing.
    expect(el.className).not.toContain("from-primary");
  });

  it("renders the artwork at full strength, not clamped to 25%", () => {
    const { container } = render(<PageHero title="News" backdrop={backdrop} />);
    const wrapper = container.querySelector("[data-testid=art]")!.parentElement!;
    // 25% was the right ceiling while the art sat UNDER a fill; it is also
    // what made the owner's photography read as a texture nobody could see.
    expect(wrapper.className).not.toContain("opacity-25");
  });

  it("puts a --secondary scrim between the artwork and the copy", () => {
    const { container } = render(<PageHero title="News" backdrop={backdrop} />);
    const el = band(container);
    // Anything matching `from-secondary` is the veil: the copy reads against
    // a known fill in a known direction rather than against whatever the
    // photograph happens to contain at that point.
    expect(el.innerHTML).toContain("from-secondary");
  });

  it("clears the far side for a start-aligned band, and does not for a centred one", () => {
    // The asymmetry IS the design, and it is the homepage hero's idiom: a
    // start-aligned masthead keeps its words in the inline-start half, so the
    // scrim can go fully transparent on the other side and the reader sees
    // the picture rather than a tint of it. A centred masthead has copy
    // across the full width and cannot afford that anywhere.
    const start = render(<PageHero title="News" backdrop={backdrop} />).container;
    const centre = render(<PageHero title="News" align="center" backdrop={backdrop} />).container;
    expect(band(start).innerHTML).toContain("md:to-transparent");
    expect(band(centre).innerHTML).not.toContain("to-transparent");
  });

  it("keeps `brand` when there is no artwork to show", () => {
    // ADR-117 is not "the brand fill was wrong". A band with nothing behind
    // it still needs a surface, and the one the theme engine guarantees an
    // ink for is the one it should have.
    const { container } = render(<PageHero title="Sitemap" />);
    const el = band(container);
    expect(el.getAttribute("data-tone")).toBe("brand");
    expect(el.className).toContain("from-primary");
    expect(el.innerHTML).not.toContain("from-secondary");
  });

  it("lets an explicit tone win over the backdrop default", () => {
    const { container } = render(<PageHero title="News" tone="muted" backdrop={backdrop} />);
    const el = band(container);
    expect(el.getAttribute("data-tone")).toBe("muted");
    // No scrim either — the veil belongs to `photo` alone, and painting one
    // over a `muted` band would darken a light surface for no reason.
    expect(el.innerHTML).not.toContain("from-secondary");
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

// Both densities in one assertion, because the claim is comparative: the
// point of `compact` is that it is SHORTER, and a test that only checked it
// renders `section-sm` would still pass if the default ever moved down to
// meet it. Container queries only — two renders are two containers, and a
// `screen` query by role would match both.
describe("PageHero — density", () => {
  it("has two vertical densities, and changes only the height between them", () => {
    const tall = render(<PageHero title="About MBX" lead="Who we are." />).container;
    const thin = render(<PageHero size="compact" title="About MBX" lead="Who we are." />).container;

    const band = (c: HTMLElement) => c.querySelector("[data-slot=page-hero]")?.className ?? "";
    expect(band(tall)).toContain("section-lg");
    expect(band(thin)).toContain("section-sm");
    expect(band(thin)).not.toContain("section-lg");

    // ADR-072: a band that is too tall gets its SPACING fixed, never a
    // private font size. Both densities keep the same headline step.
    for (const container of [tall, thin]) {
      expect(container.querySelector("h1")?.className).toContain("text-display-md");
    }
  });
});
