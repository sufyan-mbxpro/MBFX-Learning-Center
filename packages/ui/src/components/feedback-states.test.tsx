// changes-21 Phase A — the one loader system. Every assertion is a behaviour
// or class the system promises; a regression back to a greyed-out button with
// no spinner, a bronze-on-bronze mark, a skeleton that stopped matching its
// card, or forty announced boxes is invisible to typecheck.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./button.tsx";
import { CourseCardSkeleton } from "./course-card.tsx";
import { EmptyState, ErrorState } from "./empty.tsx";
import { PageLoader } from "./page-loader.tsx";
import { DashboardSkeleton, TablePageSkeleton } from "./page-skeletons.tsx";
import { QuizCardSkeleton } from "./quiz-card.tsx";
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonText } from "./skeleton.tsx";
import { Spinner } from "./spinner.tsx";
import { VideoCardSkeleton } from "./video-card.tsx";

afterEach(cleanup);

const tokens = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);
const isDisabled = (el: Element) =>
  el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

describe("Button `loading`", () => {
  it("disables, marks busy, keeps its label and leads with the spinner", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(isDisabled(button)).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    const spinner = button.querySelector('[data-slot="spinner"]');
    expect(button.firstElementChild).toBe(spinner);
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
  });

  it("sizes the spinner by the button's own icon rule and inks it with the label", () => {
    // `inherit` emits no size class, so `[&_svg:not([class*='size-'])]` sizes
    // it; `current` keeps it visible on a primary fill (bronze on bronze).
    render(<Button loading>Save</Button>);
    const spinner = screen.getByRole("button").querySelector('[data-slot="spinner"]');
    expect(tokens(spinner).some((t) => t.startsWith("size-"))).toBe(false);
    expect(spinner?.getAttribute("data-tone")).toBe("current");
  });

  it("hides the button's own icon for the duration", () => {
    render(
      <Button loading>
        <svg data-testid="icon" />
        Save
      </Button>,
    );
    expect(tokens(screen.getByRole("button"))).toContain("[&>svg:not([data-slot=spinner])]:hidden");
  });

  it("is untouched when not loading", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
    expect(isDisabled(button)).toBe(false);
  });

  it("keeps honouring `disabled` for non-pending reasons", () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole("button");
    expect(isDisabled(button)).toBe(true);
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
  });
});

describe("Spinner", () => {
  it.each([
    ["xs", "size-3"],
    ["sm", "size-3.5"],
    ["default", "size-4"],
    ["lg", "size-5"],
    ["section", "size-10"],
    ["page", "size-16"],
    ["overlay", "size-20"],
  ] as const)("size %s is %s", (size, expected) => {
    const { container } = render(<Spinner size={size} />);
    expect(tokens(container.querySelector("svg"))).toContain(expected);
  });

  it("is the brand mark by default and follows the text in `current` tone", () => {
    const { container, rerender } = render(<Spinner />);
    expect(tokens(container.querySelector("svg > g"))).toContain("fill-primary");
    rerender(<Spinner tone="current" />);
    expect(tokens(container.querySelector("svg > g"))).toContain("fill-current");
  });

  it("announces only when labelled", () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    rerender(<Spinner aria-label="Loading" />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });
});

describe("Skeleton primitives", () => {
  it("every skeleton pulses AND sweeps — one look app-wide", () => {
    const { container } = render(<Skeleton />);
    const t = tokens(container.firstElementChild);
    expect(t).toEqual(expect.arrayContaining(["shimmer", "animate-pulse", "bg-muted"]));
  });

  it("text ends on a short line, the way a paragraph does", () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.firstElementChild?.children ?? [];
    expect(lines).toHaveLength(3);
    expect(tokens(lines[2] ?? null)).toContain("w-3/5");
  });

  it("a card is Card's shell (ADR-075), with a flush cover when it has media", () => {
    const { container } = render(<SkeletonCard media="video" />);
    const root = container.firstElementChild;
    expect(tokens(root)).toEqual(
      expect.arrayContaining(["rounded-lg", "border", "bg-card", "shadow-sm", "pt-0"]),
    );
    expect(tokens(root?.firstElementChild ?? null)).toContain("aspect-video");
  });

  it("a table is DataTable's block: 48px muted header, rows, pager footer", () => {
    const { container } = render(<SkeletonTable rows={4} columns={3} />);
    const root = container.firstElementChild;
    expect(tokens(root)).toEqual(expect.arrayContaining(["rounded-md", "border"]));
    expect(tokens(root?.children[0] ?? null)).toEqual(
      expect.arrayContaining(["h-12", "bg-muted/50"]),
    );
    expect(root?.querySelectorAll('[data-slot="skeleton-table-row"]')).toHaveLength(4);
    expect(tokens(root?.lastElementChild ?? null)).toEqual(
      expect.arrayContaining(["border-t", "px-4", "py-3"]),
    );
  });

  it("a table without a footer ends on its last row", () => {
    const { container } = render(<SkeletonTable rows={2} footer={false} />);
    expect(container.firstElementChild?.lastElementChild?.getAttribute("data-slot")).toBe(
      "skeleton-table-row",
    );
  });
});

describe("Page skeletons announce once or not at all", () => {
  it("with a label: one status region carrying the text", () => {
    render(<TablePageSkeleton label="Loading" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toBe("Loading");
  });

  it("without one: the whole tree is hidden", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("the page loader without a label is a decorative mark with no text", () => {
    const { container } = render(<PageLoader />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });

  it("the page loader with a label is a status region", () => {
    render(<PageLoader label="Loading" />);
    expect(screen.getByRole("status").textContent).toBe("Loading");
  });
});

describe("Card skeletons sit beside their cards", () => {
  it.each([
    ["CourseCardSkeleton", CourseCardSkeleton],
    ["QuizCardSkeleton", QuizCardSkeleton],
    ["VideoCardSkeleton", VideoCardSkeleton],
  ] as const)("%s is hidden and wears the card's own shell", (_, Component) => {
    const { container } = render(<Component />);
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(tokens(root)).toEqual(
      expect.arrayContaining(["rounded-2xl", "bg-card", "ring-1", "ring-foreground/10"]),
    );
  });
});

describe("EmptyState / ErrorState", () => {
  it("empty: neutral tile, title, description, action", () => {
    render(
      <EmptyState
        icon={<svg />}
        title="Nothing here"
        description="Create one"
        action={<button type="button">Create</button>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Create one")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("error: an alert with the destructive tonal tile (ADR-073) and a default icon", () => {
    const { container } = render(<ErrorState title="Failed" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    const media = container.querySelector('[data-slot="empty-media"]');
    expect(tokens(media)).toEqual(
      expect.arrayContaining(["bg-destructive/10", "text-destructive-interactive"]),
    );
    expect(media?.querySelector("svg")).not.toBeNull();
  });

  it("a route-level state is the page's h1 and drops the dashed border", () => {
    const { container } = render(<EmptyState size="lg" titleAs="h1" title="Page not found" />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(tokens(container.firstElementChild)).toContain("border-none");
  });
});
