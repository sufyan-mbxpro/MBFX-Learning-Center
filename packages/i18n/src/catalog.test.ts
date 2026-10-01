import { describe, expect, it } from "vitest";
import { applyOverrides, catalogValueAt, hasCatalogFile, loadCatalogFile } from "./catalog.ts";
import { SUPPORTED_LOCALES } from "./routing.ts";

describe("applyOverrides (ADR-178 #3)", () => {
  const file = { home: { title: "Home", hero: { cta: "Start" } }, footer: "Footer" };

  it("replaces a string and adds a missing key, without touching the input", () => {
    const merged = applyOverrides(file, [
      { key: "home.title", value: "Accueil" },
      { key: "home.hero.sub", value: "Apprendre" },
      { key: "news.title", value: "Actualités" },
    ]);
    expect(catalogValueAt(merged, "home.title")).toBe("Accueil");
    expect(catalogValueAt(merged, "home.hero.cta")).toBe("Start");
    expect(catalogValueAt(merged, "home.hero.sub")).toBe("Apprendre");
    expect(catalogValueAt(merged, "news.title")).toBe("Actualités");
    expect(file.home.title).toBe("Home");
  });

  it("never turns a string into a subtree, or a subtree into a string", () => {
    const merged = applyOverrides(file, [
      { key: "footer.extra", value: "x" },
      { key: "home.hero", value: "flattened" },
    ]);
    expect(catalogValueAt(merged, "footer")).toBe("Footer");
    expect(catalogValueAt(merged, "home.hero.cta")).toBe("Start");
  });

  it("ignores a key that would reach the prototype or has an empty segment", () => {
    const merged = applyOverrides({}, [
      { key: "__proto__.polluted", value: "x" },
      { key: "a..b", value: "x" },
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged).toEqual({});
  });
});

describe("catalog files", () => {
  it("ships a file for exactly the four seeded languages, and nothing for the rest", async () => {
    expect(SUPPORTED_LOCALES.filter((l) => hasCatalogFile(l.code)).map((l) => l.code)).toEqual([
      "en",
      "es",
      "ar",
      "ur",
    ]);
    expect(await loadCatalogFile("fr")).toEqual({});
    expect(await loadCatalogFile("constructor")).toEqual({});
    expect(catalogValueAt(await loadCatalogFile("en"), "learn.difficulty.BEGINNER")).toBe(
      "Beginner",
    );
  });
});
