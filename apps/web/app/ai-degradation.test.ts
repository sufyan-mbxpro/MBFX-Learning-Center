// ADR-097 #6 / changes-29 §13 — **the CMS without AI.**
//
// Read as SOURCE, like `newsletter-signup.test.ts` and
// `admin-form-conventions.test.ts`: the app has no jsdom runner (component
// tests live in `packages/ui`), and what matters here is a property of the
// markup and the data flow rather than of a render.
//
// **The first group is the one this file exists for.** "Disabled, capped or
// unconfigured means ABSENT, not disabled" is the rule a future PR will
// reintroduce by accident — a greyed "Generate" with no explanation is a
// support ticket, and it is the obvious thing to write when a feature switch
// arrives as a boolean prop. `newsletter-signup.test.ts` guards the same
// failure one surface over, and for the same reason: the placeholder was there
// for months and looked finished.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");
const AI_ROOT = join(APP_ROOT, "(admin)", "admin", "ai");

const raw = (path: string) => readFileSync(path, "utf8");

/**
 * The file with its comments removed.
 *
 * Every "this must not appear" assertion reads this rather than the raw source,
 * because the things being forbidden — `disabled`, `dangerouslySetInnerHTML` —
 * are exactly the things the surrounding comments have to NAME in order to
 * explain why they are gone. A guard that trips on its own explanation teaches
 * the next reader to delete the explanation.
 */
const stripped = (path: string) =>
  raw(path)
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

const AI_SCREENS = filesUnder(AI_ROOT);

describe("an AI affordance is ABSENT, never disabled", () => {
  it("has AI screens to check", () => {
    // A guard that silently matches nothing is worse than no guard.
    expect(AI_SCREENS.length).toBeGreaterThan(5);
  });

  it("gates no AI control on a `disabled` prop tied to availability", () => {
    // `disabled={pending}` is the submit button waiting on its own action, and
    // is fine. What must never appear is a control disabled because AI is off,
    // the feature is off, or the budget is spent.
    for (const file of AI_SCREENS) {
      const source = stripped(file);
      const name = relative(APP_ROOT, file);
      for (const forbidden of [
        /disabled=\{[^}]*\benabled\b/,
        /disabled=\{[^}]*\bavailability\b/,
        /disabled=\{[^}]*\bcapped\b/,
        /disabled=\{[^}]*\bbudget\b/,
        /disabled=\{[^}]*\bai\.enabled\b/,
      ]) {
        expect(source, `${name} disables a control on AI availability`).not.toMatch(forbidden);
      }
    }
  });

  it("answers availability on the SERVER, in one place", () => {
    const availability = readFileSync(
      resolve(process.cwd(), "..", "..", "packages", "ai", "src", "availability.ts"),
      "utf8",
    );
    // The answer arrives as the absence of a prop, so an AI-off install ships
    // no AI client code into the editor bundle at all.
    expect(availability).toContain("getAiAvailability");
    expect(availability).not.toContain('"use client"');
  });

  it("folds the global switch and the cap INTO each feature's boolean", () => {
    // The failure this shape prevents: a page rendering an affordance because
    // its feature is on, on a platform whose cap was reached an hour ago.
    const availability = readFileSync(
      resolve(process.cwd(), "..", "..", "packages", "ai", "src", "availability.ts"),
      "utf8",
    );
    expect(availability).toMatch(/if\s*\(enabled\)/);
  });
});

describe("the four states have somewhere to be said", () => {
  const usage = stripped(join(AI_ROOT, "page.tsx"));

  it("says when AI is off", () => {
    expect(usage).toContain('tAi("off")');
  });

  it("says when the budget is capped, and what stops", () => {
    expect(usage).toContain('tAi("budgetCapped")');
    expect(usage).toContain("budgetCappedBody");
  });

  it("distinguishes DISABLE from NOTIFY_ONLY rather than saying one thing", () => {
    // They are different promises: one stops work, the other only warns.
    expect(usage).toContain("budgetCappedNotifyOnly");
  });

  it("says when no real provider is configured", () => {
    expect(usage).toContain('tAi("noProvider")');
  });
});

describe("the usage log holds no bodies, and the screen says so", () => {
  const table = stripped(join(AI_ROOT, "usage-table.tsx"));

  it("renders no prompt or completion column", () => {
    for (const forbidden of ["prompt", "completion", "output"]) {
      expect(table.toLowerCase(), `a "${forbidden}" column exists`).not.toContain(`colprompt`);
    }
    expect(table).not.toMatch(/row\.original\.(prompt|completion|output)\b/);
  });

  it("states the omission in one line, so nobody files it as a bug", () => {
    expect(stripped(join(AI_ROOT, "page.tsx"))).toContain('tAi("recentDescription")');
  });
});

describe("B1 — the writing assistant is a PROP, not a flag", () => {
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "admin", "_components", "rich-text-editor.tsx"),
    "utf8",
  );
  const assistant = readFileSync(
    join(APP_ROOT, "(admin)", "admin", "_components", "ai-assistant.tsx"),
    "utf8",
  );
  const articlePage = readFileSync(
    join(APP_ROOT, "(admin)", "admin", "articles", "[id]", "page.tsx"),
    "utf8",
  );

  it("takes an optional `ai` object, never an `aiEnabled` boolean", () => {
    // A boolean is what invites `disabled={!aiEnabled}`. An absent prop cannot
    // be rendered as a greyed control, which is the whole mechanism.
    expect(editor).toContain("ai?: {");
    expect(editor).not.toMatch(/aiEnabled\s*[?:]/);
  });

  it("renders the menu and the panel only when the prop is present", () => {
    expect(editor).toContain("{ai && (");
    expect(editor).toContain("<AiAssistantMenu");
    expect(editor).toContain("<AiResultPanel");
  });

  it("omits an assistant action that needs a selection, rather than greying it", () => {
    // §2.2 #11 applies inside a toolbar too.
    expect(assistant).toContain("!action.needsSelection || hasSelection");
    expect(assistant).not.toMatch(/disabled=\{!hasSelection\}/);
  });

  it("resolves availability on the server and gates on `ai.use` too", () => {
    expect(articlePage).toContain("getAiAvailability()");
    expect(articlePage).toContain('can(subject, "ai.use")');
    // Folded with the global switch and the budget inside `getAiAvailability`,
    // so the page reads one boolean rather than three.
    expect(articlePage).toContain("availability.features.writing_assistant");
  });

  it("sends the selection as TEXT and inserts the result as text", () => {
    // Tiptap's marks are class-based because the stock extensions emit inline
    // styles the sanitizer strips (ADR-046) — a model asked for HTML would
    // produce formatting that silently disappears on save.
    expect(assistant).toContain("textBetween(");
    expect(editor).toContain("insertContent(text)");
    expect(assistant).not.toContain("getHTML()");
  });

  it("never auto-inserts — the panel's buttons are the only way in", () => {
    // ADR-097 #4: the model suggests, the admin decides where the text goes.
    expect(editor).toContain("onInsert=");
    expect(editor).toContain("onReplace=");
    expect(editor).toContain("onDiscard=");
  });
});

describe("the sealed key reaches no screen", () => {
  it("names apiKey only as a write-only form field, never as a rendered value", () => {
    for (const file of AI_SCREENS) {
      const source = stripped(file);
      const name = relative(APP_ROOT, file);
      // `hasApiKey` is the only thing a screen is told (ADR-098 (b)).
      expect(source, `${name} reads apiKeyCipher`).not.toContain("apiKeyCipher");
      expect(source, `${name} renders a stored key`).not.toMatch(/\{\s*provider\.apiKey\s*\}/);
    }
  });

  it("distinguishes 'no key saved' from 'a key is saved' in the placeholder", () => {
    // An empty box with no caption cannot say which, and the difference decides
    // whether leaving it alone is safe.
    const form = stripped(join(AI_ROOT, "providers", "provider-form.tsx"));
    expect(form).toContain("apiKeySaved");
    expect(form).toContain("apiKeyEmpty");
  });
});
