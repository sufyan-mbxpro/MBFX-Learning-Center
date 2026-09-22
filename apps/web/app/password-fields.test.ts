// changes-21 F1 (ADR-079 #8) — every password field is the one component.
//
// Read as source, like admin-form-conventions.test.ts: these forms sit under
// async server parents that need a session, and what is asserted here (a
// reveal toggle exists at all) is a property of the markup, not of a render.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

const files = tsxFiles(APP_ROOT).map((path) => path.slice(APP_ROOT.length + 1));
const read = (relative: string) => readFileSync(resolve(APP_ROOT, relative), "utf8");

// The six fields that existed before F1, by the file that renders them. A
// deletion here is as much a regression as a raw input: the guard below would
// otherwise pass on a form that had lost its password field entirely.
// Written POSIX-style: `read()` resolves them, and node accepts forward
// slashes on Windows too.
const PASSWORD_FORMS = [
  "(admin-auth)/keystone/admin-sign-in-form.tsx",
  "(public)/[locale]/sign-in/sign-in-form.tsx",
  "(public)/[locale]/sign-up/sign-up-form.tsx",
  "(admin)/keystone/profile/profile-forms.tsx",
];

describe("every password field is PasswordInput", () => {
  it("finds app files to check at all", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s renders no raw type="password"', (relative) => {
    // `PasswordInput` owns the type, because it is what swaps it. A raw one
    // is a field with no way to reveal what was typed.
    expect(read(relative)).not.toMatch(/type="password"/);
  });

  it.each(PASSWORD_FORMS)("%s still uses PasswordInput", (relative) => {
    expect(read(relative)).toMatch(/from "@repo\/ui\/components\/password-input"/);
  });
});
