// Guard for ADR-068 §7 — the inverse of `quiz-card.test.tsx`.
//
// That file asserts the quiz card IS one stretched link. This one asserts the
// video card is NOT, and the distinction is the whole reason both exist.
//
// A video card carries a play affordance over its thumbnail. Playing is not
// navigating, so it is a second target with its own destination. Add a
// stretched `::after` here and one of two things happens, neither visible in a
// type or a lint error: the play control sits under the overlay and is dead to
// a pointer while still being focusable, or it punches a hole in the overlay
// and the card silently stops being one link.
//
// So: no overlay anywhere, two controls, each with its own name.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VideoCard } from "./video-card.tsx";

afterEach(cleanup);

const LABELS = {
  play: "Watch",
  noArtwork: "Video artwork",
  readGuide: "Guide",
} as const;

function renderCard(overrides: Partial<React.ComponentProps<typeof VideoCard>> = {}) {
  return render(
    <VideoCard
      href="/learn/forex/videos/candlesticks"
      watchHref="/learn/forex/videos/candlesticks#watch"
      title="Reading candlesticks"
      description="What the body and the wicks actually tell you."
      videoCountLabel="2 videos"
      labels={LABELS}
      {...overrides}
    />,
  );
}

describe("VideoCard — deliberately not a stretched link (ADR-068 §7)", () => {
  it("paints no stretched overlay anywhere in the card", () => {
    const { container } = renderCard();
    // The exact pair `quiz-card.test.tsx` requires, asserted absent here.
    // Scanned across every element rather than just the title, because the
    // failure this guards against is someone adding the overlay to the
    // wrapper or the thumbnail instead.
    const overlaid = container.querySelectorAll('[class*="after:inset-0"]');
    expect(overlaid).toHaveLength(0);
  });

  it("does not wrap the card in an anchor", () => {
    const { container } = renderCard();
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.closest("a")).toBeNull();
  });

  it("exposes BOTH controls, each with its own accessible name", () => {
    renderCard();

    const title = screen.getByRole("link", { name: "Reading candlesticks" });
    expect(title.getAttribute("href")).toBe("/learn/forex/videos/candlesticks");

    const play = screen.getByRole("link", { name: "Watch" });
    expect(play.getAttribute("href")).toBe("/learn/forex/videos/candlesticks#watch");

    // Two, not one and not three: the count is the assertion. A third link
    // here would mean something else became a destination.
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("keeps neither control nested inside the other", () => {
    // Nested anchors are invalid and the browser un-nests them — which would
    // silently turn the play control into part of the title's hit area, the
    // exact merge this design refuses.
    renderCard();
    const title = screen.getByRole("link", { name: "Reading candlesticks" });
    const play = screen.getByRole("link", { name: "Watch" });
    expect(title.contains(play)).toBe(false);
    expect(play.contains(title)).toBe(false);
  });
});

describe("VideoCard — a topic with no video", () => {
  it("renders no play control at all rather than one that cannot deliver", () => {
    renderCard({ watchHref: null, videoCountLabel: null });
    expect(screen.queryByRole("link", { name: "Watch" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("says it is a written guide instead of showing a zero count", () => {
    renderCard({ watchHref: null, videoCountLabel: null });
    // "0 videos" invites the reader to wonder what broke; the topic is a
    // legitimate written guide (the contract's capability rule allows a body
    // instead of a video), so the card says so.
    expect(screen.getByText("Guide")).not.toBeNull();
    expect(screen.queryByText(/0 videos/)).toBeNull();
  });
});

describe("VideoCard — states a reader scans for", () => {
  it("colours the category chip with the tone the caller chose", () => {
    renderCard({ categoryLabel: "Getting started", categoryTone: "info" });
    const chip = screen.getByText("Getting started").className;
    expect(chip).toContain("bg-info/10");
    expect(chip).toContain("text-info-interactive");
  });

  it("falls back to the no-artwork state when a cover has no renderer", () => {
    // The renderer is the only path to an image (architecture.md #10) — a
    // silent <img> fallback here would opt every panel out of next/image.
    renderCard({ coverUrl: "/learn/video-panel.svg" });
    expect(screen.getByRole("img", { name: "Video artwork" })).not.toBeNull();
  });

  it("marks the cards the active category produced", () => {
    const { container } = renderCard({ highlighted: true });
    expect(container.querySelector("article")?.className).toContain("ring-primary/40");
  });

  it("positions the play glyph with a logical inset so RTL needs no rule", () => {
    const { container } = renderCard();
    // `ms-0.5`, never `ml-0.5` — code-style #3 is lint-enforced in the app,
    // and this asserts the same rule holds inside the design system.
    const glyph = container.querySelector(".ms-0\\.5");
    expect(glyph).not.toBeNull();
    expect(container.querySelector('[class*="ml-"]')).toBeNull();
  });
});
