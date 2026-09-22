"use client";

// Inline validation for the profile page's forms, from the SAME contracts
// schema the action or Better Auth enforces (ADR-077's rule, on the public
// surface). The admin's `useFieldErrors` cannot be imported from here —
// nothing under `app/(public)` may import `app/(admin)` (architecture.md #5) —
// and it reads `admin.validation.*`, which is English-only by design. This is
// the public twin: same `validateFields`, messages from `account.validation.*`.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { validateFields, type FieldIssues } from "@repo/contracts";

type Schema = Parameters<typeof validateFields>[0];

export function useAccountForm(schema: Schema, values: unknown) {
  const t = useTranslations("account.validation");
  const [attempted, setAttempted] = useState(false);
  const issues: FieldIssues = attempted ? validateFields(schema, values) : {};

  return {
    /** Run on submit. True when the values are valid. */
    validate(): boolean {
      setAttempted(true);
      return Object.keys(validateFields(schema, values)).length === 0;
    },
    reset() {
      setAttempted(false);
    },
    invalid(path: string): boolean {
      return path in issues;
    },
    error(path: string): string | undefined {
      const issue = issues[path];
      if (!issue) return undefined;
      switch (issue.code) {
        case "required":
          return t("required");
        case "tooShort":
          return t("tooShort", { limit: issue.limit ?? 0 });
        case "tooLong":
          return t("tooLong", { limit: issue.limit ?? 0 });
        case "invalidEmail":
          return t("invalidEmail");
        default:
          return t("invalid");
      }
    },
  };
}
