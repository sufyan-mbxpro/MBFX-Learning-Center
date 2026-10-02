// The editor half of changes-29 B3, shared by every editor with a locale
// switcher. The article editor wrote this inline first; courses, lessons, video
// topics and glossary terms reuse it so the rule is stated once.
//
// The rule: a draft carries `machineTranslated` while its words are exactly
// what the AI returned. Any edit to a translatable field clears it, so the
// save writes `MACHINE_TRANSLATED` only for untouched AI text, and a human's
// edit is the review that promotes it (ADR-097 #4). A machine translation stays
// out of search indexes and hreflang until then (ADR-159 #2).

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
 * Field names a machine never writes, whatever a caller passes. `slug`: one
 * slug is shared by every language and typed on the default locale's tab
 * (ADR-181), so a translated slug has nowhere to go — the service ignores a
 * slug sent for any other locale, and a prefilled one would only make the
 * form disagree with what is saved.
 */
const NEVER_MACHINE_WRITTEN: ReadonlySet<string> = new Set(["slug"]);

/** `fields` without the names a machine never writes (`slug`). */
export function withoutSlug(fields: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([name]) => !NEVER_MACHINE_WRITTEN.has(name)),
  );
}

/**
 * The source draft's non-empty string fields, by name. Never `slug`: one slug
 * is shared by every language (ADR-181), so it is never translated.
 */
export function textFields<T>(
  draft: T | undefined,
  names: readonly (keyof T & string)[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!draft) return fields;
  for (const name of names) {
    if (NEVER_MACHINE_WRITTEN.has(name)) continue;
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
