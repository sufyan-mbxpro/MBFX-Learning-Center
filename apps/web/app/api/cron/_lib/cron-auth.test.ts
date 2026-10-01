import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CRON_DIR = join(import.meta.dirname, "..");

describe("every cron route uses the one bearer check (changes-54 N4)", () => {
  const routes = readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => join(CRON_DIR, entry.name, "route.ts"));

  it("finds the five routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routes)("%s calls cronAuthFailure and keeps no copy of its own", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("cronAuthFailure(request)");
    // A copied check is how a fix to one route misses the other four.
    expect(source).not.toContain("timingSafeEqual");
    expect(source).not.toContain("process.env.CRON_SECRET");
  });
});
