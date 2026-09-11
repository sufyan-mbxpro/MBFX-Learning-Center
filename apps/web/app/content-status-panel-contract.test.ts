// Publish must actually publish (changes-18 PR 1).
//
// `ContentStatusPanel` used to take one callback, `submitForm(thenTransitionTo?)`,
// and every editor was expected to honour the argument. Two of the five did
// not: `glossary-editor.tsx` and `video-editor.tsx` declared `async ()`,
// dropped it, and turned Publish into a plain save that reported success and
// left the status where it was. A term could sit at APPROVED forever while the
// editor said it had saved.
//
// TypeScript could not catch it — a zero-parameter function is assignable to a
// one-parameter type — so the fix was to change the SHAPE: the panel now takes
// `save` and `transitionTo` separately and sequences them itself, which makes
// the old bug unrepresentable. This guard exists to stop the contract drifting
// back: a caller that re-introduces a one-callback `submitForm=` prop is
// re-introducing something a caller can forget.
//
// Read as source rather than rendered, following `admin-dialog-conventions.test.ts`:
// these live inside client components whose parents are async server components
// awaiting a session, and `apps/web` has no jsdom environment. A real
// click-through belongs to the E2E suite Module 14 already owes these screens.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "app/(admin)");
const PANEL = resolve(ADMIN_ROOT, "admin/_components/editor/content-status-panel.tsx");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const callSites = tsxFiles(ADMIN_ROOT)
  .filter((path) => path !== PANEL)
  .filter((path) => readFileSync(path, "utf8").includes("<ContentStatusPanel"))
  .map((path) => path.slice(ADMIN_ROOT.length + 1));

describe("ContentStatusPanel — the panel sequences save-then-transition, not its callers", () => {
  it("finds the panel's call sites at all", () => {
    // Guards the guard: a move or rename would otherwise turn this suite into
    // a silently-passing empty loop.
    expect(callSites.length).toBeGreaterThanOrEqual(5);
  });

  it("the panel awaits save() before transitioning on a publishing move", () => {
    const src = readFileSync(PANEL, "utf8");
    const move = src.slice(src.indexOf("const move = (to: string) =>"));
    expect(move).toContain("if (PUBLISHING.includes(to)) await save();");
    // The call itself, whatever its arguments — ADR-071 gave it a second one.
    expect(move).toMatch(/await transitionTo\(\s*to\b/);
  });

  it("the panel sends a date for SCHEDULED and only for SCHEDULED (ADR-071)", () => {
    // Sending it on a plain PUBLISHED would set a schedule on a row that has
    // already gone live; omitting it on SCHEDULED is refused by the service
    // (`ScheduleInPastError`) rather than defaulted to now, so the condition
    // has to live here.
    const src = readFileSync(PANEL, "utf8");
    const move = src.slice(src.indexOf("const move = (to: string) =>"));
    const call = move.slice(move.indexOf("await transitionTo("));
    expect(call).toContain('to === "SCHEDULED"');
    expect(call).toContain("undefined");
  });

  it.each(callSites)("%s passes both save and transitionTo", (relative) => {
    const src = readFileSync(resolve(ADMIN_ROOT, relative), "utf8");
    const panel = src.slice(src.indexOf("<ContentStatusPanel"));
    expect(panel).toMatch(/\bsave=\{/);
    expect(panel).toMatch(/\btransitionTo=\{/);
  });

  it.each(callSites)("%s forwards the panel's scheduledForIso argument", (relative) => {
    // PR 1's bug, one level down. The panel passes the date as a SECOND
    // argument, and a call site written `transitionTo={(to) => action(id, to)}`
    // drops it on the floor exactly as `async ()` dropped `thenTransitionTo` —
    // TypeScript accepts the narrower arrow, so nothing else catches it. The
    // symptom would be a SCHEDULED move failing with ScheduleInPastError on a
    // date the editor did fill in.
    const src = readFileSync(resolve(ADMIN_ROOT, relative), "utf8");
    const panel = src.slice(src.indexOf("<ContentStatusPanel"));
    const prop = panel.slice(panel.indexOf("transitionTo={"));
    expect(prop).toMatch(/\(to,\s*scheduledForIso\)/);
    expect(prop.slice(0, prop.indexOf("}"))).toContain("scheduledForIso");
  });

  it.each(callSites)("%s does not revive the one-callback submitForm prop", (relative) => {
    const src = readFileSync(resolve(ADMIN_ROOT, relative), "utf8");
    const panel = src.slice(src.indexOf("<ContentStatusPanel"));
    // The article editor's own PublishPanel still takes `submitForm` — a
    // different component, a different (four-state, scheduledFor) machine —
    // so this only looks inside a ContentStatusPanel element.
    expect(panel.slice(0, panel.indexOf("/>"))).not.toContain("submitForm=");
  });
});
