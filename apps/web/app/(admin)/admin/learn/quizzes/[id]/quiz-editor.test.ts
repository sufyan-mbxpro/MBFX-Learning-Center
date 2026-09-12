// Regression (changes-22): saving a quiz and moving it to In review left the
// publishing panel showing "Draft" and the Draft-era buttons until a hard
// reload.
//
// The cause was one word. `useServerAction` calls `router.refresh()` after a
// transition, which re-renders this screen's server component and hands the
// editor a fresh `initial` prop — but `QuizEditor` does `useState(initial)`
// and passed `state.status` to the panel, and that state is the first
// snapshot, forever. The other four editors on `ContentStatusPanel`
// (glossary, course, lesson, video) read these five facts straight from their
// props and were already correct.
//
// None of the five is editable on this screen, so none belongs in editor
// state. Read as source: the editor is a client component whose behaviour
// under `router.refresh()` needs a router, a server component and a database
// to observe — while the property that actually broke is visible in one line.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = await readFile(new URL("./quiz-editor.tsx", import.meta.url), "utf8");

/** The props whose value the server owns and this editor only displays. */
const SERVER_OWNED = [
  "status",
  "legalTransitions",
  "publishedAt",
  "scheduledFor",
  "updatedAt",
] as const;

describe("QuizEditor's publishing panel reads the server's copy, not a snapshot", () => {
  const panel = source.slice(source.indexOf("<ContentStatusPanel"));

  for (const prop of SERVER_OWNED) {
    it(`passes ${prop} from \`initial\`, so a refresh updates it`, () => {
      expect(panel).toContain(`${prop}={initial.${prop}}`);
      expect(panel).not.toContain(`${prop}={state.${prop}}`);
    });
  }
});
