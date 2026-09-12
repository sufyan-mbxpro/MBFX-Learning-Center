// changes-21 F-05: top-bar icons are size-5 (tokens.md §5, §6.12). The bell
// had drifted to size-4.5, the one icon in the bar drawn a step smaller.
// Read as source, like the other app-level guards.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), "app/(admin)/admin/_components", name), "utf8");

describe("admin top-bar icons (changes-21 F-05)", () => {
  it("the notification bell is size-5", () => {
    const bell = read("notification-bell.tsx").match(/<Bell\b[^>]*className="([^"]*)"/);
    expect(bell?.[1]).toMatch(/\bsize-5\b/);
  });
});
