// The AI registry's CROSS-FILE drift guard (ADR-097 #3).
//
// **Adding a feature touches five places and no migration**: an `AI_FEATURES`
// entry, a prompt builder, a payload schema, a seed row and a catalog block.
// `packages/contracts/src/ai.test.ts` checks the first two, which it can answer
// from the registry itself. The rest need to READ files across package
// boundaries, and this is where that belongs: @repo/contracts declares `zod`
// and nothing else on purpose, so it has no `@types/node` and cannot open one.
//
// Source-reading rather than importing, for `permission-groups.test.ts`'s
// reason: the seed is a script that connects to a database, and standing up
// MariaDB to assert the presence of six strings would be the wrong trade.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AI_FEATURE_KEYS, SETTINGS_SCHEMAS, SETTING_GROUPS } from "@repo/contracts";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const seed = read("../../../packages/db/prisma/seed.ts");
const catalog = read("../../../packages/i18n/messages/en.json");
const promptsIndex = read("../../../packages/ai/src/prompts/index.ts");

describe("every AI_FEATURES key is wired end to end", () => {
  it("gives every key a prompt builder", () => {
    for (const key of AI_FEATURE_KEYS) {
      expect(promptsIndex, `no prompt builder registered for "${key}"`).toContain(`${key}:`);
    }
  });
  it("gives every key a seed row", () => {
    // A feature with no row is a feature nothing can switch on, and the screen
    // would render a card whose save creates the row by accident.
    const block = seed.slice(seed.indexOf("AI_FEATURE_KEYS_SEED"));
    for (const key of AI_FEATURE_KEYS) {
      expect(block, `"${key}" has no seed row`).toContain(`"${key}"`);
    }
  });
  it("gives every key a name, a description and a place in the catalog", () => {
    for (const key of AI_FEATURE_KEYS) {
      for (const group of ["featureNames", "featureDesc", "featureWhere"]) {
        // The JSON is read as text rather than parsed into a tree because the
        // claim is "this key appears under that heading", and a substring
        // search over a file this size is faster and just as exact.
        const section = catalog.slice(catalog.indexOf(`"${group}"`));
        expect(section.slice(0, 2000), `admin.ai.${group}.${key} is missing`).toContain(`"${key}"`);
      }
    }
  });
});
describe("the ai.* settings", () => {
  const KEYS = [
    "ai.enabled",
    "ai.maxTokensPerRequest",
    "ai.monthlyBudgetUsd",
    "ai.budgetWarnPercent",
    "ai.capBehavior",
    "ai.rateLimitPerUserHour",
    "ai.model.light",
    "ai.model.standard",
    "ai.model.heavy",
  ] as const;

  it("declares a schema and a group for all nine", () => {
    for (const key of KEYS) {
      expect(SETTINGS_SCHEMAS[key], `${key} has no schema`).toBeDefined();
      expect(SETTING_GROUPS[key], `${key} has no group`).toBe("ai");
    }
  });

  it("seeds all nine, and seeds every one as NON-public", () => {
    // security.md #12 — a non-public setting must never serialise into a
    // public RSC payload, and the seed's last tuple element is `isPublic`.
    for (const key of KEYS) {
      const line = seed.split("\n").find((row) => row.includes(`"${key}"`));
      expect(line, `${key} is not seeded`).toBeDefined();
      expect(line, `${key} must be seeded isPublic: false`).toMatch(/false,?\s*\],?\s*$/);
    }
  });

  it("seeds ai.enabled OFF — a platform that can spend money does not arrive spending it", () => {
    const line = seed.split("\n").find((row) => row.includes('"ai.enabled"'));
    expect(line).toContain("false");
  });

  it("names a tier model the seed also creates", () => {
    // `check:ai-model-tiers`' claim, asserted here rather than in a ninth CI
    // script: a tier naming a model nothing creates would degrade silently to
    // the default provider's first model.
    for (const key of ["ai.model.light", "ai.model.standard", "ai.model.heavy"] as const) {
      const line = seed.split("\n").find((row) => row.includes(`"${key}"`))!;
      const modelId = /"(claude|gpt)[^"]*"/.exec(line)?.[0];
      expect(modelId, `${key} names no model`).toBeDefined();
      expect(
        seed.slice(seed.indexOf("AI_MODEL_SEEDS")),
        `${key} names an unseeded model`,
      ).toContain(modelId!);
    }
  });
});
describe("the four AI permission keys", () => {
  it("seeds exactly four, in the `ai` group", () => {
    // Scoped to the PERMISSIONS registry: the SETTINGS registry below it uses
    // the same `["ai", "ai.something", …]` tuple shape, and an unscoped match
    // reads the nine settings keys as permissions.
    const permissions = seed.slice(
      seed.indexOf("const PERMISSIONS = ["),
      seed.indexOf("] as const;", seed.indexOf("const PERMISSIONS = [")),
    );
    const keys = [...permissions.matchAll(/\["ai",\s*"(ai\.[\w.]+)"/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      "ai.providers.manage",
      "ai.settings.manage",
      "ai.usage.view",
      "ai.use",
    ]);
  });

  it("adds no per-feature permission key", () => {
    // ADR-097 #10, and the fifth time this repo has declined keys for a new
    // surface. A key answers "may this person change this kind of thing", not
    // "which screen are they on".
    for (const key of AI_FEATURE_KEYS) {
      expect(seed, `a per-feature key was minted for "${key}"`).not.toContain(`"ai.${key}"`);
    }
  });
});
