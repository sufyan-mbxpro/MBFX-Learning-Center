// changes-29 §12 #5 — **nothing renders an AI result as HTML.**
//
// A generated suggestion is rendered as TEXT until a human saves it, at which
// point it goes through the same save action, the same Zod schema and the same
// `sanitizeRichText` as anything else an editor types. So a `<script>` in a
// suggestion arrives as visible characters, and a prompt injection's best case
// is a bad suggestion an admin reads and discards.
//
// Read as source for the same reason `ai-degradation.test.ts` is: the app has
// no jsdom runner, and the claim is about which APIs the AI path uses.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");
const AI_ROOT = join(APP_ROOT, "(admin)", "admin", "ai");
const AI_ROUTE = join(APP_ROOT, "(admin)", "admin", "api", "ai");
const AI_ACTIONS = join(APP_ROOT, "(admin)", "admin", "_actions", "ai-actions.ts");
const AI_PACKAGE = resolve(process.cwd(), "..", "..", "packages", "ai", "src");

const stripped = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(full) && !full.endsWith(".test.ts") ? [full] : [];
  });
}

const AI_FILES = [...filesUnder(AI_ROOT), ...filesUnder(AI_ROUTE), AI_ACTIONS];

describe("no AI path reaches dangerouslySetInnerHTML", () => {
  it("has files to check", () => {
    expect(AI_FILES.length).toBeGreaterThan(5);
  });

  it("renders every AI-touched surface as text", () => {
    for (const file of AI_FILES) {
      expect(
        stripped(file),
        `${relative(APP_ROOT, file)} renders AI-adjacent content as HTML`,
      ).not.toContain("dangerouslySetInnerHTML");
    }
  });
});

describe("a provider message never reaches a screen", () => {
  const files = [...filesUnder(AI_ROUTE), AI_ACTIONS];

  it("returns a taxonomy reason, never error.message", () => {
    // A provider error can quote the request — and therefore the prompt — back
    // at us. The taxonomy is a closed union of our own strings.
    for (const file of files) {
      const source = stripped(file);
      const name = relative(APP_ROOT, file);
      expect(source, `${name} leaks a provider message into a response`).not.toMatch(
        /error:\s*\w*[eE]rror\.message/,
      );
    }
  });

  it("stores a reason on the provider row, not a message", () => {
    const admin = readFileSync(
      resolve(process.cwd(), "..", "..", "packages", "core", "src", "ai-admin.ts"),
      "utf8",
    );
    expect(admin).toContain("lastTestError: result.ok ? null : result.reason");
  });
});

describe("the package's own surface", () => {
  it("keeps the log's columns free of any body field", () => {
    const usage = readFileSync(join(AI_PACKAGE, "usage.ts"), "utf8");
    // The schema has no such column, and this is the second lock: a future
    // `prompt` or `completion` field would have to get past it.
    for (const forbidden of ["prompt:", "completion:", "responseText", "promptText"]) {
      expect(usage, `usage.ts writes ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("declares no tool use, in either driver", () => {
    // ADR-097 #12: no tool use, no web search, no code execution, in either
    // phase. A model with no tools cannot be persuaded to use one.
    for (const driver of ["anthropic.ts", "openai.ts"]) {
      const source = stripped(join(AI_PACKAGE, "drivers", driver));
      expect(source, `${driver} declares tools`).not.toMatch(/\btools\s*:/);
      expect(source, `${driver} declares tool_choice`).not.toContain("tool_choice");
      expect(source, `${driver} enables web search`).not.toContain("web_search");
    }
  });

  it("never fetches a URL for the model", () => {
    // security.md #9 restated for a client that would happily follow one:
    // B5 sends bytes we already hold, read through `readStoredFile` in core.
    for (const driver of ["anthropic.ts", "openai.ts"]) {
      const source = stripped(join(AI_PACKAGE, "drivers", driver));
      expect(source, `${driver} fetches on the model's behalf`).not.toMatch(/\bawait fetch\(/);
    }
    // The one URL shape that IS allowed is a data: URL of bytes we hold.
    expect(stripped(join(AI_PACKAGE, "drivers", "openai.ts"))).toContain("data:${image.mimeType}");
  });
});
