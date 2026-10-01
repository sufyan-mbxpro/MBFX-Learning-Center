// Guards for the promotion card (ADR-167, changes-52).
//
// The card is shared by the popup, the home band and the admin preview, so
// what it promises has to hold in all three:
//
//   1. It carries the language of its WORDS. A promotion falling back to
//      English on an Arabic page must say `lang="en"`, or a screen reader
//      reads English with Arabic phonetics.
//   2. The picture is a slot. No `<img>` of its own — @repo/ui does not know
//      next/image, and a bare fallback would opt every promotion out of it.
//   3. An empty part leaves no empty box behind (no stray gap or border).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PromoCard } from "./promo-card.tsx";

afterEach(cleanup);

describe("PromoCard", () => {
  it("renders the kind, the label, the title, the body and the actions", () => {
    render(
      <PromoCard
        badge="Webinar"
        badgeTone="info"
        tag="Ends Friday"
        title="Trading the London open"
        body={<p>Join us live.</p>}
        meta={<span>Tue 6 Oct, 15:00</span>}
        actions={<button type="button">Register now</button>}
      />,
    );
    expect(screen.getByText("Webinar")).toBeTruthy();
    expect(screen.getByText("Ends Friday")).toBeTruthy();
    expect(screen.getByText("Trading the London open")).toBeTruthy();
    expect(screen.getByText("Join us live.")).toBeTruthy();
    expect(screen.getByText("Tue 6 Oct, 15:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Register now" })).toBeTruthy();
  });

  it("marks the language of its words when given one", () => {
    const { container } = render(<PromoCard title="Autumn offer" lang="en" />);
    expect(container.querySelector("article")?.getAttribute("lang")).toBe("en");
  });

  it("renders no picture of its own, only the slot it is given", () => {
    const { container, rerender } = render(<PromoCard title="No picture" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="promo-card-media"]')).toBeNull();

    rerender(<PromoCard title="With picture" media={<span data-testid="slot" />} />);
    expect(container.querySelector('[data-slot="promo-card-media"]')).not.toBeNull();
    expect(screen.getByTestId("slot")).toBeTruthy();
  });

  it("leaves out every part it was not given", () => {
    const { container } = render(<PromoCard title="Only a title" />);
    expect(container.querySelector('[data-slot="promo-card-meta"]')).toBeNull();
    expect(container.querySelector('[data-slot="promo-card-actions"]')).toBeNull();
    // The title is the ONLY text, so no empty badge row or body survived.
    expect(container.textContent).toBe("Only a title");
  });

  it("frames itself as a card only in the card layout", () => {
    const { container, rerender } = render(<PromoCard title="x" layout="card" />);
    expect(container.querySelector("article")?.className).toContain("border");
    rerender(<PromoCard title="x" layout="dialog" />);
    expect(container.querySelector("article")?.className).not.toContain("border");
  });

  it("lets only the picture shrink in a dialog, so the words and buttons fit the screen", () => {
    const { container } = render(
      <PromoCard title="x" layout="dialog" media={<span />} actions={<button>Go</button>} />,
    );
    const article = container.querySelector("article");
    // Not clipped: an overlong promotion scrolls rather than hiding its buttons.
    expect(article?.className).toContain("min-h-0");
    expect(article?.className).not.toContain("overflow-hidden");
    expect(container.querySelector('[data-slot="promo-card-media"]')?.className).toContain(
      "min-h-28",
    );
  });
});
