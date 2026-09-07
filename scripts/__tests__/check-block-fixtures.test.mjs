import { describe, expect, it } from "vitest";
import { checkBlockFixtures, extractRegisteredBlockFolders } from "../check-block-fixtures.mjs";

const AXE_SOURCE = [
  'import sectionFixture from "./section/fixture.json" with { type: "json" };',
  'import headingFixture from "./heading/fixture.json" with { type: "json" };',
].join("\n");

function fileSetExists(files) {
  const set = new Set(files);
  return (rel) => set.has(rel);
}

describe("check:block-fixtures — a fully wired block set", () => {
  it("passes when every folder has definition.ts + fixture.json + an axe-fixture import", () => {
    const problems = checkBlockFixtures({
      folders: ["section", "heading"],
      fileExists: fileSetExists([
        "section/definition.ts",
        "section/fixture.json",
        "heading/definition.ts",
        "heading/fixture.json",
      ]),
      axeFixtureSource: AXE_SOURCE,
    });
    expect(problems).toEqual([]);
  });
});

describe("check:block-fixtures — the drifts it exists to catch", () => {
  it("a registered block with no fixture.json", () => {
    const problems = checkBlockFixtures({
      folders: ["section"],
      fileExists: fileSetExists(["section/definition.ts"]),
      axeFixtureSource: AXE_SOURCE,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("no fixture.json");
  });

  it("a registered block with no definition.ts", () => {
    const problems = checkBlockFixtures({
      folders: ["section"],
      fileExists: fileSetExists(["section/fixture.json"]),
      axeFixtureSource: AXE_SOURCE,
    });
    expect(problems.some((p) => p.includes("no definition.ts"))).toBe(true);
  });

  it("a block with files on disk but no axe-fixture.tsx entry", () => {
    const problems = checkBlockFixtures({
      folders: ["section"],
      fileExists: fileSetExists(["section/definition.ts", "section/fixture.json"]),
      axeFixtureSource: "// no imports here",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not imported in axe-fixture.tsx");
  });
});

describe("check:block-fixtures — source parsing", () => {
  it("extracts block folder names from blocks-list.ts side-effect imports", () => {
    const source = ['import "./section/index.tsx";', 'import "./rich-text/index.tsx";'].join("\n");
    expect(extractRegisteredBlockFolders(source)).toEqual(["section", "rich-text"]);
  });

  it("returns an empty array (not null) when nothing matches — main() treats that as a parse failure", () => {
    expect(extractRegisteredBlockFolders("nothing here")).toEqual([]);
  });
});
