// The portal answers a mistyped address with the PORTAL's 404, and with a
// real 404 status.
//
// The bug: nothing under `(admin)/keystone` matched an unknown address, so
// Next fell through to `global-not-found.tsx` — the public "coming soon" page,
// which bypasses every layout. A signed-in staff member who mistyped
// `/keystone/usres` landed outside the portal, offered Courses, Trading tools,
// News and Support, with no link back to the dashboard.
//
// The status is the other half. A response commits its status the moment a
// Suspense fallback renders, so `keystone/loading.tsx` — one boundary over the
// whole portal — turned every `notFound()` under it into a 200 carrying 404
// markup. Measured both ways against a throwaway route before this change.
// Every real screen already declared its own pending state, so the boundary
// moved down into the six sections that had none; the catch-all is deliberately
// left outside all of them.
//
// Read as source, like `admin-dialog-conventions.test.ts`: these are async
// server components behind a session.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "app/(admin)");
const KEYSTONE = resolve(ADMIN_ROOT, "keystone");
const CATCH_ALL_DIR = resolve(KEYSTONE, "[...notFound]");

/** Source with its comments taken out — these guards are about the CODE. */
function stripComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every routed page under `/keystone`, as a path relative to it. */
function routedPages(dir: string, rel = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return entry.name === "page.tsx" && rel ? [rel] : [];
    if (entry.name.startsWith("_")) return []; // colocation (code-style.md #17)
    return routedPages(resolve(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
  });
}

/** The nearest `loading.tsx` at or above `page`, stopping below `keystone`. */
function hasPendingState(page: string): boolean {
  const parts = page.split("/");
  for (let i = parts.length; i > 0; i -= 1) {
    if (existsSync(resolve(KEYSTONE, ...parts.slice(0, i), "loading.tsx"))) return true;
  }
  return false;
}

describe("an unknown /keystone address renders the admin's own 404", () => {
  it("has a catch-all under the admin group, not the public one", () => {
    expect(existsSync(resolve(CATCH_ALL_DIR, "page.tsx"))).toBe(true);
  });

  it("throws notFound() rather than rendering a page of its own", () => {
    const src = readFileSync(resolve(CATCH_ALL_DIR, "page.tsx"), "utf8");
    expect(src).toContain('from "next/navigation"');
    expect(src).toMatch(/\bnotFound\(\)/);
  });

  it("draws inside the admin shell, with a route back to the dashboard", () => {
    const src = readFileSync(resolve(ADMIN_ROOT, "not-found.tsx"), "utf8");
    expect(src).toContain("/keystone/dashboard");
    // A second <main> inside the shell's would be a nested landmark.
    expect(stripComments(src)).not.toContain("<main");
  });
});

describe("the 404 status survives — no Suspense boundary above the throw", () => {
  it("has no portal-wide loading boundary", () => {
    expect(existsSync(resolve(KEYSTONE, "loading.tsx"))).toBe(false);
  });

  it("has no loading boundary in the catch-all's own folder", () => {
    expect(existsSync(resolve(CATCH_ALL_DIR, "loading.tsx"))).toBe(false);
  });

  // A loading.tsx at the `(admin)` segment would put a fallback ABOVE the
  // not-found boundary itself, so the 404 UI would start the stream and the
  // status would be 200 again — whatever the catch-all does.
  it("has no loading boundary above the not-found boundary", () => {
    expect(existsSync(resolve(ADMIN_ROOT, "loading.tsx"))).toBe(false);
  });

  // The price of removing the portal-wide boundary: a new admin section with
  // no pending state of its own now shows nothing while it loads. This is
  // what says so, by name, instead of it being noticed in a browser.
  it("every admin screen still declares its own pending state", () => {
    const missing = routedPages(KEYSTONE).filter(
      (page) => !page.startsWith("api/") && page !== "[...notFound]" && !hasPendingState(page),
    );
    expect(missing, "admin pages with no loading.tsx at or above them").toEqual([]);
  });

  it("checks a realistic number of them", () => {
    expect(routedPages(KEYSTONE).length).toBeGreaterThan(50);
  });
});
