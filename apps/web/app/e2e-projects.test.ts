import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every Playwright spec belongs to exactly one project.
//
// ADR-151 renamed the portal's URLs from `/admin` to `/keystone`, and the same
// sweep rewrote the admin project's `testMatch` from `/admin\/.*\.spec\.ts/` to
// `/keystone\/.*\.spec\.ts/`. The specs never moved — they live in
// `e2e/admin/` — so from that day the project matched no file at all. Nothing
// failed: Playwright runs the tests it finds, and it found none. Every admin
// spec (articles, tools, AI) went unrun while the suite said green, and the
// promotions spec (changes-52 P8) would have joined them.
//
// A spec claimed by NO project is that bug; a spec claimed by TWO runs twice
// under two different sessions, which is its own confusing failure. Read as
// text, not imported: the config loads dotenv and derives a database URL, and
// neither belongs in a unit test.

const webRoot = path.resolve(__dirname, "..");
const config = readFileSync(path.join(webRoot, "playwright.config.ts"), "utf8");

/** Every `testMatch: /…/` literal in the config, as the RegExp Playwright gets. */
function projectPatterns(): RegExp[] {
  return [...config.matchAll(/testMatch:\s*\/((?:\\.|[^/\n])+)\/([a-z]*)/g)].map(
    ([, source, flags]) => new RegExp(source!, flags),
  );
}

/** Every spec and setup file under `e2e/`, as a forward-slash absolute path. */
function e2eFiles(dir = path.join(webRoot, "e2e")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith(".") ? [] : e2eFiles(full);
    return /\.(spec|setup)\.ts$/.test(entry.name) ? [full.split(path.sep).join("/")] : [];
  });
}

describe("playwright projects", () => {
  const patterns = projectPatterns();
  const files = e2eFiles();

  it("reads the config's projects", () => {
    // auth, admin, public — a parse that found none would pass every case below.
    expect(patterns.length).toBeGreaterThanOrEqual(3);
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(webRoot, file).split(path.sep).join("/"), file]))(
    "%s runs in exactly one project",
    (_, file) => {
      const owners = patterns.filter((pattern) => pattern.test(file!));
      expect(owners.map(String)).toHaveLength(1);
    },
  );

  it("the admin project owns e2e/admin", () => {
    const admin = files.filter((file) => file.includes("/e2e/admin/"));
    expect(admin.length).toBeGreaterThan(0);
  });
});
