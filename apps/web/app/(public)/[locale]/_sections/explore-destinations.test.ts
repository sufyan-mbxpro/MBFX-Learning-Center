// Explore-carousel registry tests.
//
// `status` is the one field in this registry that no type can check: it is a
// claim ABOUT THE FILESYSTEM, written by hand in a file that has no reason to
// change when a route lands. It went stale exactly that way. `/learn` shipped
// with changes-11 Phase 4 and the card stayed `soon` until 2026-09-11, so the
// homepage spent two days refusing to link to a live page while advertising it
// as coming soon.
//
// changes-22 changed what the claim IS, so it changed what this checks.
// `/tools` and `/markets` have real routes now, rendering the shared
// `ComingSoon` page, and every card links. The two halves of the invariant:
//
//   * EVERY destination has a page file. Nothing in the carousel may point at
//     the `[...slug]` catch-all, which answers an unmatched path with the
//     site's 404 — the thing this registry exists to prevent.
//   * `soon` ⟺ that page file renders `ComingSoon`. Read from the route's
//     own source, so building a section and forgetting to flip `status` fails
//     here rather than leaving the card apologising for a page that shipped.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isRouteKey, ROUTE_PATHS } from "@repo/contracts";

import { destinationHref, EXPLORE_DESTINATIONS } from "./explore-destinations.ts";

/**
 * The page file Next.js would serve for a destination's path, resolved from
 * `_sections/` up to the `[locale]` segment the routes sit under. Literal
 * segments only — every explore destination is a static path.
 */
function pageFileFor(href: string): string {
  const segments = href.split("/").filter(Boolean);
  return fileURLToPath(new URL(`../${segments.join("/")}/page.tsx`, import.meta.url));
}

describe("EXPLORE_DESTINATIONS — the registry names only things that exist", () => {
  it("every destination resolves through ROUTE_PATHS, with no hand-typed href", () => {
    for (const destination of EXPLORE_DESTINATIONS) {
      expect(isRouteKey(destination.routeKey)).toBe(true);
      expect(destinationHref(destination)).toBe(ROUTE_PATHS[destination.routeKey]);
    }
  });

  it("keys are unique, so one card cannot shadow another's media and copy", () => {
    const keys = EXPLORE_DESTINATIONS.map((destination) => destination.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("EXPLORE_DESTINATIONS — `status` agrees with the filesystem", () => {
  for (const destination of EXPLORE_DESTINATIONS) {
    const href = destinationHref(destination);
    const file = pageFileFor(href);
    const hasPage = existsSync(file);
    // A route that renders the shared coming-soon page is the filesystem's
    // own statement that the section is not built yet.
    const isComingSoon = hasPage && readFileSync(file, "utf8").includes("<ComingSoon ");

    it(`${destination.key} has a page at ${href}`, () => {
      expect({ key: destination.key, hasPage }).toEqual({ key: destination.key, hasPage: true });
    });

    it(`${destination.key} is "${destination.status}" and its route ${isComingSoon ? "renders" : "does not render"} ComingSoon`, () => {
      // One assertion on the pair rather than two branches: the failure
      // message then names the destination, its claim and the truth, which is
      // everything needed to fix it.
      expect({ key: destination.key, status: destination.status }).toEqual({
        key: destination.key,
        status: isComingSoon ? "soon" : "live",
      });
    });
  }

  it("covers a card of each status, so neither branch can rot unnoticed", () => {
    const statuses = new Set(EXPLORE_DESTINATIONS.map((destination) => destination.status));
    expect(statuses).toEqual(new Set(["live", "soon"]));
  });
});
