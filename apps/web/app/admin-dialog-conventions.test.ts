// ADR-057 #5 — every admin modal renders a title AND a one-line description.
//
// The dropdown half of that ADR is lint-enforced (a restricted import cannot
// be missed). This half cannot be: `DialogDescription` is an ABSENCE, and no
// import rule catches something that was never written. Eleven modals had
// already drifted into title-only by the time the owner reported it, which is
// exactly the decay ADR-044 was written to stop.
//
// Read as source rather than rendered, following `type-scale.test.ts`: these
// live inside client components whose parents are async server components
// awaiting a session, so rendering one here would mean standing up a database
// to assert that two elements sit next to each other.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "app/(admin)");

// ADR-042 cancelled the Website Builder and ADR-038 paused the homepage
// composer. ADR-044's scope statement leaves both out of the admin display
// conventions; ADR-057 inherits that scope rather than widening it. The same
// two paths are excluded from the lint rule in tooling/eslint-config/next.js —
// keep the lists in step.
const OUT_OF_SCOPE = ["admin\\website\\", "admin/website/", "admin\\homepage\\", "admin/homepage/"];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const dialogFiles = tsxFiles(ADMIN_ROOT)
  .filter((path) => !OUT_OF_SCOPE.some((fragment) => path.includes(fragment)))
  .filter((path) => readFileSync(path, "utf8").includes("<DialogTitle"))
  .map((path) => path.slice(ADMIN_ROOT.length + 1));

describe("ADR-057 #5 — admin modals have a header with a title and a description", () => {
  it("finds admin modals to check at all", () => {
    // Guards the guard: a rename that broke the walk would otherwise turn
    // this whole suite into a silently-passing empty loop.
    expect(dialogFiles.length).toBeGreaterThan(5);
  });

  it.each(dialogFiles)("%s renders a DialogDescription beside its DialogTitle", (relative) => {
    const src = readFileSync(resolve(ADMIN_ROOT, relative), "utf8");
    expect(src).toContain("<DialogDescription");
  });

  it.each(dialogFiles)("%s does not pass a field label off as the description", (relative) => {
    // The taxonomy panel shipped `<DialogDescription>{slugLabel}</...>` — an
    // input's label doing duty as an explanation of the modal. It satisfies
    // the accessible-description requirement and tells the reader nothing,
    // so the check is specifically for a `*Label` binding.
    const src = readFileSync(resolve(ADMIN_ROOT, relative), "utf8");
    expect(src).not.toMatch(/<DialogDescription>\{[A-Za-z.]*[Ll]abel\}<\/DialogDescription>/);
  });
});
