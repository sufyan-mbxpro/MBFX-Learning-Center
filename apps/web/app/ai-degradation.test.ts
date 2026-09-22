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
// changes-51: the AI screens are Settings → AI.
const AI_ROOT = join(APP_ROOT, "(admin)", "keystone", "settings", "ai");

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
  const usage = stripped(join(AI_ROOT, "(tabs)", "usage", "page.tsx"));

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
  const table = stripped(join(AI_ROOT, "(tabs)", "usage", "usage-table.tsx"));

  it("renders no prompt or completion column", () => {
    for (const forbidden of ["prompt", "completion", "output"]) {
      expect(table.toLowerCase(), `a "${forbidden}" column exists`).not.toContain(`colprompt`);
    }
    expect(table).not.toMatch(/row\.original\.(prompt|completion|output)\b/);
  });

  it("states the omission in one line, so nobody files it as a bug", () => {
    expect(stripped(join(AI_ROOT, "(tabs)", "usage", "page.tsx"))).toContain(
      'tAi("recentDescription")',
    );
  });
});

describe("B1 — the writing assistant is a PROP, not a flag", () => {
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "_components", "rich-text-editor.tsx"),
    "utf8",
  );
  const assistant = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "_components", "ai-assistant.tsx"),
    "utf8",
  );
  const articlePage = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "page.tsx"),
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

describe("B2 — auto-SEO reviews before it applies", () => {
  // `stripped`, not raw: the file's own comment has to NAME `ogImageUrl` in
  // order to explain why the dialog does not offer it, and a guard that trips
  // on its own explanation teaches the next reader to delete the explanation.
  const dialog = stripped(
    join(APP_ROOT, "(admin)", "keystone", "_components", "ai-seo-dialog.tsx"),
  );
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "article-editor.tsx"),
    "utf8",
  );

  it("ticks a field by default only when it is EMPTY", () => {
    // An admin who wrote a meta description should not lose it to an
    // unattended tick.
    expect(dialog).toContain('(current[key] ?? "").trim().length === 0');
  });

  it("offers no image field of any kind", () => {
    // security.md #9: an image "URL" text field is replaced by the upload
    // widget, not supplemented — and a model inventing an image URL is exactly
    // the SSRF-shaped input that rule exists to refuse.
    expect(dialog).not.toContain("ogImage");
    expect(dialog).not.toContain("imageUrl");
  });

  it("parses the model's answer with the form's own schema", () => {
    expect(dialog).toContain("seoSuggestionSchema.parse");
  });

  it("fills form fields and lets the editor's own Save persist them", () => {
    // ADR-097 #4 — nothing here writes to the database.
    expect(dialog).toContain("onApply(patch)");
    expect(dialog).not.toContain("Action(");
    expect(editor).toContain("onApply={(patch) => setTr(patch)}");
  });

  it("appears per FEATURE, so SEO can be on while the assistant is off", () => {
    const page = readFileSync(
      join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "page.tsx"),
      "utf8",
    );
    expect(page).toContain("availability.features.seo_generation");
    expect(page).toContain("availability.features.writing_assistant");
  });

  it("reaches the SEO section of every editor that has one, in the article's format", () => {
    const admin = join(APP_ROOT, "(admin)", "keystone");
    const editors: [string, string][] = [
      [join(admin, "learn", "courses", "[id]", "course-editor.tsx"), "courses.update"],
      [join(admin, "learn", "lessons", "[id]", "lesson-editor.tsx"), "lessons.update"],
      [join(admin, "learn", "videos", "[id]", "video-editor.tsx"), "lessons.update"],
      [join(admin, "glossary", "[id]", "glossary-editor.tsx"), "glossary.update"],
      [join(admin, "glossary", "topics", "[id]", "topic-editor.tsx"), "glossary.update"],
      [join(admin, "tools", "[key]", "tool-editor.tsx"), "tools.update"],
    ];
    const route = stripped(join(admin, "api", "ai", "run", "route.ts"));
    const seoRow = route.slice(route.indexOf("seo_generation: ["), route.indexOf("translation: ["));
    for (const [editor, key] of editors) {
      const source = stripped(editor);
      // In the SEO section's header, exactly where the article editor puts it.
      expect(source, relative(APP_ROOT, editor)).toContain("<AiSeoButton");
      expect(source, relative(APP_ROOT, editor)).toContain("actions={");
      // …and the run route accepts the key that saves that editor, or every
      // press would be refused.
      expect(seoRow, `seo_generation does not accept ${key}`).toContain(`"${key}"`);
    }
    const shared = stripped(join(admin, "_lib", "editor-ai.ts"));
    expect(shared).toContain("availability.features.seo_generation");
  });
});

describe("B3 — a machine translation says so until a human reads it", () => {
  const button = stripped(
    join(APP_ROOT, "(admin)", "keystone", "_components", "ai-translate-button.tsx"),
  );
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "article-editor.tsx"),
    "utf8",
  );
  const types = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "editor-types.ts"),
    "utf8",
  );

  it("never offers `slug` for translation", () => {
    // A slug change writes a Redirect and is an SEO act, so it stays a human
    // decision — and the prompt builder drops it even if a caller passes it.
    expect(types).toContain("TRANSLATABLE_FIELDS");
    const list = /TRANSLATABLE_FIELDS = \[([\s\S]*?)\]/.exec(types)?.[1] ?? "";
    expect(list).not.toContain("slug");
    expect(list).toContain("title");
  });

  it("applies only the fields it asked about", () => {
    // A model that invents a key must not reach a form field nobody offered it.
    expect(button).toContain("for (const name of Object.keys(fields))");
  });

  it("confirms before overwriting text a human wrote", () => {
    expect(button).toContain("ConfirmDialog");
    expect(editor).toContain("wouldOverwrite=");
  });

  it("clears the machine flag on any edit to a translatable field", () => {
    // What makes "has not been edited since" a fact rather than a hope — and
    // what makes a human's Save write TRANSLATED.
    expect(editor).toContain("TRANSLATABLE_FIELDS.some((field) => field in patch)");
  });

  it("writes no status itself — the flag rides with the SAVE", () => {
    expect(button).not.toContain("Action(");
    expect(editor).toContain("{ machineTranslated: true }");
  });

  it("is absent on the source locale, which has nothing to translate from", () => {
    expect(editor).toContain("locale !== defaultLocale");
  });
});

describe("B4 — the takeaways list is an ordinary field", () => {
  const field = stripped(
    join(APP_ROOT, "(admin)", "keystone", "_components", "takeaways-field.tsx"),
  );
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "articles", "[id]", "article-editor.tsx"),
    "utf8",
  );
  const articlePage = readFileSync(
    join(APP_ROOT, "(public)", "[locale]", "news", "[slug]", "page.tsx"),
    "utf8",
  );

  it("draws the FIELD unconditionally — only the Generate button is optional", () => {
    // ADR-097 / §2.2 #8: no field exists only because AI does. With AI off
    // this is a list an editor types.
    expect(editor).toContain("<TakeawaysField");
    expect(editor).not.toMatch(/ai\?\.summarize && \(\s*<TakeawaysField/);
    expect(field).toContain("{ai && (");
  });

  it("renders no AI badge on the public block", () => {
    // The proof of the same rule, one surface over: the page cannot tell where
    // the words came from, so neither can a reader.
    expect(articlePage).toContain("<KeyTakeaways");
    expect(articlePage).not.toMatch(/KeyTakeaways[^>]*generated/);
    expect(articlePage).not.toMatch(/KeyTakeaways[^>]*byAi/);
  });

  it("renders the block only when the list is non-empty", () => {
    expect(articlePage).toContain("view.keyTakeaways.length > 0");
  });

  it("parses the model's answer with the form's own schema", () => {
    expect(field).toContain("summarySuggestionSchema.parse");
  });

  it("writes nothing itself — the editor's Save persists the list", () => {
    expect(field).not.toContain("Action(");
    expect(field).toContain("onChange(result.keyTakeaways");
  });
});

describe("B5 — alt text is written by a person (ADR-153)", () => {
  const keystone = join(APP_ROOT, "(admin)", "keystone");
  const library = stripped(join(keystone, "_components", "media-library.tsx"));
  const page = stripped(join(keystone, "media", "page.tsx"));
  const actions = stripped(join(keystone, "_actions", "ai-actions.ts"));
  const features = stripped(join(keystone, "settings", "ai", "(tabs)", "features", "page.tsx"));
  // Stripped: the service's own comments have to NAME `sharp` and
  // `Promise.all` in order to explain why neither is used, and a guard that
  // trips on its own explanation teaches the next reader to delete it.
  const service = stripped(
    resolve(process.cwd(), "..", "..", "packages", "core", "src", "ai-media.ts"),
  );

  it("offers no AI alt-text control anywhere in the media screens", () => {
    // The owner withdrew it (2026-09-22). The service is retained, unreached.
    expect(() => statSync(join(keystone, "media", "alt-text-review.tsx"))).toThrow();
    for (const source of [library, page, actions]) {
      expect(source).not.toMatch(/suggestAltText|AltTextReview|altTextFieldLabels/);
    }
  });

  it("hides the alt_text switch, which would otherwise save and change nothing", () => {
    expect(features).toContain('card.key !== "alt_text"');
  });

  it("the retained service still writes nothing itself", () => {
    expect(service).not.toContain("mediaAsset.update");
  });

  it("reads bytes in core and never hands the model a URL", () => {
    // security.md #9 restated for a client that would happily follow one.
    expect(service).toContain("readStoredFile(");
    // A plain substring, not a regex: the claim is that this service makes no
    // HTTP call at all, which `fetch(` says more directly than a word-boundary
    // escape would — and a hand-written escape is how a literal control
    // character reached this file twice while the guard was being written.
    expect(service).not.toContain("fetch(");
    expect(service).toContain("imageBase64");
  });

  it("refuses an oversize image honestly rather than adding an image library", () => {
    // Adding `sharp` to downscale is a supply-chain decision (security.md #15),
    // not a convenience.
    expect(service).toContain("AI_ALT_TEXT_MAX_BYTES");
    expect(service).toContain('reason: "content_too_large"');
    expect(service).not.toContain("sharp");
  });

  it("generates one at a time, so a bulk run cannot outrun the cap", () => {
    expect(service).not.toContain("Promise.all");
    expect(service).toContain("for (const asset of assets)");
  });
});

describe("B6 — a generated quiz is unsaved until somebody saves it", () => {
  const dialog = stripped(
    join(APP_ROOT, "(admin)", "keystone", "_components", "ai-quiz-dialog.tsx"),
  );
  const editor = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "learn", "quizzes", "[id]", "quiz-editor.tsx"),
    "utf8",
  );
  const page = readFileSync(
    join(APP_ROOT, "(admin)", "keystone", "learn", "quizzes", "[id]", "page.tsx"),
    "utf8",
  );

  it("calls no save action of its own", () => {
    // The whole of ADR-097 #4 at the one place a quiz makes it tempting to
    // break: a parent row plus N questions plus M options is more than a form
    // holds comfortably, and "write it as a DRAFT" is the shortcut.
    expect(dialog).not.toContain("saveQuizAction");
    expect(dialog).not.toContain("Action(");
  });

  it("hands accepted questions to the editor's own state", () => {
    expect(dialog).toContain("onAdd(");
    expect(editor).toContain("questions: [");
    expect(editor).toContain("<AiQuizButton");
  });

  it("parses the answer with the quiz schema, which refuses a stray correctIndex", () => {
    expect(dialog).toContain("quizSuggestionSchema.parse");
  });

  it("shows which option is correct, because a review that cannot see it is a guess", () => {
    expect(dialog).toContain("optionIndex === row.correctIndex");
  });

  it("is absent without a published lesson to build from", () => {
    // A standalone quiz has no source. Absence, not a disabled button.
    expect(page).toContain("getQuizSourceLesson(");
    expect(page).toContain("sourceLesson");
    expect(page).toContain('can(subject, "lessons.update")');
    expect(page).toContain('can(subject, "ai.use")');
  });

  it("puts the generated explanation on the CORRECT option and nowhere else", () => {
    // The editor stores explanations positionally, so an explanation written
    // for the right answer must not land under a wrong one.
    expect(editor).toContain("index === question.correctIndex");
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

describe("ADR-126 — a brief fills the form, and nothing is saved until Save", () => {
  const admin = join(APP_ROOT, "(admin)", "keystone");
  const fill = stripped(join(admin, "_components", "ai-fill.tsx"));
  const editorAi = stripped(join(admin, "_lib", "editor-ai.ts"));
  const route = stripped(join(admin, "api", "ai", "run", "route.ts"));

  it("writes nothing: the fill component imports no server action", () => {
    // ADR-097 #4. The review dialog hands the editor a patch; the editor's own
    // Save, schema and permission check persist it.
    expect(fill).not.toContain("_actions/");
    expect(fill).toContain("onApply(patch)");
  });

  it("ticks a suggested field by default only when it is empty", () => {
    expect(fill).toContain('(current[key] ?? "").trim().length === 0');
  });

  it("parses with schemas derived from the field registry", () => {
    expect(fill).toContain("aiFormSuggestionSchema(module)");
    expect(fill).toContain("aiFieldSuggestionSchema(definition)");
  });

  it("never takes HTML from the model — our code writes the markup", () => {
    expect(fill).toContain("aiBlocksToHtml(");
    expect(fill).not.toContain("innerHTML");
  });

  it("omits an action with nothing to work on, rather than greying it", () => {
    expect(fill).toContain('action === "regenerate" || hasValue');
  });

  it("resolves availability on the server, gated on ai.use and the content key", () => {
    expect(editorAi).toContain("getAiAvailability()");
    expect(editorAi).toContain('can(subject, "ai.use")');
    expect(editorAi).toContain("canAny(subject, contentKeys)");
    expect(editorAi).toContain("availability.features.form_fill");
    expect(editorAi).not.toContain('"use client"');
  });

  it("gates form fill on the MODULE's own key, for every module", async () => {
    const { AI_FILL_MODULES } = await import("@repo/contracts");
    expect(route).toContain("requireFillModule(subject, fill.module)");
    for (const fillModule of AI_FILL_MODULES) {
      expect(route, `no permission row for "${fillModule}"`).toContain(`  ${fillModule}: [`);
    }
  });

  it("reaches every editor page", () => {
    const pages = [
      join(admin, "learn", "courses", "[id]", "page.tsx"),
      join(admin, "learn", "lessons", "[id]", "page.tsx"),
      join(admin, "learn", "videos", "[id]", "page.tsx"),
      join(admin, "learn", "quizzes", "[id]", "page.tsx"),
      join(admin, "glossary", "[id]", "page.tsx"),
      join(admin, "glossary", "topics", "[id]", "page.tsx"),
      join(admin, "tools", "[key]", "page.tsx"),
    ];
    for (const page of pages) {
      expect(stripped(page), relative(APP_ROOT, page)).toContain("loadEditorAi(subject");
    }
    const article = stripped(join(admin, "articles", "[id]", "page.tsx"));
    expect(article).toContain("availability.features.form_fill");
  });
});

describe("the AI Writer (ADR-129)", () => {
  const admin = join(APP_ROOT, "(admin)", "keystone");
  const shell = stripped(join(admin, "_components", "admin-shell.tsx"));
  const writer = stripped(join(admin, "_components", "ai-writer.tsx"));
  const route = stripped(join(admin, "api", "ai", "run", "route.ts"));

  it("is mounted by the shell only when ai.use AND the feature are available", () => {
    expect(shell).toContain('can(subject, "ai.use")');
    expect(shell).toContain("availability.features.writing_studio === true");
    expect(shell).toMatch(/\{writerOn && \(\s*<AiWriter/);
  });

  it("disables nothing on availability — its absence is the answer", () => {
    for (const forbidden of [/disabled=\{[^}]*\bwriterOn\b/, /disabled=\{[^}]*\bavailab/]) {
      expect(writer).not.toMatch(forbidden);
    }
  });

  it("is gated on ai.use alone, stated as an explicit null rather than an empty list", () => {
    // `canAny(subject, [])` refuses, so an empty list would lock everyone out;
    // a missing check would be silent. `null` plus the early return is neither.
    expect(route).toContain("writing_studio: null");
    expect(route).toContain("if (permissions === null) return;");
  });

  it("runs each studio action on its own tier", () => {
    expect(route).toContain("AI_STUDIO_ACTIONS.find");
  });

  it("writes nothing: no server action, no save, only the one run endpoint", () => {
    expect(writer).not.toContain("_actions/");
    expect(writer).toContain('feature: "writing_studio"');
  });
});
