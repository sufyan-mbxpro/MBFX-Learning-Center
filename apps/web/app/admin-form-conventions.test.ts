// ADR-077 (changes-21 Phase B, audit F-07 and F-03) — admin form fields are
// Fields, and destructive TEXT is the ink that passes 4.5:1.
//
// Both properties are invisible when they break. A `<Label htmlFor>` pair
// that drifts apart still LOOKS labelled; a message in a `<p>` beside an
// input still LOOKS attached; raw red on the dark ground still looks red.
// Read as source, like admin-dialog-conventions.test.ts, for the same reason:
// these components sit under async server parents that need a session.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");
const ADMIN_ROOT = resolve(APP_ROOT, "(admin)");
const UI_COMPONENTS = resolve(process.cwd(), "../../packages/ui/src/components");

// The cancelled / paused surfaces (ADR-042, ADR-038) are out of ADR-044's
// scope and so out of ADR-077's — the list admin-dialog-conventions.test.ts
// and the lint rule share. The design-system page is a showcase of the
// primitives themselves (it renders a bare Label on purpose).
const OUT_OF_SCOPE = ["website", "homepage", "design-system"].flatMap((dir) => [
  `admin\\${dir}\\`,
  `admin/${dir}/`,
]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

const inScope = (path: string) => !OUT_OF_SCOPE.some((fragment) => path.includes(fragment));
const read = (path: string) => readFileSync(path, "utf8");

const adminFiles = tsxFiles(ADMIN_ROOT)
  .filter(inScope)
  .map((path) => path.slice(ADMIN_ROOT.length + 1));
const adminSrc = (relative: string) => read(resolve(ADMIN_ROOT, relative));

describe("ADR-077 — every admin form field is a Field", () => {
  it("finds admin screens to check at all", () => {
    expect(adminFiles.length).toBeGreaterThan(40);
  });

  it.each(adminFiles)("%s labels its controls with FieldLabel, not Label", (relative) => {
    expect(adminSrc(relative)).not.toMatch(/from "@repo\/ui\/components\/label"/);
  });

  it.each(adminFiles)("%s renders no raw <label>", (relative) => {
    expect(adminSrc(relative)).not.toMatch(/<label[\s>]/);
  });

  it.each(adminFiles)("%s wires no htmlFor by hand", (relative) => {
    // FieldLabel takes it from its Field. A hand-written pair is how a label
    // ended up pointing at an id nothing carried.
    expect(adminSrc(relative)).not.toMatch(/htmlFor=/);
  });

  // A real call (`const form = useFieldErrors(…)`), not a mention in a comment
  // or a component that only RECEIVES `validate` (the status panel).
  const validating = adminFiles.filter((relative) =>
    /=\s*useFieldErrors\(/.test(adminSrc(relative)),
  );

  it("finds forms that validate inline", () => {
    expect(validating.length).toBeGreaterThan(10);
  });

  it.each(validating)("%s validates before it submits", (relative) => {
    // A form that computes errors but never calls validate() shows nothing,
    // and saves whatever it has.
    expect(adminSrc(relative)).toMatch(/\.validate\(\)/);
  });

  it("marks required fields, never optional ones (owner, 2026-09-12)", () => {
    const catalog = JSON.parse(
      read(resolve(process.cwd(), "../../packages/i18n/messages/en.json")),
    ) as { admin: unknown };
    const strings: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === "string") strings.push(node);
      else if (node && typeof node === "object") Object.values(node).forEach(walk);
    };
    walk(catalog.admin);
    expect(strings.filter((value) => /\(optional\)/i.test(value))).toEqual([]);
  });
});

// Raw --destructive is 4.39:1 on the dark background, under the 4.5:1 body
// text needs (tokens.md §6.14's Alert says the same). An ICON needs 3:1,
// which the raw colour meets, so a class string that sizes an icon — or a
// variant aimed at an svg — may keep it.
const RAW_DESTRUCTIVE_TEXT = /(\S*?)text-destructive(?![-\w])/g;

function rawDestructiveText(path: string): string[] {
  return read(path)
    .split("\n")
    .flatMap((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return [];
      const isIcon = /\bsize-\d/.test(line);
      return [...line.matchAll(RAW_DESTRUCTIVE_TEXT)]
        .filter(([, prefix = ""]) => !isIcon && !prefix.includes("svg"))
        .map(() => `${path.replace(/\\/g, "/").split("/app/").pop()}:${index + 1}`);
    });
}

describe("audit F-03 — destructive text uses text-destructive-interactive", () => {
  it("in the app, both surfaces", () => {
    const offenders = tsxFiles(APP_ROOT).filter(inScope).flatMap(rawDestructiveText);
    expect(offenders).toEqual([]);
  });

  it("in @repo/ui", () => {
    const offenders = tsxFiles(UI_COMPONENTS).flatMap(rawDestructiveText);
    expect(offenders).toEqual([]);
  });
});
