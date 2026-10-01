// ADR-177 — whoever may open a settings screen can find it.
//
// The Settings sidebar row and the hub each kept their own list of keys, and
// both missed `translations.view`: the seeded Content Manager and Editor
// could open the Translation review queue by typing its URL and had no other
// way in. The two now share `SETTINGS_ENTRY_KEYS`, and this reads every page
// under Settings as SOURCE (like the other admin convention guards) and
// checks that each key its gate accepts is in that list.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SETTINGS_ENTRY_KEYS } from "./settings-entry-keys.ts";

const SETTINGS = fileURLToPath(new URL("../", import.meta.url));
const KEYSTONE = join(SETTINGS, "..");
const SHELL = readFileSync(join(KEYSTONE, "_components", "admin-shell.tsx"), "utf8");
const HUB = readFileSync(join(SETTINGS, "page.tsx"), "utf8");
const SEED = readFileSync(
  fileURLToPath(new URL("../../../../../../../packages/db/prisma/seed.ts", import.meta.url)),
  "utf8",
);

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pages(path, out);
    else if (name === "page.tsx" || name === "layout.tsx") out.push(path);
  }
  return out;
}

/** The keys a file's FIRST gate accepts: one key, or every key of an "any". */
function entryGate(source: string): string[] {
  const one = /requirePermission\(\s*"([^"]+)"/.exec(source);
  const any = /requireAnyPermission\(\s*\[([^\]]*)\]/.exec(source);
  const first = [one, any]
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => a.index - b.index)[0];
  if (!first) return [];
  if (first === one) return [one[1]!];
  return [...first[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("SETTINGS_ENTRY_KEYS", () => {
  it("names only seeded keys", () => {
    for (const key of SETTINGS_ENTRY_KEYS) expect(SEED, key).toContain(`"${key}"`);
  });

  it("admits everyone a settings screen admits", () => {
    const entry = new Set<string>(SETTINGS_ENTRY_KEYS);
    const files = [
      ...pages(SETTINGS),
      ...pages(join(KEYSTONE, "theme")),
      ...pages(join(KEYSTONE, "social")),
    ]
      .filter((path) => path !== join(SETTINGS, "page.tsx"))
      // A child page (`new`, or a `[param]` record) is opened from a button
      // on its parent screen, so the parent's gate is the one that must admit.
      .filter((path) => !/[\\/](new|\[[^\]]+\])[\\/]/.test(path));
    for (const file of files) {
      for (const key of entryGate(readFileSync(file, "utf8"))) {
        expect(entry.has(key), `${file.slice(KEYSTONE.length)} admits ${key}`).toBe(true);
      }
    }
  });

  it("is the list both the sidebar row and the hub read", () => {
    expect(SHELL).toContain("permission: [...SETTINGS_ENTRY_KEYS]");
    expect(HUB).toContain("requireAnyPermission([...SETTINGS_ENTRY_KEYS])");
  });
});
