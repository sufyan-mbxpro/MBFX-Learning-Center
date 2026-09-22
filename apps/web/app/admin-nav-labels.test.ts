// Every admin sidebar label key resolves to a STRING (changes-25 T4).
//
// **Why this file exists.** `admin-shell.tsx` renders each nav entry as
// `t(entry.labelKey)`, and next-intl throws `INSUFFICIENT_PATH` at RUNTIME if
// that path holds an object instead of a string. Nothing static caught it:
// the labelKey union is a list of strings and the catalog is JSON, so TypeScript
// sees two unrelated things agree on nothing.
//
// ADR-069 hit this once — `admin.glossary` is the nav label, so the term
// editor's keys had to go under `admin.glossaryEditor` — and CLAUDE.md records
// it with the words "nothing static catches that collision". changes-25 hit it
// again within the hour: `admin.market` was the sidebar label, a new
// `admin.market.*` object shadowed it, every check passed, and `/keystone/market`
// crashed the whole shell on first load.
//
// So now something static does catch it. A source guard rather than a render
// test, for `top-bar-icons.test.ts`'s reason: apps/web has no jsdom, and the
// question here is about two files agreeing, not about a component.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import en from "@repo/i18n/messages/en.json" with { type: "json" };

const shellSource = readFileSync(
  new URL("./(admin)/keystone/_components/admin-shell.tsx", import.meta.url),
  "utf8",
);

/**
 * Every `labelKey: "…"` in the nav definitions.
 *
 * Dots are matched too. `admin.nav.ai` is the first entry to use one
 * (code-style.md #29), and a pattern that excluded dots would have SKIPPED it
 * rather than checked it — a guard that silently stops covering the newest case
 * is worse than one that fails.
 */
function navLabelKeys(): string[] {
  return [...shellSource.matchAll(/labelKey:\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]!);
}

const admin = en.admin as Record<string, unknown>;

/** Resolve a dotted path under `admin`, the way `t()` does. */
function resolve(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      admin,
    );
}

describe("admin sidebar label keys", () => {
  it("finds the nav entries at all — a silent zero would pass every assertion below", () => {
    expect(navLabelKeys().length).toBeGreaterThan(10);
  });

  it.each([...new Set(navLabelKeys())])("admin.%s is a string, not a namespace", (key) => {
    // The failure this catches reads "INSUFFICIENT_PATH: Message at
    // `admin.<key>` resolved to `object`" and takes the ENTIRE admin shell
    // down, not just the screen that owns the key.
    expect(resolve(key), `admin.${key} is missing from en.json`).toBeDefined();
    expect(
      typeof resolve(key),
      `admin.${key} holds an object, so t("${key}") throws INSUFFICIENT_PATH and the ` +
        `sidebar cannot render. Put the screen's keys under a different name — ` +
        `admin.glossary/admin.glossaryEditor and admin.market/admin.marketData are the precedents.`,
    ).toBe("string");
  });

  it("gives each nav GROUP a distinct label key", () => {
    // The groups are keyed by their label, so two groups sharing one produce
    // React's "Encountered two children with the same key" and one of them is
    // liable to be dropped. Adding a destination to an existing group is
    // almost always right; a second group with a heading that already exists
    // is the mistake this catches.
    // Anchored to the array literal's own indentation: the `labelKey` in the
    // TYPE union above it lists every group name by definition, and matching
    // that would make this assertion permanently red.
    const groupKeys = [...shellSource.matchAll(/^ {4}labelKey: (null|"nav[A-Za-z]+"),$/gm)].map(
      (m) => m[1]!,
    );
    expect(groupKeys.length).toBeGreaterThan(3);
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
  });

  it("keeps the two known collisions split", () => {
    // Named explicitly so a later rename cannot quietly merge them back.
    expect(typeof admin.glossary).toBe("string");
    expect(typeof admin.glossaryEditor).toBe("object");
    expect(typeof admin.market).toBe("string");
    expect(typeof admin.marketData).toBe("object");
  });

  it("avoids the collision entirely for AI, the way code-style.md #29 says to", () => {
    // The third instance (ADR-097) took the rule rather than the workaround:
    // the label is `admin.nav.ai` and `admin.ai` is free to be the object every
    // AI screen reads from. `glossaryEditor` and `marketData` are what the flat
    // key costs when it is claimed first.
    expect(typeof admin.ai).toBe("object");
    expect(typeof (admin.nav as Record<string, unknown>).ai).toBe("string");
  });
});
