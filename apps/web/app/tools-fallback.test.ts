// ADR-168 — an untranslated tool is named from the catalog, never by its key.
//
// `getToolPage` and `getEnabledTools` return `title: null` when a tool has no
// translation anywhere in the locale's fallback chain. The type makes a caller
// deal with it; this makes sure it deals with it the ONE way: the catalog's
// `tools.names.<key>`. The registry key as a title is what `/ar/tools/pip-value`
// showed before, and it looked like a page that had loaded.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_KEYS } from "@repo/contracts";
import ar from "@repo/i18n/messages/ar.json";
import en from "@repo/i18n/messages/en.json";

const APP_ROOT = resolve(process.cwd(), "app");

function publicSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "(admin)" || name === "(admin-auth)" || name === "node_modules") continue;
      publicSources(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

const CALLERS = publicSources(APP_ROOT)
  .map((path) => ({ path: relative(APP_ROOT, path), source: strip(readFileSync(path, "utf8")) }))
  .filter(({ source }) => /\b(getToolPage|getEnabledTools)\(/.test(source));

describe("untranslated tools (ADR-168)", () => {
  it.each([
    ["en", en],
    ["ar", ar],
  ] as const)("%s names every registered tool", (_, catalog) => {
    const names = (catalog.tools as { names?: Record<string, string> }).names ?? {};
    expect(Object.keys(names).sort()).toEqual([...TOOL_KEYS].sort());
    for (const key of TOOL_KEYS) expect(names[key]?.trim()).toBeTruthy();
  });

  it("has callers to check", () => {
    expect(CALLERS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(CALLERS.map((c) => [c.path, c.source] as const))(
    "%s falls back to the catalog name, never the key",
    (_, source) => {
      expect(source).toMatch(/\.title \?\? \w+\(`names\.\$\{/);
      expect(source).not.toMatch(/\.title \?\? \w+\.key\b/);
    },
  );
});
