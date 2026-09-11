// Every export of a `"use server"` module must be an async function.
//
// Next.js turns each export of such a module into a callable server action,
// so a synchronous exported helper is a hard compile error ("Server Actions
// must be async functions") — one that takes the WHOLE app down, public
// routes included, not just the admin screen that owns the file.
//
// Neither of the usual gates catches it: `tsc --noEmit` sees a perfectly
// valid function, and no lint rule models the directive. It surfaces only
// when the bundler reaches the route, which is why a shared sync helper
// (`readUploadCategory`, colocated in `_actions/media-actions.ts`) shipped
// into the working tree and 500'd every page until it was moved to
// `_lib/media-upload.ts`.
//
// Read as source, following `admin-dialog-conventions.test.ts`: the property
// under test is a syntactic one, and importing these modules would mean
// standing up a database and a session to assert how they were declared.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// The directive only applies to a whole module when it heads the file. An
// inline `"use server"` inside a single function body is a different feature
// and puts no constraint on the module's other exports.
const useServerFiles = sourceFiles(APP_ROOT).filter((path) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["'];/.test(readFileSync(path, "utf8")),
);

/** `export function f()` — an exported declaration that is not async. */
const SYNC_FUNCTION = /^export\s+function\s+(\w+)/gm;
/** `export const f = () => …` / `= function …` without `async`. */
const SYNC_CONST_FUNCTION =
  /^export\s+const\s+(\w+)\s*(?::[^=\n]+)?=\s*(?!async\b)(?:function\b|\([^)]*\)\s*(?::[^=\n]+)?=>)/gm;

function syncExportsIn(source: string): string[] {
  return [
    ...[...source.matchAll(SYNC_FUNCTION)].map((m) => m[1]),
    ...[...source.matchAll(SYNC_CONST_FUNCTION)].map((m) => m[1]),
  ].filter((name): name is string => name !== undefined);
}

describe('every export of a "use server" module is async', () => {
  it('finds "use server" modules to check at all', () => {
    // Guards the guard: a moved app root or a changed directive style would
    // otherwise turn this suite into a silently-passing empty loop.
    expect(useServerFiles.length).toBeGreaterThan(5);
  });

  it.each(useServerFiles.map((path) => [path.slice(APP_ROOT.length + 1), path]))(
    "%s exports only async functions",
    (_label, path) => {
      // A non-async export here is a build-breaking error, not a style nit:
      // move the helper to a plain module (`_lib/*`) and import it from both.
      expect(syncExportsIn(readFileSync(path, "utf8"))).toEqual([]);
    },
  );
});
