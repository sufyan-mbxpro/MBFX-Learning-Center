// changes-20 Phase 3, group 1 — the primitives match the reference anatomy
// in docs/design-system/tokens.md §6 (ADR-072). Every assertion here is a
// class the spec names; a regression that shrinks a control back to the old
// base-nova 32px, or reintroduces a raw-hue ink, is invisible to typecheck.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar, AvatarFallback } from "./avatar.tsx";
import { Badge } from "./badge.tsx";
import { Button } from "./button.tsx";
import { CountBadge } from "./count-badge.tsx";
import { Input } from "./input.tsx";
import { SearchInput } from "./search-input.tsx";
import { Checkbox } from "./checkbox.tsx";
import { RadioGroup, RadioGroupItem } from "./radio-group.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
} from "./select.tsx";
import { Switch } from "./switch.tsx";
import { Textarea } from "./textarea.tsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.tsx";

afterEach(cleanup);

const cls = (el: Element | null) => el?.getAttribute("class") ?? "";
const tokens = (el: Element | null) => cls(el).split(/\s+/);

describe("Button (tokens.md §6.1)", () => {
  it.each([
    ["default", "h-10"],
    ["sm", "h-9"],
    ["xs", "h-8"],
    ["2xs", "h-7"],
    ["lg", "h-11"],
    ["xl", "h-12"],
    ["icon", "size-10"],
    ["icon-sm", "size-9"],
    ["icon-xs", "size-8"],
    ["icon-2xs", "size-6"],
  ] as const)("size %s is %s", (size, expected) => {
    render(<Button size={size}>x</Button>);
    expect(tokens(screen.getByRole("button"))).toContain(expected);
  });

  it("uses the md radius and the reference's 2px offset focus ring", () => {
    render(<Button>x</Button>);
    const t = tokens(screen.getByRole("button"));
    expect(t).toContain("rounded-md");
    expect(t).toContain("focus-visible:ring-2");
    expect(t).toContain("focus-visible:ring-offset-2");
    expect(t).not.toContain("focus-visible:ring-3");
  });

  it("primary hover is the engine-derived --primary-hover (ADR-003), not an opacity", () => {
    render(<Button>x</Button>);
    expect(tokens(screen.getByRole("button"))).toContain("hover:bg-primary-hover");
  });

  it.each(["outline", "ghost"] as const)("%s hovers to the warm --accent", (variant) => {
    render(<Button variant={variant}>x</Button>);
    const t = tokens(screen.getByRole("button"));
    expect(t).toContain("hover:bg-accent");
    expect(t).toContain("hover:text-accent-foreground");
  });

  it("link text is --primary-interactive, never raw --primary (ADR-018 rule 5)", () => {
    render(<Button variant="link">x</Button>);
    const t = tokens(screen.getByRole("button"));
    expect(t).toContain("text-primary-interactive");
    expect(t).not.toContain("text-primary");
  });

  it("`emphasis` adds the sign-in submit's shadow and primary ring", () => {
    render(<Button emphasis>x</Button>);
    const t = tokens(screen.getByRole("button"));
    expect(t).toContain("shadow-md");
    expect(t).toContain("ring-primary/40");
  });
});

describe("Input and SearchInput (tokens.md §6.2)", () => {
  it.each([
    ["default", "h-10"],
    ["sm", "h-9"],
    ["xs", "h-8"],
  ] as const)("Input size %s is %s", (size, expected) => {
    render(<Input size={size} aria-label="f" />);
    expect(tokens(screen.getByLabelText("f"))).toContain(expected);
  });

  it("Input sits on the page background with the --input border and md radius", () => {
    render(<Input aria-label="f" />);
    const t = tokens(screen.getByLabelText("f"));
    expect(t).toEqual(expect.arrayContaining(["border-input", "bg-background", "rounded-md"]));
    // iOS zooms a focused field under 16px, so mobile text is base.
    expect(t).toEqual(expect.arrayContaining(["text-base", "md:text-sm"]));
  });

  it.each([
    ["default", "start-3", "ps-10"],
    ["sm", "start-2.5", "ps-8"],
    ["xs", "start-2", "ps-7"],
  ] as const)(
    "SearchInput %s pairs its glyph inset (%s) with its padding (%s)",
    (size, inset, pad) => {
      const { container } = render(<SearchInput size={size} aria-label="Search" />);
      const icon = container.querySelector("svg");
      expect(tokens(icon)).toContain(inset);
      expect(tokens(screen.getByLabelText("Search"))).toContain(pad);
    },
  );

  it("SearchInput's glyph is decorative and logical, and the field is type=search", () => {
    const { container } = render(<SearchInput aria-label="Search" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(cls(container.querySelector("svg"))).not.toMatch(/(?:^|\s)(left|right)-/);
    expect(screen.getByLabelText("Search").getAttribute("type")).toBe("search");
  });

  it("SearchInput sizes its wrapper, not the input, from wrapperClassName", () => {
    const { container } = render(<SearchInput aria-label="Search" wrapperClassName="min-w-60" />);
    expect(tokens(container.firstElementChild)).toContain("min-w-60");
  });
});

describe("Select trigger (tokens.md §6.3)", () => {
  const trigger = (size?: "default" | "sm" | "xs") => (
    <Select>
      <SelectTrigger size={size} aria-label="Filter">
        <SelectValue placeholder="All" />
      </SelectTrigger>
    </Select>
  );

  it.each([
    [undefined, ["h-10", "text-sm"]],
    ["sm", ["h-9", "text-xs"]],
    ["xs", ["h-8", "text-xs"]],
  ] as const)("size %s", (size, expected) => {
    render(trigger(size));
    expect(tokens(screen.getByRole("combobox"))).toEqual(expect.arrayContaining([...expected]));
  });

  it("is the Input's box: md radius, --input border, page background", () => {
    render(trigger());
    expect(tokens(screen.getByRole("combobox"))).toEqual(
      expect.arrayContaining([
        "rounded-md",
        "border-input",
        "bg-background",
        "focus-visible:ring-2",
      ]),
    );
  });

  it("indicates a plain Select with chevron-down at half opacity", () => {
    render(trigger());
    const icon = screen.getByRole("combobox").querySelector("svg.lucide-chevron-down");
    expect(tokens(icon)).toContain("opacity-50");
  });

  it("exports the recipe the searchable Combobox trigger shares", () => {
    expect(selectTriggerVariants({ size: "sm" })).toContain("h-9");
  });
});

describe("Badge and CountBadge (tokens.md §6.6)", () => {
  it.each([
    ["default", ["px-2.5", "py-0.5", "text-xs"]],
    ["sm", ["h-5", "text-3xs"]],
    ["xs", ["h-4", "text-3xs"]],
  ] as const)("size %s", (size, expected) => {
    render(<Badge size={size}>B</Badge>);
    expect(tokens(screen.getByText("B"))).toEqual(expect.arrayContaining([...expected]));
  });

  it.each([
    ["success", "success", "success"],
    ["warning", "warning", "warning"],
    ["info", "info", "info"],
    ["danger", "destructive", "destructive"],
  ] as const)(
    "tonal %s: /10 tint with the tint-safe *-interactive ink (ADR-073)",
    (variant, hue, ink) => {
      render(<Badge variant={variant}>B</Badge>);
      const t = tokens(screen.getByText("B"));
      expect(t).toContain(`bg-${hue}/10`);
      expect(t).toContain(`text-${ink}-interactive`);
      expect(t).not.toContain(`text-${hue}`);
    },
  );

  it("outlined status draws its line in the *-interactive value — raw warning is 2:1 as a border", () => {
    render(<Badge variant="outline-warning">B</Badge>);
    const t = tokens(screen.getByText("B"));
    expect(t).toContain("border-warning-interactive");
    expect(t).not.toContain("border-warning");
  });

  it("destructive is the solid alert pill; the tonal status is `danger`", () => {
    render(<Badge variant="destructive">B</Badge>);
    expect(tokens(screen.getByText("B"))).toContain("bg-destructive");
  });

  it("`live` renders a decorative pulsing dot in the badge's own ink", () => {
    const { container } = render(
      <Badge variant="outline-success" live>
        Live
      </Badge>,
    );
    const dot = container.querySelector("[data-slot=badge-live-dot]");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(tokens(dot)).toEqual(expect.arrayContaining(["animate-pulse", "bg-current"]));
  });

  it("CountBadge caps at `max`, hides at zero, and floats on a logical corner", () => {
    const { rerender, container } = render(<CountBadge count={120} />);
    expect(container.textContent).toBe("99+");
    rerender(<CountBadge count={1200} max={999} placement="corner" />);
    expect(container.textContent).toBe("999+");
    expect(tokens(container.firstElementChild)).toContain("-end-1.5");
    rerender(<CountBadge count={0} />);
    expect(container.firstElementChild).toBeNull();
  });
});

// Capture 2 (ADR-074, tokens.md §6.14). The form controls carry the
// accessible deviation the ADR records: their boundary and checked track are
// --primary-interactive, because raw bronze on white is 2.9:1 — under the
// 3:1 WCAG 1.4.11 asks of a control's edge.
describe("Form controls (tokens.md §6.14)", () => {
  it("Checkbox: a 16px rounded-sm box on the derived bronze line, brand fill when checked", () => {
    render(<Checkbox aria-label="c" defaultChecked />);
    const t = tokens(screen.getByRole("checkbox"));
    expect(t).toEqual(
      expect.arrayContaining([
        "size-4",
        "rounded-sm",
        "border-primary-interactive",
        "data-checked:bg-primary",
        "data-checked:text-primary-foreground",
      ]),
    );
    expect(t).not.toContain("border-primary");
  });

  it("RadioGroup: 16px ring and dot on --primary-interactive", () => {
    render(
      <RadioGroup aria-label="r" defaultValue="a">
        <RadioGroupItem value="a" aria-label="a" />
      </RadioGroup>,
    );
    const t = tokens(screen.getByRole("radio"));
    expect(t).toEqual(
      expect.arrayContaining([
        "size-4",
        "rounded-full",
        "border-primary-interactive",
        "text-primary-interactive",
      ]),
    );
  });

  it("Switch: 44x24 track, --input when off, --primary-interactive when on, mirrored in RTL", () => {
    const { container } = render(<Switch aria-label="s" />);
    const t = tokens(screen.getByRole("switch"));
    expect(t).toEqual(
      expect.arrayContaining([
        "h-6",
        "w-11",
        "data-unchecked:bg-input",
        "data-checked:bg-primary-interactive",
      ]),
    );
    const thumb = container.querySelector("[data-slot=switch-thumb]");
    expect(tokens(thumb)).toEqual(
      expect.arrayContaining([
        "size-5",
        "data-checked:translate-x-5",
        "rtl:data-checked:-translate-x-5",
      ]),
    );
  });

  it("Textarea wears the Input's box at an 80px minimum", () => {
    render(<Textarea aria-label="t" />);
    const t = tokens(screen.getByLabelText("t"));
    expect(t).toEqual(
      expect.arrayContaining([
        "min-h-20",
        "rounded-md",
        "border-input",
        "bg-background",
        "focus-visible:ring-2",
      ]),
    );
  });

  it("Tooltip: bordered popover card, 14px, and a 10px `sm` for chart tooltips", () => {
    const { unmount } = render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const t = tokens(screen.getByText("Tip"));
    expect(t).toEqual(
      expect.arrayContaining([
        "rounded-md",
        "border",
        "bg-popover",
        "px-3",
        "py-1.5",
        "text-sm",
        "shadow-md",
      ]),
    );
    unmount();
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent size="sm">Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(tokens(screen.getByText("Tip"))).toContain("text-3xs");
  });

  it("Select items put the check indicator at the START, like the reference", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="pick">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );
    const item = screen.getByRole("option", { name: "Alpha" });
    expect(tokens(item)).toEqual(expect.arrayContaining(["ps-8", "pe-2", "rounded-sm", "py-1.5"]));
    const indicator = item.querySelector("span.absolute");
    expect(tokens(indicator)).toContain("start-2");
  });
});

describe("Avatar (tokens.md §6.7)", () => {
  it.each([
    ["default", "size-10"],
    ["sm", "data-[size=sm]:size-8"],
    ["lg", "data-[size=lg]:size-12"],
  ] as const)("size %s renders via %s", (size, expected) => {
    const { container } = render(
      <Avatar size={size}>
        <AvatarFallback>SA</AvatarFallback>
      </Avatar>,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute("data-size")).toBe(size);
    expect(tokens(root)).toContain(expected);
  });

  it("initials sit on the brand fill with its engine-derived ink", () => {
    render(
      <Avatar>
        <AvatarFallback>SA</AvatarFallback>
      </Avatar>,
    );
    const t = tokens(screen.getByText("SA"));
    expect(t).toEqual(expect.arrayContaining(["bg-primary", "text-primary-foreground"]));
  });

  it("shape=square is the reference's rounded-xl identity tile", () => {
    const { container } = render(
      <Avatar shape="square">
        <AvatarFallback>SA</AvatarFallback>
      </Avatar>,
    );
    expect(container.firstElementChild?.getAttribute("data-shape")).toBe("square");
  });
});
