// changes-20 Phase 3, group 4 — layout: Card (ADR-075), the type roles, the
// page header, the metric card, breadcrumbs and the sidebar item
// (tokens.md §2.3, §6.11, §6.12, §6.14).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card.tsx";
import { CountBadge } from "./count-badge.tsx";
import { MetricCard } from "./metric-card.tsx";
import { NavItem, NavItemGroup } from "./nav-item.tsx";
import { PageHeader } from "./page-header.tsx";
import { Progress } from "./progress.tsx";
import {
  MetaText,
  MicroHeading,
  PageDescription,
  PageTitle,
  SectionTitle,
  SectionTitleCompact,
  StatLabel,
  StatValue,
  SubText,
} from "./typography.tsx";

afterEach(cleanup);

const tokens = (el: Element | null | undefined) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("Card (ADR-075)", () => {
  const renderCard = (size?: "default" | "sm") =>
    render(
      <Card size={size}>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>Pushed to every user</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
      </Card>,
    );

  it("is the reference's surface: rounded-lg, 1px border, shadow-sm — no ring", () => {
    const { container } = renderCard();
    const card = container.querySelector("[data-slot=card]");
    expect(tokens(card)).toEqual(
      expect.arrayContaining(["rounded-lg", "border", "bg-card", "shadow-sm"]),
    );
    expect(tokens(card).some((c) => c.startsWith("ring-"))).toBe(false);
  });

  it("runs a 24px rhythm (16px when size=sm) through one variable", () => {
    const { container } = renderCard();
    const card = container.querySelector("[data-slot=card]");
    expect(tokens(card)).toEqual(
      expect.arrayContaining([
        "[--card-spacing:--spacing(6)]",
        "data-[size=sm]:[--card-spacing:--spacing(4)]",
        "py-(--card-spacing)",
        "gap-(--card-spacing)",
      ]),
    );
  });

  it("has no header band (superseding ADR-050) and no footer band", () => {
    const { container } = renderCard();
    const header = container.querySelector("[data-slot=card-header]");
    expect(tokens(header).some((c) => /bg-muted|border-b/.test(c))).toBe(false);
  });

  it("titles at the reference's 24px semibold, stepping to 16px in a small card", () => {
    renderCard();
    expect(tokens(screen.getByText("Announcements"))).toEqual(
      expect.arrayContaining([
        "text-2xl",
        "font-semibold",
        "tracking-tight",
        "group-data-[size=sm]/card:text-base",
      ]),
    );
    expect(tokens(screen.getByText("Pushed to every user"))).toEqual(
      expect.arrayContaining(["text-sm", "text-muted-foreground"]),
    );
  });
});

describe("Type roles (tokens.md §2.3)", () => {
  it.each([
    [PageTitle, "H1", ["text-3xl", "font-bold", "tracking-tight"]],
    [PageDescription, "P", ["text-base", "text-muted-foreground"]],
    [SectionTitle, "H2", ["text-2xl", "font-semibold", "tracking-tight"]],
    [SectionTitleCompact, "H3", ["text-base", "font-bold"]],
    [SubText, "P", ["text-sm", "text-muted-foreground"]],
    [StatLabel, "H3", ["text-sm", "font-medium", "text-muted-foreground"]],
    [StatValue, "DIV", ["text-2xl", "font-bold", "tabular-nums"]],
    [MetaText, "P", ["text-xs", "text-muted-foreground"]],
    [MicroHeading, "SPAN", ["text-3xs", "font-semibold", "uppercase", "tracking-wider"]],
  ] as const)("role %#: default <%s> with its recipe", (Role, tag, expected) => {
    render(<Role>x</Role>);
    const el = screen.getByText("x");
    expect(el.tagName).toBe(tag);
    expect(tokens(el)).toEqual(expect.arrayContaining([...expected]));
  });

  it("`render` swaps the element without restyling it", () => {
    render(<SectionTitle render={<h3 />}>x</SectionTitle>);
    const el = screen.getByText("x");
    expect(el.tagName).toBe("H3");
    expect(tokens(el)).toContain("text-2xl");
  });
});

describe("PageHeader (tokens.md §6.12)", () => {
  it("title + description at the start, actions at the end, wrapping", () => {
    render(
      <PageHeader
        title="Users Directory"
        description="Every platform member"
        actions={<button type="button">New</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Users Directory" })).toBeTruthy();
    expect(screen.getByText("Every platform member").tagName).toBe("P");
    const root = document.querySelector("[data-slot=page-header]");
    expect(tokens(root)).toEqual(
      expect.arrayContaining(["flex", "flex-wrap", "items-start", "justify-between", "gap-3"]),
    );
    expect(document.querySelector("[data-slot=page-header-actions]")?.textContent).toBe("New");
  });

  it("an icon switches to the compact 24px title with a 14px description", () => {
    render(<PageHeader title="Announcements" description="Broadcasts" icon={<svg />} />);
    expect(tokens(screen.getByRole("heading", { level: 1 }))).toContain("text-2xl");
    expect(tokens(screen.getByText("Broadcasts"))).toContain("text-sm");
  });
});

describe("MetricCard (tokens.md §6.11)", () => {
  it("label + icon row, bold figure with unit, meta line, pinned footer", () => {
    render(
      <MetricCard
        label="Trading Volume"
        icon={<svg data-testid="icon" />}
        value="42.9K"
        unit="lots"
        meta="+26.3% vs previous period"
        footer={<Progress size="xs" value={60} />}
      />,
    );
    expect(tokens(screen.getByText("Trading Volume"))).toContain("text-muted-foreground");
    expect(screen.getByText("lots").closest("[data-slot=stat-value]")).not.toBeNull();
    expect(tokens(screen.getByText("+26.3% vs previous period"))).toContain("text-xs");
    expect(document.querySelector("[data-slot=progress]")?.getAttribute("data-size")).toBe("xs");
  });
});

describe("Progress", () => {
  it.each([
    ["xs", "h-1"],
    ["sm", "h-1.5"],
    ["default", "h-2"],
  ] as const)("size %s is a %s track on bg-muted", (size, height) => {
    render(<Progress size={size} value={40} />);
    const track = document.querySelector("[data-slot=progress-track]");
    expect(tokens(track)).toEqual(expect.arrayContaining([height, "bg-muted"]));
  });
});

describe("Breadcrumb (tokens.md §6.14)", () => {
  it("muted trail, RTL-mirrored chevron separator, current page in foreground", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Users</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(tokens(document.querySelector("[data-slot=breadcrumb-list]"))).toEqual(
      expect.arrayContaining(["text-sm", "text-muted-foreground", "gap-1.5", "sm:gap-2.5"]),
    );
    expect(tokens(document.querySelector("[data-slot=breadcrumb-separator]"))).toEqual(
      expect.arrayContaining(["[&>svg]:size-3.5", "rtl:[&>svg]:rotate-180"]),
    );
    const page = screen.getByText("Users");
    expect(page.getAttribute("aria-current")).toBe("page");
    expect(tokens(page)).toContain("text-foreground");
    expect(tokens(screen.getByText("Admin"))).toContain("hover:text-foreground");
  });
});

describe("NavItem (tokens.md §6.12)", () => {
  it("the reference's 40px, 13px medium item, accent hover, 16px icon", () => {
    render(
      <NavItem href="/admin/users" icon={<svg />}>
        Users
      </NavItem>,
    );
    const item = screen.getByRole("link", { name: "Users" });
    expect(tokens(item)).toEqual(
      expect.arrayContaining([
        "h-10",
        "px-4",
        "text-nav",
        "font-medium",
        "rounded-md",
        "hover:bg-accent",
        "justify-start",
      ]),
    );
    expect(item.getAttribute("aria-current")).toBeNull();
  });

  it("active marks aria-current and sits on the accent; a trailing count spreads the row", () => {
    render(
      <NavItem href="/admin/users" active trailing={<CountBadge count={120} />}>
        Users
      </NavItem>,
    );
    const item = screen.getByRole("link");
    expect(item.getAttribute("aria-current")).toBe("page");
    expect(tokens(item)).toEqual(
      expect.arrayContaining(["bg-accent", "text-accent-foreground", "justify-between"]),
    );
    expect(item.textContent).toContain("99+");
  });

  it("renders as a button for a group toggle, same recipe; children indent ps-4", () => {
    render(
      <>
        <NavItem render={<button type="button" />}>Reports</NavItem>
        <NavItemGroup data-testid="group">x</NavItemGroup>
      </>,
    );
    expect(tokens(screen.getByRole("button", { name: "Reports" }))).toContain("h-10");
    expect(tokens(screen.getByTestId("group"))).toEqual(
      expect.arrayContaining(["ps-4", "space-y-1"]),
    );
  });
});
