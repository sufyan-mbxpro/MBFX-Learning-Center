// ADR-165 #4 — a translatable setting is READ in the reader's language.
//
// Read as SOURCE, like `newsletter-signup.test.ts`. `getSetting(key)` has no
// locale, so a public render of a registry key through it prints the English
// on every locale, and nothing at runtime says so: the page looks finished in
// English, which is the only language a reviewer checks. The admin tree is
// exempt — the settings form edits the English, which is `getSetting`'s job.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSLATABLE_SETTING_KEYS } from "@repo/contracts";

const APP_ROOT = resolve(process.cwd(), "app");

/** Every non-test source file outside the admin trees. */
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

const FILES = publicSources(APP_ROOT).map((path) => ({
  path: relative(APP_ROOT, path),
  source: strip(readFileSync(path, "utf8")),
}));

describe("translatable settings (ADR-165 #4)", () => {
  it.each(TRANSLATABLE_SETTING_KEYS)(
    "%s is never read without a locale outside the admin",
    (key) => {
      const pattern = new RegExp(
        `\\b(getSetting|loadSetting)\\(\\s*["'\`]${key.replace(".", "\\.")}["'\`]`,
      );
      const offenders = FILES.filter((file) => pattern.test(file.source)).map((f) => f.path);
      expect(offenders).toEqual([]);
    },
  );

  it("every registry key is rendered somewhere through getLocalizedSetting", () => {
    // A key nobody renders is code-style.md #28's case: translating it would
    // be work whose result reaches no page.
    const rendered = new Set(
      FILES.flatMap((file) =>
        [...file.source.matchAll(/getLocalizedSetting\(\s*["'`]([\w.]+)["'`]/g)].map((m) => m[1]),
      ),
    );
    expect(TRANSLATABLE_SETTING_KEYS.filter((key) => !rendered.has(key))).toEqual([]);
  });
});
