// changes-21 Phase B (ADR-077) — a form's inline validation messages come from
// the SAME schema the server action parses with, so the form and the action
// cannot disagree about what is valid.
//
// This file turns Zod issues into a small, closed vocabulary of error CODES
// keyed by field path. It carries no words on purpose: packages hold no
// catalogs (code-style.md #2), so the app maps each code to a catalog string
// (`admin.validation.*`). A code, not Zod's own English message, is also what
// keeps a future translated form from showing "Too small: expected string to
// have >=1 characters".
import type { z } from "zod";

export type FieldIssueCode =
  | "required"
  | "tooShort"
  | "tooLong"
  | "tooSmall"
  | "tooBig"
  | "tooFew"
  | "tooMany"
  | "invalidEmail"
  | "invalidUrl"
  | "invalidFormat"
  | "invalid";

export interface FieldIssue {
  code: FieldIssueCode;
  /** The bound a length/range code refers to ("at least {limit}"). */
  limit?: number;
}

/** Field path → its first issue. `""` holds an issue about the whole form. */
export type FieldIssues = Record<string, FieldIssue>;

const COLLECTIONS = new Set(["array", "set"]);
const NUMBERS = new Set(["number", "int", "bigint"]);

/** One Zod issue as a form-level code. Exported for its tests. */
export function toFieldIssue(issue: z.core.$ZodIssue): FieldIssue {
  switch (issue.code) {
    // A form produces the wrong TYPE in one way only: the value is missing
    // (an untouched optional-looking field, or a number input emptied to NaN),
    // and an enum miss from a form is an unchosen dropdown, whose value is "".
    // Both labels share one return; a comment BETWEEN them reads as a
    // fall-through to eslint, which is why it sits above the pair.
    case "invalid_type":
    case "invalid_value":
      return { code: "required" };
    case "too_small": {
      const limit = Number(issue.minimum);
      if (NUMBERS.has(issue.origin)) return { code: "tooSmall", limit };
      // `.min(1)` on text or a list is how every schema here says "required".
      if (limit <= 1) return { code: "required" };
      return COLLECTIONS.has(issue.origin)
        ? { code: "tooFew", limit }
        : { code: "tooShort", limit };
    }
    case "too_big": {
      const limit = Number(issue.maximum);
      if (NUMBERS.has(issue.origin)) return { code: "tooBig", limit };
      return COLLECTIONS.has(issue.origin)
        ? { code: "tooMany", limit }
        : { code: "tooLong", limit };
    }
    case "invalid_format":
      if (issue.format === "email") return { code: "invalidEmail" };
      if (issue.format === "url") return { code: "invalidUrl" };
      return { code: "invalidFormat" };
    default:
      return { code: "invalid" };
  }
}

/** Every issue in `error`, first one per field path. */
export function toFieldIssues(error: z.ZodError): FieldIssues {
  const issues: FieldIssues = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    // The first issue is the one to fix first: "required" before "too long".
    issues[path] ??= toFieldIssue(issue);
  }
  return issues;
}

/** Parse `value` with `schema` and return its field issues (`{}` when valid). */
export function validateFields(schema: z.ZodType, value: unknown): FieldIssues {
  const result = schema.safeParse(value);
  return result.success ? {} : toFieldIssues(result.error);
}
