// changes-20 Phase 3, group 2 — the overlays match capture 2 (ADR-074,
// docs/design-system/tokens.md §6.14). Each overlay is rendered OPEN, because
// its anatomy only exists in the DOM while open; a regression back to the
// base-nova ring-drawn, 16px-padded cards is invisible to typecheck.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./alert.tsx";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog.tsx";
import {
  Command,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet.tsx";
import { Toaster } from "./sonner.tsx";

afterEach(cleanup);

const tokens = (el: Element | null | undefined) => (el?.getAttribute("class") ?? "").split(/\s+/);
const slot = (name: string) => document.querySelector(`[data-slot=${name}]`);

describe("the scrim (ADR-074)", () => {
  it("--color-overlay is the reference's black/80", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");
    expect(/--color-overlay:\s*([^;]+);/.exec(css)?.[1]?.trim()).toBe("rgb(0 0 0 / 0.8)");
  });
});

describe("Dialog", () => {
  it("is a 512px bordered card on the page background, p-6, shadow-lg, over the scrim", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Close">
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <DialogFooter>ok</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(tokens(slot("dialog-content"))).toEqual(
      expect.arrayContaining([
        "max-w-lg",
        "p-6",
        "border",
        "bg-background",
        "shadow-lg",
        "sm:rounded-lg",
        "gap-4",
      ]),
    );
    expect(tokens(slot("dialog-overlay"))).toContain("bg-overlay");
    expect(tokens(screen.getByText("Title"))).toEqual(
      expect.arrayContaining(["text-lg", "font-semibold", "tracking-tight"]),
    );
    expect(tokens(slot("dialog-header"))).toEqual(
      expect.arrayContaining(["text-center", "sm:text-start"]),
    );
    expect(tokens(slot("dialog-footer"))).toEqual(
      expect.arrayContaining(["flex-col-reverse", "sm:flex-row", "sm:justify-end"]),
    );
  });

  it("closes from the reference's bare corner glyph, not a ghost button, at a logical corner", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Dismiss">
          <DialogTitle>T</DialogTitle>
          <DialogDescription>D</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByRole("button", { name: "Dismiss" });
    expect(tokens(close)).toEqual(expect.arrayContaining(["top-4", "end-4", "opacity-70"]));
    expect(close.getAttribute("data-slot")).toBe("dialog-close");
  });
});

describe("AlertDialog", () => {
  it("shares the Dialog card and has no corner close — a confirmation must be answered", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
            <AlertDialogDescription>Gone for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>x</AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(tokens(slot("alert-dialog-content"))).toEqual(
      expect.arrayContaining(["max-w-lg", "p-6", "border", "bg-background", "shadow-lg"]),
    );
    expect(tokens(screen.getByText("Delete?"))).toEqual(
      expect.arrayContaining(["text-lg", "font-semibold"]),
    );
    expect(document.querySelector("[data-slot=dialog-close]")).toBeNull();
  });
});

describe("Sheet", () => {
  it.each([
    ["start", "border-e"],
    ["end", "border-s"],
  ] as const)("side %s: 3/4 width capped at sm:max-w-sm, logical edge %s, p-6", (side, edge) => {
    render(
      <Sheet open>
        <SheetContent side={side} closeLabel="Close">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Nav</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(tokens(slot("sheet-content"))).toEqual(
      expect.arrayContaining(["w-3/4", "sm:max-w-sm", edge, "p-6", "bg-background", "shadow-lg"]),
    );
    expect(tokens(screen.getByText("Menu"))).toEqual(
      expect.arrayContaining(["text-lg", "font-semibold"]),
    );
  });
});

describe("DropdownMenu", () => {
  it("bordered card; rounded-sm items at px-2 py-1.5; semibold label; muted separator", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Base UI requires a menu label inside a group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Pinned</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(tokens(slot("dropdown-menu-content"))).toEqual(
      expect.arrayContaining(["rounded-md", "border", "bg-popover", "p-1", "shadow-md"]),
    );
    expect(tokens(screen.getByText("Profile"))).toEqual(
      expect.arrayContaining(["rounded-sm", "px-2", "py-1.5", "text-sm", "focus:bg-accent"]),
    );
    expect(tokens(screen.getByText("Account"))).toEqual(
      expect.arrayContaining(["px-2", "py-1.5", "text-sm", "font-semibold"]),
    );
    expect(tokens(slot("dropdown-menu-separator"))).toContain("bg-muted");
    expect(tokens(slot("dropdown-menu-checkbox-item-indicator"))).toContain("start-2");
  });

  it("a destructive item uses the tint-safe ink, never the raw red", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const t = tokens(screen.getByText("Delete"));
    expect(t).toContain("data-[variant=destructive]:text-destructive-interactive");
    expect(t).not.toContain("data-[variant=destructive]:text-destructive");
  });
});

describe("Popover", () => {
  it("is a 288px bordered card, p-4, shadow-md", () => {
    render(
      <Popover open>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>,
    );
    expect(tokens(screen.getByText("Body"))).toEqual(
      expect.arrayContaining(["w-72", "rounded-md", "border", "bg-popover", "p-4", "shadow-md"]),
    );
  });
});

describe("Command", () => {
  it("border-b search row with a half-opacity glyph, h-11 input, accent-highlighted rounded-sm items", () => {
    render(
      <Command items={["Users"]}>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandGroup>
            <CommandGroupLabel>Pages</CommandGroupLabel>
            <CommandItem value="Users">Users</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    const wrapper = slot("command-input-wrapper");
    expect(tokens(wrapper)).toEqual(expect.arrayContaining(["border-b", "px-3"]));
    expect(tokens(wrapper?.querySelector("svg"))).toEqual(
      expect.arrayContaining(["me-2", "opacity-50"]),
    );
    expect(tokens(screen.getByPlaceholderText("Search"))).toContain("h-11");
    expect(tokens(slot("command-list"))).toContain("max-h-75");
    expect(tokens(screen.getByText("Users").closest("[data-slot=command-item]"))).toEqual(
      expect.arrayContaining(["rounded-sm", "px-2", "py-1.5", "data-highlighted:bg-accent"]),
    );
  });
});

describe("Alert", () => {
  it("destructive text is --destructive-interactive (ADR-074 §3), laid out without arbitrary tracks", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Save refused</AlertTitle>
        <AlertDescription>Try again.</AlertDescription>
      </Alert>,
    );
    const t = tokens(screen.getByRole("alert"));
    expect(t).toEqual(
      expect.arrayContaining(["rounded-lg", "border", "p-4", "text-destructive-interactive"]),
    );
    expect(t).not.toContain("text-destructive");
    expect(t.some((c) => /grid-cols-\[/.test(c))).toBe(false);
  });
});

describe("Toast (Sonner)", () => {
  // jsdom has no matchMedia; Sonner reads it for the system colour scheme.
  beforeAll(() => {
    if (!window.matchMedia) {
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList;
    }
  });

  it("renders the reference's card: page background, border, shadow-lg, semibold title, muted description", async () => {
    render(<Toaster />);
    await act(async () => {
      toast("Saved", { description: "Your changes are live." });
      await new Promise((r) => setTimeout(r, 50));
    });
    const title = await screen.findByText("Saved");
    const card = title.closest("[data-sonner-toast]");
    expect(tokens(card)).toEqual(expect.arrayContaining(["border-border", "shadow-lg"]));
    expect(tokens(title)).toEqual(expect.arrayContaining(["text-sm", "font-semibold"]));
    expect(tokens(screen.getByText("Your changes are live."))).toContain("text-muted-foreground");
    const toaster = document.querySelector("[data-sonner-toaster]") as HTMLElement | null;
    expect(toaster?.getAttribute("data-x-position")).toBe("right");
    expect(toaster?.getAttribute("data-y-position")).toBe("bottom");
    expect(toaster?.style.getPropertyValue("--normal-bg")).toBe("var(--background)");
  });
});
