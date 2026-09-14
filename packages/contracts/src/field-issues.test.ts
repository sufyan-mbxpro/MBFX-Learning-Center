// ADR-077 — the Zod-issue → form-code mapping. Every branch is a message an
// admin reads under a field, so every branch is pinned.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createRoleSchema } from "./admin.ts";
import { validateFields } from "./field-issues.ts";

const first = (schema: z.ZodType, value: unknown) => validateFields(schema, value)["v"];

describe("validateFields — codes", () => {
  it("is empty for a valid value", () => {
    expect(validateFields(z.object({ v: z.string() }), { v: "x" })).toEqual({});
  });

  it("reads a missing value, an empty string and an unchosen enum as required", () => {
    expect(first(z.object({ v: z.string() }), {})).toEqual({ code: "required" });
    expect(first(z.object({ v: z.string().trim().min(1) }), { v: "  " })).toEqual({
      code: "required",
    });
    expect(first(z.object({ v: z.enum(["a", "b"]) }), { v: "" })).toEqual({ code: "required" });
    expect(first(z.object({ v: z.array(z.string()).min(1) }), { v: [] })).toEqual({
      code: "required",
    });
    expect(first(z.object({ v: z.number() }), { v: Number.NaN })).toEqual({ code: "required" });
  });

  it("carries the bound on length, count and range codes", () => {
    expect(first(z.object({ v: z.string().min(3) }), { v: "ab" })).toEqual({
      code: "tooShort",
      limit: 3,
    });
    expect(first(z.object({ v: z.string().max(2) }), { v: "abc" })).toEqual({
      code: "tooLong",
      limit: 2,
    });
    expect(first(z.object({ v: z.array(z.int()).min(2) }), { v: [1] })).toEqual({
      code: "tooFew",
      limit: 2,
    });
    expect(first(z.object({ v: z.array(z.int()).max(1) }), { v: [1, 2] })).toEqual({
      code: "tooMany",
      limit: 1,
    });
    expect(first(z.object({ v: z.int().min(0) }), { v: -1 })).toEqual({
      code: "tooSmall",
      limit: 0,
    });
    expect(first(z.object({ v: z.number().max(99) }), { v: 100 })).toEqual({
      code: "tooBig",
      limit: 99,
    });
  });

  it("names the email and URL formats, and falls back for the rest", () => {
    expect(first(z.object({ v: z.email() }), { v: "nope" })).toEqual({ code: "invalidEmail" });
    expect(first(z.object({ v: z.url() }), { v: "nope" })).toEqual({ code: "invalidUrl" });
    expect(first(z.object({ v: z.string().regex(/^a+$/) }), { v: "b" })).toEqual({
      code: "invalidFormat",
    });
    expect(first(z.object({ v: z.int().multipleOf(5) }), { v: 3 })).toEqual({ code: "invalid" });
    expect(first(z.object({ v: z.string().refine((s) => s === "ok") }), { v: "no" })).toEqual({
      code: "invalid",
    });
  });
});

describe("validateFields — paths", () => {
  it("keys nested fields by their dotted path", () => {
    const schema = z.object({ items: z.array(z.object({ title: z.string().min(1) })) });
    expect(validateFields(schema, { items: [{ title: "a" }, { title: "" }] })).toEqual({
      "items.1.title": { code: "required" },
    });
  });

  it("keeps the FIRST issue per field", () => {
    const schema = z.object({ v: z.string().min(1).regex(/^a$/) });
    expect(validateFields(schema, { v: "" })["v"]).toEqual({ code: "required" });
  });

  it("files a whole-form refinement under the empty path", () => {
    const schema = z
      .object({ a: z.string().optional(), b: z.string().optional() })
      .refine((v) => Boolean(v.a) !== Boolean(v.b));
    expect(validateFields(schema, {})).toEqual({ "": { code: "invalid" } });
  });

  it("reports every invalid field of a real action schema", () => {
    expect(validateFields(createRoleSchema, { key: "Bad Key", name: "", level: 100 })).toEqual({
      key: { code: "invalidFormat" },
      name: { code: "required" },
      level: { code: "tooBig", limit: 99 },
    });
  });
});
