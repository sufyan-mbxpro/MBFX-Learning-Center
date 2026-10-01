// ADR-177 — every seeded permission either governs something or says it does
// not.
//
// Ten keys had been seeded for months with nothing checking them, and the
// role editor drew them exactly like the keys that work, so granting
// `comments.moderate` looked like making someone a moderator. They are listed
// in `UNUSED_PERMISSIONS` now and the editor marks them. This test keeps that
// list true in BOTH directions:
//
//  - a listed key that code starts checking must leave the list, or the editor
//    would keep calling a working key "Not used yet";
//  - a seeded key that nothing references must join the list (or be wired),
//    so the next dead key is caught the day it is seeded.
//
// Like `permission-groups.test.ts` it reads source rather than importing it.
// "Referenced" means the key appears as a quoted string literal in a
// non-test source file of the app or a package, which is how every check in
// this repo spells a key (`check-permission-keys.mjs` reads the same shape).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UNUSED_PERMISSIONS } from "./permission-groups.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const seed = readFileSync(join(REPO, "packages/db/prisma/seed.ts"), "utf8");

function registryKeys(): string[] {
  const start = seed.indexOf("const PERMISSIONS = [");
  const end = seed.indexOf("] as const;", start);
  const block = seed.slice(start, end);
  return [...block.matchAll(/\[\s*"[\w-]+"\s*,\s*"([a-zA-Z][\w.]*)"\s*,/g)].map((m) => m[1]!);
}

// Files that NAME keys without checking them: the registry and lists of keys.
const NAMING_FILES = new Set([
  "packages/db/src/permission-groups.ts",
  "packages/db/src/role-exclusions.ts",
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "generated" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const corpus = [
  ...sourceFiles(join(REPO, "apps/web/app")),
  ...readdirSync(join(REPO, "packages")).flatMap((pkg) => {
    const src = join(REPO, "packages", pkg, "src");
    try {
      return statSync(src).isDirectory() ? sourceFiles(src) : [];
    } catch {
      return [];
    }
  }),
]
  .filter((path) => !NAMING_FILES.has(path.slice(REPO.length).split("\\").join("/")))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

function isReferenced(key: string): boolean {
  return corpus.includes(`"${key}"`) || corpus.includes(`'${key}'`);
}

describe("UNUSED_PERMISSIONS", () => {
  it("lists only seeded keys", () => {
    const seeded = new Set(registryKeys());
    for (const key of UNUSED_PERMISSIONS) expect(seeded, key).toContain(key);
  });

  it("lists no key that code references", () => {
    const wrong = UNUSED_PERMISSIONS.filter(isReferenced);
    expect(wrong, "now used: remove from UNUSED_PERMISSIONS").toEqual([]);
  });

  it("is complete: every other seeded key is referenced somewhere", () => {
    const unused = new Set<string>(UNUSED_PERMISSIONS);
    const dead = registryKeys().filter((key) => !unused.has(key) && !isReferenced(key));
    expect(dead, "seeded but checked nowhere: wire it or list it as unused").toEqual([]);
  });
});
