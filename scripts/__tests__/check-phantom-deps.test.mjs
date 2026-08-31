import { describe, expect, it } from "vitest";
import { findPhantomImports, run } from "../check-phantom-deps.mjs";

const pkg = {
  name: "@repo/example",
  dependencies: { zod: "^4.0.0" },
  devDependencies: { vitest: "^4.0.0" },
  peerDependencies: { react: "^19.0.0" },
};

describe("check:phantom-deps — findPhantomImports", () => {
  it("flags an import that is not declared anywhere", () => {
    const files = [{ path: "src/a.ts", source: `import { x } from "lodash";` }];
    expect(findPhantomImports(pkg, files)).toEqual([
      { file: "src/a.ts", specifier: "lodash" },
    ]);
  });

  it("accepts declared deps, devDeps, peerDeps, self-imports and builtins", () => {
    const files = [
      {
        path: "src/b.ts",
        source: [
          `import { z } from "zod";`,
          `import { describe } from "vitest";`,
          `import * as React from "react";`,
          `import { own } from "@repo/example/sub";`,
          `import { readFileSync } from "node:fs";`,
          `import path from "path";`,
          `import local from "./local";`,
          `import aliased from "@/components/thing";`,
        ].join("\n"),
      },
    ];
    expect(findPhantomImports(pkg, files)).toEqual([]);
  });

  it("resolves scoped specifiers to the package name", () => {
    const files = [{ path: "src/c.ts", source: `import "@tanstack/react-table";` }];
    expect(findPhantomImports(pkg, files)).toEqual([
      { file: "src/c.ts", specifier: "@tanstack/react-table" },
    ]);
  });

  it("catches dynamic imports and re-exports", () => {
    const files = [
      { path: "src/d.ts", source: `const m = await import("undeclared-pkg");` },
      { path: "src/e.ts", source: `export { thing } from "another-undeclared";` },
    ];
    const result = findPhantomImports(pkg, files);
    expect(result.map((r) => r.specifier).sort()).toEqual([
      "another-undeclared",
      "undeclared-pkg",
    ]);
  });
});

describe("check:phantom-deps — live workspace", () => {
  it("the real repo has no phantom imports", () => {
    expect(run()).toBe(0);
  });
});
