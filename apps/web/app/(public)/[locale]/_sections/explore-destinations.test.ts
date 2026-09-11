// Explore-carousel registry tests.
//
// `status` is the one field in this registry that no type can check: it is a
// claim ABOUT THE FILESYSTEM — "a page exists behind this card" — written by
// hand in a file that has no reason to change when a route lands. It went
// stale exactly that way. `/learn` shipped with changes-11 Phase 4 and the
// card stayed `soon` until 2026-09-11, so the homepage spent two days
// refusing to link to a live page while advertising it as coming soon.
//
// So this test resolves each destination's route key to the page file Next.js
// would serve and asserts the claim both ways: a `live` card must have a page,
// and a `soon` card must NOT. The second half is the one that catches the
// staleness — the first would have passed throughout the bug.
//
// The catch-all is deliberately not counted. `app/(public)/[locale]/[...slug]`
// answers every unmatched path, finds no published CMS page and 404s, which
// is the 404 the `soon` tile exists to avoid; treating it as "a page exists"
// would make every card pass forever.
import { existsSync } from "node:fs";
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
    const hasPage = existsSync(pageFileFor(href));

    it(`${destination.key} is "${destination.status}" and ${hasPage ? "has" : "has no"} page at ${href}`, () => {
      // Written as one assertion on the pair rather than two branches: the
      // failure message then names the destination, its claim and the truth,
      // which is everything needed to fix it.
      expect({ key: destination.key, status: destination.status, hasPage }).toEqual({
        key: destination.key,
        status: hasPage ? "live" : "soon",
        hasPage,
      });
    });
  }

  it("covers a card of each status, so neither branch can rot unnoticed", () => {
    const statuses = new Set(EXPLORE_DESTINATIONS.map((destination) => destination.status));
    expect(statuses).toEqual(new Set(["live", "soon"]));
  });
});
