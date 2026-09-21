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
export async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
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
