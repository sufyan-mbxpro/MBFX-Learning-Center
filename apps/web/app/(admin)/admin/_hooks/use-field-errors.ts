"use client";

// ADR-077 — inline validation for admin forms, from the SAME contracts schema
// the server action parses with.
//
//   const form = useFieldErrors(createRoleSchema, { key, name, level });
//   <Field invalid={form.invalid("name")} required>
//     <FieldLabel>…</FieldLabel>
//     <Input … />
//     <FieldError>{form.error("name")}</FieldError>
//   </Field>
//   <Button onClick={() => form.validate() && run(…)}>Save</Button>
//
// Nothing shows until the first submit attempt: an untouched form is not
// "wrong". From then on the issues are recomputed on every render, so a
// message clears the moment its field is fixed. A failed attempt moves focus
// to the first invalid control, whose aria-describedby (from its Field)
// reads the message — that is the announcement, rather than a live region
// per field talking over it. The search for that control is scoped to the
// dialog or form whose Save was pressed, so a second form on the screen is
// never where focus lands.
//
// The toast is for what no field can show (owner, 2026-09-12): a server or
// submission failure (`useServerAction` still owns those) and an issue with
// no field on screen to point at.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { validateFields, type FieldIssues } from "@repo/contracts";

type Schema = Parameters<typeof validateFields>[0];

export function useFieldErrors(schema: Schema, values: unknown) {
  const t = useTranslations("admin.validation");
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const scopeRef = useRef<HTMLElement | null>(null);

  const issues: FieldIssues = attempted ? validateFields(schema, values) : {};

  useEffect(() => {
    if (focusRequest === 0) return;
    const root: ParentNode = scopeRef.current ?? document;
    const first = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (first) first.focus();
    // An issue on a path this form renders no Field for (or on the whole
    // form) would otherwise block the save with nothing on screen saying so.
    else toast.error(t("formInvalid"));
  }, [focusRequest, t]);

  /** Run on submit. True when the values are valid and the action may run. */
  const validate = useCallback((): boolean => {
    setAttempted(true);
    if (Object.keys(validateFields(schema, values)).length === 0) return true;
    // Focus stays in the dialog or form whose Save was pressed — it still
    // holds focus here. Found rather than passed as a ref: a ref on the
    // returned object makes the React Compiler treat every `form.error()`
    // read as a ref read during render (react-hooks/refs).
    scopeRef.current =
      document.activeElement?.closest<HTMLElement>('[role="dialog"], form') ?? null;
    setFocusRequest((n) => n + 1);
    return false;
  }, [schema, values]);

  /** The field's message, once a submit has been attempted. */
  const error = (path: string): string | undefined => {
    const issue = issues[path];
    return issue ? t(issue.code, { limit: issue.limit ?? 0 }) : undefined;
  };

  return {
    error,
    invalid: (path: string) => path in issues,
    validate,
    /** Forget the attempt — after a successful save, or when a dialog closes. */
    reset: useCallback(() => setAttempted(false), []),
  };
}
