// RTL + focus-treatment checks (SKILL.md). jsdom has no layout engine, so
// "start/end alignment" is asserted at the level jsdom can actually verify:
// components emit ONLY logical-property utilities (ps-/pe-/ms-/me-/
// text-start/start-/end-), never physical ones — which is the exact
// invariant that makes dir="rtl" work without a per-component audit
// (architecture doc §4.3). Visual RTL rendering rides with the Playwright
// suite (deferred with it).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion.tsx";
import { Button } from "./button.tsx";
import { Container } from "./container.tsx";
import { CtaBand } from "./cta-band.tsx";
import { IconCard } from "./icon-card.tsx";
import { Input } from "./input.tsx";
import { Label } from "./label.tsx";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "./field.tsx";
import { Marquee } from "./marquee.tsx";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "./pagination.tsx";
import { ProcessStep } from "./process-step.tsx";
import { Reveal } from "./reveal.tsx";
import { ScrollToTop } from "./scroll-to-top.tsx";
import { Section } from "./section.tsx";
import { SectionHeading } from "./section-heading.tsx";
import { StatCard } from "./stat-card.tsx";
import { AwardCard } from "./award-card.tsx";
import { AwardGrid } from "./award-grid.tsx";
import { CheckList } from "./check-list.tsx";
import { HotspotMap } from "./hotspot-map.tsx";
import { PageHero } from "./page-hero.tsx";
import { SplitCallout } from "./split-callout.tsx";
import { StatBand } from "./stat-band.tsx";
import { Timeline } from "./timeline.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.tsx";

afterEach(cleanup);

// ScrollToTop/StatCard mount an effect that calls matchMedia (Counter,
// prefers-reduced-motion checks) — real browsers have had this since IE9,
// jsdom doesn't implement it at all. Standard test-environment shim, not a
// production concern (see counter.tsx/scroll-to-top.tsx: IntersectionObserver
// itself is separately guarded to fail open when absent, which jsdom also
// doesn't implement).
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

// Physical directional utilities that fail the repo's lint rule; any of
// them inside a rendered className breaks RTL. Matches pl-*, pr-*, ml-*,
// mr-*, text-left, text-right, left-*, right-* as standalone utilities
// (also within variants like focus:pl-2), not substrings of other words.
const PHYSICAL_UTILITY = /(?:^|[\s:])(?:-?p[lr]-|-?m[lr]-|text-left|text-right|-?left-|-?right-)/;

function expectNoPhysicalUtilities(container: HTMLElement) {
  for (const el of [container, ...container.querySelectorAll<HTMLElement>("*")]) {
    const className = typeof el.className === "string" ? el.className : "";
    expect(PHYSICAL_UTILITY.test(className), `physical directional utility in: ${className}`).toBe(
      false,
    );
  }
}

describe("logical-properties invariant (RTL-safety) per layout-bearing component", () => {
  it("Button (all variants and sizes)", () => {
    const { container } = render(
      <div dir="rtl">
        {(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(
          (variant) => (
            <Button key={variant} variant={variant}>
              x
            </Button>
          ),
        )}
        {(["default", "xs", "sm", "lg", "xl", "icon"] as const).map((size) => (
          <Button key={size} size={size}>
            x
          </Button>
        ))}
        {/* Public design system additions (ADR-018): the pill shape and the
            trailing-icon slide, which is opt-in via data-icon="inline-end". */}
        <Button shape="pill" size="xl">
          x
        </Button>
        <Button size="xl">
          Open account
          <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
        </Button>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("Input + Label + Field group", () => {
    const { container } = render(
      <div dir="rtl">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="e">Email</FieldLabel>
            <Input id="e" />
            <FieldDescription>Description text</FieldDescription>
            <FieldError errors={[{ message: "Required" }]} />
          </Field>
        </FieldGroup>
        <Label htmlFor="x">Standalone</Label>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("Table", () => {
    const { container } = render(
      <div dir="rtl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>EUR/USD</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("Tabs", () => {
    const { container } = render(
      <div dir="rtl">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">content</TabsContent>
        </Tabs>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  // Public design system primitives (Phase 2). These carry the SAME
  // invariant as everything above — the reference design is LTR-only and we
  // are not, so every one of them ships logical properties only.
  it("Container (all sizes) + Section (all tones) + SectionHeading (both alignments)", () => {
    const { container } = render(
      <div dir="rtl">
        {(["page", "wide", "narrow"] as const).map((size) => (
          <Container key={size} size={size}>
            x
          </Container>
        ))}
        {(["default", "muted", "inverted", "accent"] as const).map((tone) => (
          <Section key={tone} tone={tone} spacing="lg">
            x
          </Section>
        ))}
        <SectionHeading eyebrow="Account" title="Trading Accounts" lead="Body copy." />
        <SectionHeading align="center" title="Centred" />
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("Reveal (every variant) + Marquee + ScrollToTop", () => {
    const { container } = render(
      <div dir="rtl">
        {(["up", "start", "end", "fade", "scale"] as const).map((variant) => (
          <Reveal key={variant} variant={variant} delay={100}>
            x
          </Reveal>
        ))}
        <Marquee>
          <span>EUR/USD</span>
        </Marquee>
        <Marquee pauseOnHover={false} reverse>
          <span>GBP/USD</span>
        </Marquee>
        <ScrollToTop label="Back to top" />
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("IconCard + ProcessStep + StatCard + CtaBand + Pagination + Accordion", () => {
    const { container } = render(
      <div dir="rtl">
        <IconCard icon={ArrowRight} title="Professional Account">
          Body copy.
        </IconCard>
        <ProcessStep step={1} title="Sign up">
          Body copy.
        </ProcessStep>
        <ProcessStep step={2} title="Trade" isLast />
        <StatCard value={150} suffix="+" label="Countries" />
        <CtaBand title="Subscribe" description="Latest updates.">
          <Button>Go</Button>
        </CtaBand>
        <CtaBand variant="full-width" title="Wide" />
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">2</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <Accordion>
          <AccordionItem value="a">
            <AccordionTrigger>Who we are</AccordionTrigger>
            <AccordionContent>Body copy.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  // About-section primitives (changes-09-plan.md PR 2). SplitCallout's
  // `reverse` is the interesting one: it swaps columns by ORDER, so the
  // whole block still mirrors in RTL instead of double-flipping.
  it("PageHero / SplitCallout / CheckList / StatBand", () => {
    const { container } = render(
      <div dir="rtl">
        <PageHero
          eyebrow="About"
          title="About MBX"
          lead="Who we are."
          footnote="Small print."
          actions={<Button>Start</Button>}
        />
        <SplitCallout
          step={1}
          eyebrow="Reason 1"
          title="Structured curriculum"
          actions={<Button>Go</Button>}
        >
          <p>Body copy.</p>
        </SplitCallout>
        <SplitCallout title="Reversed" reverse tone="muted" />
        <CheckList items={["One", "Two"]} columns={2} />
        <StatBand caption="As of today">
          <StatCard value={12} suffix="+" label="Courses" />
        </StatBand>
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });

  it("Timeline / AwardGrid / HotspotMap", () => {
    const { container } = render(
      <div dir="rtl">
        <Timeline
          items={[
            { id: "a", marker: 2024, title: "Founded", body: "Body." },
            { id: "b", marker: 2025, title: "Grew", body: "Body." },
          ]}
          collapsedCount={1}
          expandLabel="Show"
          collapseLabel="Close"
        />
        <AwardGrid>
          <AwardCard title="Award" issuer="Body" year={2026} />
        </AwardGrid>
        <HotspotMap
          points={[{ id: "gb", label: "United Kingdom", detail: "Desk", x: 40, y: 30 }]}
          legendLabel="Where we operate"
        />
      </div>,
    );
    expectNoPhysicalUtilities(container);
  });
});

describe("keyboard focus treatment", () => {
  it("Button is keyboard-focusable and carries an explicit focus-visible ring treatment in its class list", () => {
    render(<Button>Focus me</Button>);
    const button = screen.getByRole("button", { name: "Focus me" });
    button.focus();
    expect(document.activeElement).toBe(button);
    // The ring itself is a computed style Tailwind produces at build; what
    // jsdom can verify is that the component opts in to focus-visible
    // treatment rather than stripping the outline with nothing in its place.
    expect(button.className).toMatch(/focus-visible:/);
  });

  it("a disabled Button is not tabbable", () => {
    render(<Button disabled>Nope</Button>);
    const button = screen.getByRole("button", { name: "Nope" });
    fireEvent.focus(button);
    expect(button).toHaveProperty("disabled", true);
  });
});
