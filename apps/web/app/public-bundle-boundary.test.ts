// architecture.md #5 — **the admin-bundle-leak backstop**, and Module 14's
// launch-gate item "no AI client code reaches a public route".
//
// ADR-006 put both surfaces in ONE Next.js app with ONE dependency graph. The
// rule that keeps the public site light is a discipline with nothing enforcing
// it: nothing under `app/(public)` may import from `app/(admin)` or from an
// admin-only dependency. Until this file there was no check — the plan named
// "blocking Lighthouse budgets on public routes" as the backstop, and
// `e2e/public/tools-budget.spec.ts` records why a runtime check cannot see
// this: Turbopack's dev chunk names are hashed and carry no source filename,
// so a bundle assertion passes even when a module HAS leaked in.
//
// So it is checked where it can actually be seen — in the imports. This is a
// guard that can fail, which is the only kind worth having: verified by adding
// `import { EditorContent } from "@tiptap/react"` to `tools/_components/
// tool-combobox.tsx` and watching it name that file.
//
// **Transitive within `@repo/ui`**, because that is where the risk lives: a
// public page imports `@repo/ui/components/x`, and it is `x` that pulls in the
// editor. Granular exports (architecture.md #9) are what make that traceable,
// and following them one package deep is the difference between a guard and a
// formality. It does NOT follow into every other package — noted honestly
// rather than implied.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");
const PUBLIC_ROOT = join(APP_ROOT, "(public)");
const UI_SRC = resolve(process.cwd(), "..", "..", "packages", "ui", "src");

/**
 * What a public route may not reach, and why each one is here.
 *
 * Every entry is weight, surface, or both — not a matter of taste. A new
 * admin-only dependency belongs on this list in the PR that adds it.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    pattern: /["']@repo\/ai["']|["']@repo\/ai\//,
    why: "Module 18's provider SDKs. ADR-097: `@repo/ai` sits beside `@repo/email`, below `core`, and nothing on a public path may pull two provider SDKs into the graph. It is also the launch-gate item — AI code has no business in a visitor's bundle.",
  },
  {
    pattern: /["']@tiptap\//,
    why: "the rich-text editor — the single heaviest admin dependency (architecture.md #5 names it first).",
  },
  {
    pattern: /["']@tanstack\/react-table["']/,
    why: "the admin DataTable. A public listing is server-rendered markup, not a client table.",
  },
  {
    pattern: /["']recharts["']/,
    why: "charting. `risk-sentiment.tsx` already records the reasoning: one sparkline on one path is not worth 40kB of recharts.",
  },
  {
    pattern: /from\s+["'][^"']*\(admin\)/,
    why: "app/(admin) itself (architecture.md #5). The two surfaces share packages, never each other's screens.",
  },
  {
    pattern: /["']@repo\/db["']/,
    why: "Prisma. architecture.md #2: the app calls `@repo/core`, never the database — and a public component is the last place that should change.",
  },
];

function filesUnder(dir: string, extensions = [".ts", ".tsx"]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full, extensions);
    return extensions.some((ext) => full.endsWith(ext)) && !full.includes(".test.") ? [full] : [];
  });
}

/** The source with comments removed — every pattern here is one a comment names. */
function stripped(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

/**
 * The `@repo/ui` modules a file imports, resolved to source paths.
 *
 * `@repo/ui/components/card` → `packages/ui/src/components/card.tsx`, which is
 * exactly what the package's granular exports map promises. A specifier that
 * does not resolve is skipped rather than failed: this guard is about what a
 * public page reaches, and a broken import is typecheck's job.
 */
function uiSourcesImportedBy(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/["']@repo\/ui\/([^"']+)["']/g)) {
    const subpath = match[1]!;
    for (const candidate of [`${subpath}.tsx`, `${subpath}.ts`, join(subpath, "index.ts")]) {
      const full = join(UI_SRC, candidate);
      try {
        if (statSync(full).isFile()) {
          out.push(full);
          break;
        }
      } catch {
        // Not this extension — try the next.
      }
    }
  }
  return out;
}

describe("nothing admin-only reaches the public surface", () => {
  const publicFiles = filesUnder(PUBLIC_ROOT);

  it("finds public files to check at all", () => {
    // The guard's own smoke test. A walk that silently returns nothing is a
    // green check that proves the opposite of what it claims.
    expect(publicFiles.length).toBeGreaterThan(50);
  });

  it("imports none of it directly", () => {
    const leaks: string[] = [];
    for (const file of publicFiles) {
      const source = stripped(file);
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(source)) {
          leaks.push(`${file.slice(APP_ROOT.length + 1)} imports ${why}`);
        }
      }
    }
    expect(leaks, "admin-only imports on the public surface").toEqual([]);
  });

  it("imports none of it through a @repo/ui component either", () => {
    // One package deep, following the granular exports. Each @repo/ui module a
    // public file names is checked, then the modules IT names, and so on —
    // within `packages/ui` only.
    const queue = publicFiles.flatMap((file) => uiSourcesImportedBy(stripped(file)));
    const visited = new Set<string>();
    const leaks: string[] = [];

    while (queue.length > 0) {
      const file = queue.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);

      const source = stripped(file);
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(source)) {
          leaks.push(`@repo/ui/${file.slice(UI_SRC.length + 1)} imports ${why}`);
        }
      }
      queue.push(...uiSourcesImportedBy(source));
    }

    expect(
      visited.size,
      "no @repo/ui modules were followed — the resolver is broken",
    ).toBeGreaterThan(10);
    expect(leaks, "admin-only imports reached through @repo/ui").toEqual([]);
  });
});
