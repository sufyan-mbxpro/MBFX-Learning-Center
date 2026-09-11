// ADR-057 — the searchable-dropdown contract, in the package that owns it.
//
// Three properties are load-bearing and all three are silent when they
// break: the threshold picking the right PRIMITIVE (a Combobox rendering no
// input would be an a11y regression, a Select over forty rows the bug that
// started this), the full-width trigger, and search actually filtering.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox, SEARCHABLE_ITEM_THRESHOLD, type ComboboxOption } from "./combobox.tsx";

afterEach(cleanup);

const options = (count: number): ComboboxOption[] =>
  Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

const open = () => fireEvent.click(screen.getByRole("combobox"));

describe("Combobox — which primitive renders", () => {
  it(`renders a search input at the threshold (${SEARCHABLE_ITEM_THRESHOLD} options)`, () => {
    render(
      <Combobox
        options={options(SEARCHABLE_ITEM_THRESHOLD)}
        value=""
        onValueChange={vi.fn()}
        searchPlaceholder="Search options"
      />,
    );
    open();
    expect(screen.getByPlaceholderText("Search options")).toBeTruthy();
  });

  it("renders no search input one option below the threshold", () => {
    render(
      <Combobox
        options={options(SEARCHABLE_ITEM_THRESHOLD - 1)}
        value=""
        onValueChange={vi.fn()}
        searchPlaceholder="Search options"
      />,
    );
    open();
    expect(screen.queryByPlaceholderText("Search options")).toBeNull();
  });

  it("`searchable` overrides the threshold in both directions", () => {
    const { unmount } = render(
      <Combobox
        options={options(2)}
        value=""
        onValueChange={vi.fn()}
        searchable
        searchPlaceholder="Search options"
      />,
    );
    open();
    expect(screen.getByPlaceholderText("Search options")).toBeTruthy();
    unmount();

    render(
      <Combobox
        options={options(40)}
        value=""
        onValueChange={vi.fn()}
        searchable={false}
        searchPlaceholder="Search options"
      />,
    );
    open();
    expect(screen.queryByPlaceholderText("Search options")).toBeNull();
  });
});

describe("Combobox — the owner's two reports", () => {
  it("the trigger is full width on both branches", () => {
    const { unmount } = render(<Combobox options={options(3)} value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox").className).toContain("w-full");
    unmount();

    render(<Combobox options={options(20)} value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox").className).toContain("w-full");
  });

  it("a toolbar call site can still override the width", () => {
    // tailwind-merge has to resolve `w-full` vs `w-40` in the caller's
    // favour, otherwise every filter dropdown in a table toolbar stretches.
    render(<Combobox options={options(20)} value="" onValueChange={vi.fn()} className="w-40" />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("w-40");
    expect(trigger.className).not.toContain("w-full");
  });
});

// changes-20 / ADR-072 (tokens.md §6.3): both branches wear the shared
// selectTriggerVariants box, and the glyph tells a user which kind of
// dropdown they are looking at.
describe("Combobox — trigger anatomy (ADR-072)", () => {
  it.each([3, 12])("the %i-option branch shares the Input's 40px box", (n) => {
    render(<Combobox options={options(n)} value="" onValueChange={vi.fn()} />);
    const cls = screen.getByRole("combobox").className.split(/\s+/);
    expect(cls).toEqual(
      expect.arrayContaining(["h-10", "rounded-md", "border-input", "bg-background"]),
    );
  });

  it("a toolbar filter (size sm) is the reference's 36px, 12px-text row", () => {
    render(<Combobox options={options(12)} value="" onValueChange={vi.fn()} size="sm" />);
    const cls = screen.getByRole("combobox").className.split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(["h-9", "text-xs"]));
  });

  it("chevron-down for a Select, chevrons-up-down when searchable", () => {
    const { unmount } = render(<Combobox options={options(3)} value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox").querySelector("svg.lucide-chevron-down")).not.toBeNull();
    unmount();
    render(<Combobox options={options(12)} value="" onValueChange={vi.fn()} />);
    expect(
      screen.getByRole("combobox").querySelector("svg.lucide-chevrons-up-down"),
    ).not.toBeNull();
  });
});

describe("Combobox — behaviour", () => {
  it("filters the list by the typed query and reports the chosen value", () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        options={[
          { value: "eur", label: "Euro" },
          { value: "usd", label: "US Dollar" },
          { value: "gbp", label: "Pound Sterling" },
          ...options(10),
        ]}
        value=""
        onValueChange={onValueChange}
        searchPlaceholder="Search"
      />,
    );
    open();
    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "Dollar" } });
    expect(screen.queryByText("Euro")).toBeNull();

    fireEvent.click(screen.getByText("US Dollar"));
    expect(onValueChange).toHaveBeenCalledWith("usd");
  });

  it("shows the empty label when nothing matches", () => {
    render(
      <Combobox
        options={options(12)}
        value=""
        onValueChange={vi.fn()}
        searchPlaceholder="Search"
        emptyLabel="No matches"
      />,
    );
    open();
    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "zzzz" } });
    expect(screen.getByText("No matches")).toBeTruthy();
  });

  it("displays the selected option's label, and the placeholder when there is none", () => {
    const { unmount } = render(
      <Combobox options={options(3)} value="v1" onValueChange={vi.fn()} placeholder="Pick one" />,
    );
    expect(screen.getByRole("combobox").textContent).toContain("Option 1");
    unmount();

    render(
      <Combobox options={options(3)} value="" onValueChange={vi.fn()} placeholder="Pick one" />,
    );
    expect(screen.getByRole("combobox").textContent).toContain("Pick one");
  });

  it('carries an empty-string option as a real row — the "All"/"None" sentinel', () => {
    // Several toolbars model "no filter" as value="". If the component ever
    // treated "" as absent, those rows would stop being selectable.
    //
    // Asserted structurally on the plain branch and behaviourally on the
    // searchable one: Base UI's Select commits a choice on a pointer
    // sequence jsdom does not reproduce (a bare `click` on an item is a
    // no-op there, for any value — verified, not assumed), so the click
    // half of this contract is only reachable through the Combobox branch.
    const onValueChange = vi.fn();
    const { unmount } = render(
      <Combobox
        options={[{ value: "", label: "All tracks" }, ...options(2)]}
        value="v0"
        onValueChange={onValueChange}
      />,
    );
    open();
    expect(screen.getByText("All tracks")).toBeTruthy();
    unmount();

    render(
      <Combobox
        options={[{ value: "", label: "All tracks" }, ...options(10)]}
        value="v0"
        onValueChange={onValueChange}
      />,
    );
    open();
    fireEvent.click(screen.getByText("All tracks"));
    expect(onValueChange).toHaveBeenCalledWith("");
  });
});
