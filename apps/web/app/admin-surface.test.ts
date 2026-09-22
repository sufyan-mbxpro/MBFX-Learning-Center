// The cross-surface probe's drift guard (ADR-006, testing.md #4).
//
// `e2e/public/learner-admin-probe.spec.ts` asserts that a learner session is
// turned away from every `/keystone/*` route. It holds its targets as a LITERAL
// LIST, because a probe that globs the tree at runtime silently stops covering
// a route the day the glob breaks — and reads green while doing it. The cost of
// a literal list is that it goes stale, which is exactly what this file is for.
//
// So: the tree is enumerated HERE, in a unit test that runs on every `pnpm
// test`, and compared with the list the probe carries. Add an admin screen
// without probing it and this fails, naming the path. Delete one and it fails
// too — a probe aimed at a route that no longer exists passes for the wrong
// reason.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL(".", import.meta.url));
const adminRoot = path.join(appDir, "(admin)", "keystone");
const probe = readFileSync(
  path.join(appDir, "..", "e2e", "public", "learner-admin-probe.spec.ts"),
  "utf8",
);

/** Route segments Next.js does not put in a URL. */
function isTransparentSegment(name: string): boolean {
  // `(group)` is a route group; `_private` is colocation (code-style.md #17).
  return name.startsWith("(") || name.startsWith("_");
}

/** Every routed path under `/keystone`, by walking for `page.tsx` / `route.ts`. */
function walk(dir: string, urlPath: string, out: { pages: string[]; handlers: string[] }) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") out.pages.push(urlPath || "/");
      if (entry === "route.ts") out.handlers.push(urlPath || "/");
      continue;
    }
    walk(full, isTransparentSegment(entry) ? urlPath : `${urlPath}/${entry}`, out);
  }
}

const routed = { pages: [] as string[], handlers: [] as string[] };
walk(adminRoot, "/keystone", routed);

/**
 * A dynamic segment cannot be probed by name, so the probe substitutes a
 * plausible id. This maps a routed path to the shape the probe would hold, so
 * the two can be compared without the test knowing which id was chosen.
 */
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";
function probeShape(routePath: string): string {
  return routePath.replace(/\[[^\]]+\]/g, PLACEHOLDER);
}

/** Paths the probe deliberately does not carry, each with its reason. */
const EXEMPT_PAGES = new Set([
  // ADR-052: the ONE /keystone path reachable without a session, by design — the
  // gate SENDS people here, so "a learner is turned away" is false of it.
  "/keystone",
  "/keystone/forgot-password",
  "/keystone/reset-password",
]);

/**
 * Nested pages whose PARENT is probed and which share its gate exactly — the
 * `(admin)` layout. Listing every leaf would make this guard a second copy of
 * the route tree; what it has to catch is a new SCREEN AREA nobody probed.
 *
 * A path is exempt only if a probed ancestor renders from the same layout, so
 * the gate under test is provably the same one.
 */
function hasProbedAncestor(shape: string, probed: Set<string>): boolean {
  const parts = shape.split("/");
  for (let i = parts.length - 1; i > 2; i -= 1) {
    if (probed.has(parts.slice(0, i).join("/"))) return true;
  }
  return false;
}

describe("the learner probe covers the admin surface", () => {
  const probed = new Set(
    [...probe.matchAll(/"(\/keystone(?:\/[^"?]*)?)(?:\?[^"]*)?"/g)].map((m) => m[1]!),
  );

  it("probes every admin page, or inherits a probed parent's gate", () => {
    const unprobed = routed.pages
      .map(probeShape)
      .filter(
        (shape) =>
          !EXEMPT_PAGES.has(shape) && !probed.has(shape) && !hasProbedAncestor(shape, probed),
      );
    expect(unprobed, "admin pages no learner-session probe reaches").toEqual([]);
  });

  it("probes every admin route handler", () => {
    // No ancestor rule here: a handler has no layout to inherit a gate from —
    // `requirePermission()` inside it IS the boundary (security.md #1), so
    // every one is its own case.
    const unprobed = routed.handlers
      .map(probeShape)
      .filter((shape) => !probed.has(shape) && !hasProbedAncestor(shape, probed));
    expect(unprobed, "admin route handlers no learner-session probe reaches").toEqual([]);
  });

  it("probes nothing that has stopped existing", () => {
    const shapes = new Set([...routed.pages, ...routed.handlers].map(probeShape));
    const stale = [...probed].filter(
      (shape) => !shapes.has(shape) && !EXEMPT_PAGES.has(shape) && shape !== "/keystone",
    );
    expect(stale, "probed paths with no route behind them").toEqual([]);
  });
});
