#!/usr/bin/env node
// Module 16, plan v2.2 §6.2/§13 — every block ships with a `fixture.json`
// and an entry in the all-blocks axe fixture page (ADR-024 §4). Parses the
// TS source as text (the same approach check-reserved-paths.mjs and
// check-permission-keys.mjs use) rather than importing it, since this is a
// plain Node script with no TS loader.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const BLOCKS_SRC = join(ROOT, "packages", "blocks", "src");

/** Block folder names registered in blocks-list.ts, e.g. `import "./rich-text/index.tsx";` -> "rich-text". */
export function extractRegisteredBlockFolders(blocksListSource) {
  return [...blocksListSource.matchAll(/import\s+"\.\/([a-z0-9-]+)\/index\.tsx"/g)].map(
    (m) => m[1],
  );
}

/** Returns an array of human-readable problems; empty means every block is fully wired. */
export function checkBlockFixtures({ folders, fileExists, axeFixtureSource }) {
  const problems = [];
  for (const folder of folders) {
    if (!fileExists(`${folder}/definition.ts`)) {
      problems.push(`Block "${folder}" has no definition.ts.`);
    }
    if (!fileExists(`${folder}/fixture.json`)) {
      problems.push(`Block "${folder}" has no fixture.json.`);
    }
    if (!axeFixtureSource.includes(`./${folder}/fixture.json`)) {
      problems.push(`Block "${folder}" is not imported in axe-fixture.tsx.`);
    }
  }
  return problems;
}

function main() {
  const blocksListSource = readFileSync(join(BLOCKS_SRC, "blocks-list.ts"), "utf8");
  const axeFixtureSource = readFileSync(join(BLOCKS_SRC, "axe-fixture.tsx"), "utf8");
  const folders = extractRegisteredBlockFolders(blocksListSource);

  if (folders.length === 0) {
    console.error(
      "check:block-fixtures FAILED — could not parse packages/blocks/src/blocks-list.ts.\n" +
        "  The source layout changed; update scripts/check-block-fixtures.mjs.",
    );
    process.exit(1);
  }

  const problems = checkBlockFixtures({
    folders,
    fileExists: (rel) => existsSync(join(BLOCKS_SRC, rel)),
    axeFixtureSource,
  });

  if (problems.length > 0) {
    console.error("check:block-fixtures FAILED —");
    for (const problem of problems) console.error(`  • ${problem}`);
    process.exit(1);
  }

  console.log(`check:block-fixtures — OK. ${folders.length} blocks fully wired.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
