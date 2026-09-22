// The writing assistant's brief field could not be typed into (changes-29 B1
// regression). It sits INSIDE a DropdownMenuContent, and Base UI 1.7's menu
// typeahead calls preventDefault on every character key that bubbles to the
// popup — so the input rendered, took focus, and ignored the keyboard. Read as
// source, like the other app-level guards: apps/web has no DOM environment.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/(admin)/keystone/_components/ai-assistant.tsx"),
  "utf8",
);

describe("AI writing assistant menu", () => {
  it("the brief input keeps its keystrokes from the menu's typeahead", () => {
    const input = source.match(/<Input\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(input).toMatch(/onKeyDown=/);
    expect(input).toMatch(/event\.stopPropagation\(\)/);
  });

  it("Escape still reaches the menu, so it can be closed from the field", () => {
    const input = source.match(/<Input\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(input).toMatch(/event\.key !== "Escape"/);
  });

  it("starting a run closes the menu, which would otherwise cover the result panel", () => {
    expect(source).toMatch(/<DropdownMenu open=\{open\} onOpenChange=\{setOpen\}>/);
    // `run` is not async — it fires the request and returns, so the menu can
    // close on the same tick. Matching `async function run(` found nothing and
    // then asserted against an empty string, which passes for the wrong reason
    // the moment the body changes.
    const run = source.match(/\n {2}function run\([\s\S]*?\n {2}\}/)?.[0] ?? "";
    expect(run, "run() not found in ai-assistant.tsx").not.toBe("");
    expect(run).toMatch(/setOpen\(false\)/);
  });
});
