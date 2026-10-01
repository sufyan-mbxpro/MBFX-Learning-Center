import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_NAMESPACES,
  ENFORCED_LOCALES,
  findMissingKeys,
  flattenKeys,
  isAdminKey,
  run,
} from "../check-catalog-completeness.mjs";

describe("check:catalog-completeness — flattenKeys", () => {
  it("flattens nested message objects into domain.component.purpose dotted keys", () => {
    const keys = flattenKeys({ home: { placeholder: "x" }, common: { siteName: "y" } });
    expect(keys.sort()).toEqual(["common.siteName", "home.placeholder"]);
  });
});

describe("check:catalog-completeness — findMissingKeys", () => {
  it("flags a locale catalog missing a key the default catalog has", () => {
    const result = findMissingKeys(
      { common: { siteName: "EN" }, home: { placeholder: "EN" } },
      { ar: { common: { siteName: "AR" } } },
    );
    expect(result).toEqual([{ locale: "ar", missing: ["home.placeholder"] }]);
  });

  it("reports nothing for a fully-translated non-default catalog", () => {
    const result = findMissingKeys(
      { common: { siteName: "EN" } },
      { es: { common: { siteName: "ES" } } },
    );
    expect(result).toEqual([]);
  });
});

// ADR-043: the admin portal is English-only by design, so a missing admin key
// is not a gap. The public surface is multilingual, so a missing public key is.
describe("check:catalog-completeness — ADR-043 namespace split", () => {
  it("classifies every admin namespace as admin and everything else as public", () => {
    expect([...ADMIN_NAMESPACES].sort()).toEqual(["admin", "cms"]);
    expect(isAdminKey("admin.save")).toBe(true);
    expect(isAdminKey("cms.builder.title")).toBe(true);
    expect(isAdminKey("news.shareLabel")).toBe(false);
    // A namespace nobody has classified defaults to the STRICTER rule.
    expect(isAdminKey("somethingBrandNew.key")).toBe(false);
  });

  it("publicOnly ignores missing admin keys but still reports missing public keys", () => {
    const defaults = {
      admin: { save: "EN" },
      cms: { builder: { title: "EN" } },
      news: { shareLabel: "EN" },
    };
    const catalogs = { ar: { news: {} } };

    expect(findMissingKeys(defaults, catalogs, { publicOnly: true })).toEqual([
      { locale: "ar", missing: ["news.shareLabel"] },
    ]);
    // Without the flag, the admin gaps are exactly what drowned out the real one.
    expect(findMissingKeys(defaults, catalogs)[0].missing).toContain("admin.save");
  });

  it("reports nothing when a catalog is short ONLY admin keys", () => {
    const result = findMissingKeys(
      { admin: { save: "EN" }, cms: { x: "EN" }, news: { shareLabel: "EN" } },
      { ur: { news: { shareLabel: "UR" } } },
      { publicOnly: true },
    );
    expect(result).toEqual([]);
  });
});

// ADR-043 #4. The gate was armed but INERT while `en` was the only enforced
// locale; since ADR-166 it guards `ar` in the real workspace too. The failure
// branch is still exercised against a fixture below, so it cannot pass by
// never running.
describe("check:catalog-completeness — activation gate", () => {
  it("enforces the source and Arabic, the first locale prepared to go live (ADR-166)", () => {
    expect([...ENFORCED_LOCALES]).toEqual(["en", "ar"]);
  });

  it("the real workspace passes with Arabic enforced", () => {
    // The tests run from the repo root (package.json's vitest invocation).
    expect(run(process.cwd())).toBe(0);
  });

  it("FAILS when an enforced locale's public catalog is incomplete", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-gate-"));
    const dir = join(root, "packages", "i18n", "messages");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "en.json"),
      JSON.stringify({ news: { shareLabel: "EN" }, admin: { save: "EN" } }),
    );
    writeFileSync(join(dir, "ar.json"), JSON.stringify({ news: {} }));

    expect(run(root, { enforced: new Set(["ar"]) })).toBe(1);
    // Same fixture, locale not yet active → warning, not a failure.
    expect(run(root, { enforced: new Set(["en"]) })).toBe(0);

    rmSync(root, { recursive: true, force: true });
  });

  it("PASSES an enforced locale short only admin keys — English-only by design", () => {
    const root = mkdtempSync(join(tmpdir(), "catalog-gate-"));
    const dir = join(root, "packages", "i18n", "messages");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "en.json"),
      JSON.stringify({ news: { shareLabel: "EN" }, admin: { save: "EN" }, cms: { x: "EN" } }),
    );
    writeFileSync(join(dir, "ar.json"), JSON.stringify({ news: { shareLabel: "AR" } }));

    expect(run(root, { enforced: new Set(["ar"]) })).toBe(0);

    rmSync(root, { recursive: true, force: true });
  });
});

describe("check:catalog-completeness — live workspace", () => {
  it("exits 0: every ACTIVE locale's public catalog is complete", () => {
    expect(run()).toBe(0);
  });
});
