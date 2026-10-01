import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGUAGE_CONTENT_TABLES } from "./languages.ts";

const schema = readFileSync(new URL("../../db/prisma/schema.prisma", import.meta.url), "utf8");

/** Every model with a `locale` column whose rows are words written in that language. */
function contentModels(): string[] {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
  return models
    .filter(([, name, body]) => {
      const hasLocale = /^\s+locale\s+String/m.test(body ?? "");
      return hasLocale && (name!.endsWith("Translation") || name === "EmailCampaignContent");
    })
    .map(([, name]) => name!.charAt(0).toLowerCase() + name!.slice(1))
    .sort();
}

describe("LANGUAGE_CONTENT_TABLES (ADR-178 #2)", () => {
  it("lists every table that holds content written in a language", () => {
    // A new *Translation model missing here would let a language be deleted
    // while people's translations in it still exist.
    expect([...LANGUAGE_CONTENT_TABLES].sort()).toEqual(contentModels());
  });
});
