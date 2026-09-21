// A window-level shortcut listener must not assume `KeyboardEvent.key`.
//
// Chrome dispatches a `keydown` with `key === undefined` when a field is
// filled from autofill (a saved email on the sign-in or newsletter form, say).
// The public ⌘K listener sits on `window`, so it received that event and
// `event.key.toLowerCase()` threw a runtime TypeError on every page with the
// header. The admin palette had the same line.
//
// Read as source, like `grid-base.test.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LISTENERS = [
  "app/(public)/[locale]/_components/site-search.tsx",
  "app/(admin)/admin/_components/admin-search.tsx",
];

describe("shortcut listeners tolerate a keydown with no key", () => {
  it.each(LISTENERS)("%s never dereferences event.key unguarded", (file) => {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(src).toContain("event.key?.toLowerCase()");
    expect(src).not.toMatch(/event\.key\.toLowerCase\(\)/);
  });
});
