// The editor half of changes-29 B3, shared by every editor with a locale
// switcher. The article editor wrote this inline first; courses, lessons, video
// topics and glossary terms reuse it so the rule is stated once.
//
// The rule: a draft carries `machineTranslated` while its words are exactly
// what the AI returned. Any edit to a translatable field clears it, so the
// save writes `MACHINE_TRANSLATED` only for untouched AI text, and a human's
// edit is the review that promotes it (ADR-097 #4). A machine translation stays
// off the public reading-language menu until then (ADR-127 #2).

export interface MachineTranslatable {
  machineTranslated?: boolean;
}

/**
 * Merge a patch into a draft, clearing the machine flag when the patch touches
 * a translatable field, unless the patch sets the flag itself (the AI apply).
 */
export function mergeTranslationPatch<T extends MachineTranslatable>(
  current: T,
  patch: Partial<T>,
  translatable: readonly (keyof T & string)[],
): T {
  const touchesProse = translatable.some((field) => field in patch);
  const machineTranslated =
    "machineTranslated" in patch
      ? patch.machineTranslated
      : touchesProse
        ? false
        : current.machineTranslated;
  return { ...current, ...patch, machineTranslated };
}

/**
 * The source draft's non-empty string fields, by name. Never `slug`: a slug
 * change writes a redirect and stays a human decision.
 */
export function textFields<T>(
  draft: T | undefined,
  names: readonly (keyof T & string)[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!draft) return fields;
  for (const name of names) {
    const value = draft[name];
    if (typeof value === "string" && value.trim()) fields[name] = value;
  }
  return fields;
}

/**
 * A list of strings as numbered fields (`learningObjectives.0`, …), because the
 * translation payload is a flat record of named strings.
 */
export function listFields(prefix: string, items: readonly string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  items.forEach((item, index) => {
    if (item.trim()) fields[`${prefix}.${index}`] = item;
  });
  return fields;
}

/**
 * Rebuild a list from numbered fields, in the SOURCE list's shape: one entry
 * per source entry, the source's own text where the model returned nothing.
 * Undefined when no entry came back, so the caller leaves the list untouched.
 */
export function listFromFields(
  prefix: string,
  translated: Record<string, string>,
  source: readonly string[],
): string[] | undefined {
  if (!source.some((_, index) => `${prefix}.${index}` in translated)) return undefined;
  return source.map((item, index) => translated[`${prefix}.${index}`] ?? item);
}

/** Whether the target locale holds words a person wrote, which the AI would overwrite. */
export function holdsHumanText<T extends { translationStatus: string } & MachineTranslatable>(
  draft: T,
  names: readonly (keyof T & string)[],
): boolean {
  if (draft.machineTranslated || draft.translationStatus === "MACHINE_TRANSLATED") return false;
  return names.some((name) => {
    const value = draft[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}
