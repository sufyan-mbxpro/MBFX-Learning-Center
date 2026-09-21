// changes-29 B3 in the course, lesson, video topic and glossary term editors:
// the machine flag's rule, and the list flattening the translation payload
// needs. The editors are client components; what matters is this logic, and
// that each editor actually uses it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  holdsHumanText,
  listFields,
  listFromFields,
  mergeTranslationPatch,
  textFields,
} from "./machine-translation.ts";

interface Draft {
  title: string;
  slug: string;
  body: string;
  translationStatus: string;
  machineTranslated?: boolean;
}

const FIELDS = ["title", "body"] as const;
const draft = (patch: Partial<Draft> = {}): Draft => ({
  title: "",
  slug: "",
  body: "",
  translationStatus: "DRAFT",
  ...patch,
});

describe("mergeTranslationPatch", () => {
  it("keeps the flag the AI apply sets", () => {
    const next = mergeTranslationPatch(draft(), { title: "Hola", machineTranslated: true }, FIELDS);
    expect(next).toMatchObject({ title: "Hola", machineTranslated: true });
  });

  it("clears it on a human edit to a translatable field — the review is the promotion", () => {
    const next = mergeTranslationPatch(draft({ machineTranslated: true }), { body: "x" }, FIELDS);
    expect(next.machineTranslated).toBe(false);
  });

  it("leaves it alone for a field AI does not translate", () => {
    const next = mergeTranslationPatch(draft({ machineTranslated: true }), { slug: "s" }, FIELDS);
    expect(next.machineTranslated).toBe(true);
  });
});

describe("textFields", () => {
  it("returns only the named, non-empty strings", () => {
    expect(textFields(draft({ title: "T", slug: "never", body: "  " }), FIELDS)).toEqual({
      title: "T",
    });
    expect(textFields<Draft>(undefined, FIELDS)).toEqual({});
  });
});

describe("listFields / listFromFields", () => {
  it("round-trips a list in the source's shape, keeping source text where nothing came back", () => {
    const source = ["one", "two", "three"];
    expect(listFields("objectives", source)).toEqual({
      "objectives.0": "one",
      "objectives.1": "two",
      "objectives.2": "three",
    });
    expect(
      listFromFields("objectives", { "objectives.0": "uno", "objectives.2": "tres" }, source),
    ).toEqual(["uno", "two", "tres"]);
    expect(listFromFields("objectives", { title: "x" }, source)).toBeUndefined();
  });
});

describe("holdsHumanText", () => {
  it("asks before overwriting words a person wrote, and never before replacing a machine's", () => {
    expect(holdsHumanText(draft({ title: "Mine" }), FIELDS)).toBe(true);
    expect(holdsHumanText(draft(), FIELDS)).toBe(false);
    expect(holdsHumanText(draft({ title: "AI", machineTranslated: true }), FIELDS)).toBe(false);
    expect(
      holdsHumanText(draft({ title: "AI", translationStatus: "MACHINE_TRANSLATED" }), FIELDS),
    ).toBe(false);
  });
});

describe.each([
  "app/(admin)/admin/learn/courses/[id]/course-editor.tsx",
  "app/(admin)/admin/learn/lessons/[id]/lesson-editor.tsx",
  "app/(admin)/admin/learn/videos/[id]/video-editor.tsx",
  "app/(admin)/admin/glossary/[id]/glossary-editor.tsx",
])("%s", (path) => {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");

  it("renders the translation controls and sends the machine flag with its save", () => {
    expect(source).toContain("<TranslationControls");
    expect(source).toContain("mergeTranslationPatch(");
    expect(source).toContain("...(draft.machineTranslated ? { machineTranslated: true } : {})");
  });

  it("never offers the slug to the model", () => {
    const list = source.match(/const TRANSLATABLE_TEXT = \[([^\]]*)\]/)?.[1] ?? "";
    expect(list).not.toBe("");
    expect(list).not.toContain('"slug"');
  });
});
