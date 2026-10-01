import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * The a11y gate (testing.md: "serious/critical violations fail CI").
 *
 * One copy, shared by the public and admin suites. It lived inside
 * `public/tools.spec.ts` while it had one caller; the AI screens made it a
 * second and a third, and a threshold that drifts between suites is worse than
 * no threshold — "the admin was checked at a different bar" is exactly the
 * sentence a gate exists to prevent.
 *
 * Serious and critical fail; minor and moderate are advisory, as the rule says.
 */
export async function expectNoSeriousAxeViolations(
  page: Page,
  options: {
    /** Check only this part of the page (e.g. an open dialog). */
    include?: string;
    /**
     * Accept ADR-143's owner decision and nothing wider: WHITE text on the
     * saved `--primary` fill (2.57:1 on `#C8986B`). Every other contrast
     * failure still blocks. Opt-in per call, because the suite-wide conflict
     * between ADR-143 and this gate is still owed its own decision (DEVLOG,
     * Phase 6) and must not be settled by a default here.
     */
    acceptBrandFillLabels?: boolean;
  } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.include) builder = builder.include(options.include);
  const results = await builder.analyze();

  // The fill and its label ink as the page resolves them, in axe's own
  // `#rrggbb` form. Read, not typed: an admin can save another primary, and
  // the exemption follows the tokens rather than one colour.
  const brand = options.acceptBrandFillLabels
    ? await page.evaluate(() => {
        const resolve = (token: string) => {
          const probe = document.createElement("span");
          probe.style.backgroundColor = `var(${token})`;
          document.body.append(probe);
          const rgb = getComputedStyle(probe).backgroundColor.match(/\d+/g) ?? [];
          probe.remove();
          return `#${rgb
            .slice(0, 3)
            .map((n) => Number(n).toString(16).padStart(2, "0"))
            .join("")}`;
        };
        return { fill: resolve("--primary"), label: resolve("--primary-foreground") };
      })
    : null;
  const brandFill = brand?.fill ?? null;
  const isBrandFillLabel = (node: { any: { data?: unknown }[] }) =>
    node.any.some((check) => {
      const data = check.data as { fgColor?: string; bgColor?: string } | undefined;
      return data?.fgColor === brand?.label && data?.bgColor === brand?.fill;
    });

  const blocking = results.violations
    .map((violation) =>
      brandFill && violation.id === "color-contrast"
        ? { ...violation, nodes: violation.nodes.filter((node) => !isBrandFillLabel(node)) }
        : violation,
    )
    .filter(
      (violation) =>
        violation.nodes.length > 0 &&
        (violation.impact === "serious" || violation.impact === "critical"),
    );
  expect(
    // The failing SELECTORS, not just a count. A message reading
    // "color-contrast: 4 node(s)" sends the next person to re-run axe by hand
    // before they can start fixing anything; the point of a gate is that its
    // failure is the first step of the repair. Capped at three nodes and one
    // line of context so a page with a systemic problem does not print a wall.
    blocking.map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ");
      const more = v.nodes.length > 3 ? ` (+${v.nodes.length - 3} more)` : "";
      const detail = v.nodes[0]?.failureSummary?.split("\n").slice(1, 2).join("") ?? "";
      return `${v.id} [${v.nodes.length}]: ${v.help} — ${targets}${more}${detail ? ` :: ${detail.trim()}` : ""}`;
    }),
    "serious/critical axe violations",
  ).toEqual([]);
}
