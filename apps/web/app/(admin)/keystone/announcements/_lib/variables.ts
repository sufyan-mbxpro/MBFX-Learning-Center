// Which placeholders a custom or direct email may not use (ADR-172 #2), for
// the editors to NAME inline. The action's schema refuses the same thing, but
// a schema issue with custom params reads as "Check this value" — which does
// not tell an author that `{{course.title}}` belongs to another email.
import { CUSTOM_EMAIL_VARIABLES, findTemplateVariables } from "@repo/contracts";

const ALLOWED = new Set<string>(CUSTOM_EMAIL_VARIABLES);

export function unknownVariables(text: string): string[] {
  return findTemplateVariables(text).filter((name) => !ALLOWED.has(name));
}
