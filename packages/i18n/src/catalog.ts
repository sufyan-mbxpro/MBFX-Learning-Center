// A language's interface text: its catalog FILE with the admin's overrides
// laid over it (ADR-178 #3).
//
// The files are the shipped text, reviewed in a PR and guarded in CI by
// `check:catalog-completeness`. `MessageOverride` rows are what an admin
// changed at Settings → Translation → Interface text, or what "Translate
// missing with Google" wrote. A language added in the admin has no file at
// all, so its catalog is made entirely of overrides.
//
// Every reader of a catalog goes through `loadMergedCatalog` (or its cached
// twin), so the page, the activation gate (`publicCatalogGaps`) and the email
// runner (`catalogMessage`) can never disagree about what a language says.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { hasLocale } from "next-intl";
import { db } from "@repo/db";
import { routing } from "./routing.ts";

export type Catalog = Record<string, unknown>;

/**
 * The languages that ship a catalog file. A literal import per file, never
 * an import built from a string: the bundler includes exactly these, and a
 * locale code can never become a file path.
 */
const CATALOG_FILES: Record<string, () => Promise<{ default: unknown }>> = {
  en: () => import("../messages/en.json", { with: { type: "json" } }),
  es: () => import("../messages/es.json", { with: { type: "json" } }),
  ar: () => import("../messages/ar.json", { with: { type: "json" } }),
  ur: () => import("../messages/ur.json", { with: { type: "json" } }),
};

/** True when the language ships a catalog file of its own. */
export function hasCatalogFile(code: string): boolean {
  return Object.hasOwn(CATALOG_FILES, code);
}

/** The shipped catalog for a language, or an empty one when it ships none. */
export async function loadCatalogFile(code: string): Promise<Catalog> {
  const load = Object.hasOwn(CATALOG_FILES, code) ? CATALOG_FILES[code] : undefined;
  return load ? ((await load()).default as Catalog) : {};
}

export interface MessageOverrideRow {
  key: string;
  value: string;
  isMachine: boolean;
}

export type OverrideLoader = (locale: string) => Promise<MessageOverrideRow[]>;

/** Every override for a language. Pure DB read. */
export const loadMessageOverrides: OverrideLoader = async (locale) =>
  db.messageOverride.findMany({
    where: { locale },
    select: { key: true, value: true, isMachine: true },
  });

/** A dotted key's value in a nested catalog: a string, a subtree, or undefined. */
export function catalogValueAt(catalog: Catalog, key: string): unknown {
  let node: unknown = catalog;
  for (const segment of key.split(".")) {
    node =
      typeof node === "object" && node !== null && Object.hasOwn(node, segment)
        ? (node as Record<string, unknown>)[segment]
        : undefined;
  }
  return node;
}

/**
 * The catalog with each override written at its dotted key. Pure; the input
 * is not modified. An override whose path runs THROUGH a string (the file has
 * `a.b` as text, the row says `a.b.c`) is dropped rather than replacing the
 * string with a subtree, which would break every page that reads `a.b`.
 */
export function applyOverrides(
  catalog: Catalog,
  overrides: ReadonlyArray<Pick<MessageOverrideRow, "key" | "value">>,
): Catalog {
  const out = structuredClone(catalog);
  for (const { key, value } of overrides) {
    const segments = key.split(".");
    const last = segments.pop();
    if (!last || segments.some((s) => s === "" || s === "__proto__") || last === "__proto__") {
      continue;
    }
    let node: Record<string, unknown> = out;
    let blocked = false;
    for (const segment of segments) {
      const next = node[segment];
      if (next === undefined) {
        const child: Record<string, unknown> = {};
        node[segment] = child;
        node = child;
      } else if (typeof next === "object" && next !== null && !Array.isArray(next)) {
        node = next as Record<string, unknown>;
      } else {
        blocked = true;
        break;
      }
    }
    const existing = node[last];
    if (blocked || (typeof existing === "object" && existing !== null)) continue;
    node[last] = value;
  }
  return out;
}

/**
 * File + overrides. A failed override read falls back to the file alone: a
 * database hiccup must not take every page's text down (ADR-178,
 * Consequences). The code is checked against the routing list first, so an
 * unknown locale reads nothing.
 */
export async function loadMergedCatalog(
  code: string,
  loadOverrides: OverrideLoader = loadMessageOverrides,
): Promise<Catalog> {
  if (!hasLocale(routing.locales, code)) return {};
  const file = await loadCatalogFile(code);
  let overrides: MessageOverrideRow[];
  try {
    overrides = await loadOverrides(code);
  } catch (error) {
    console.error(`Interface text overrides for "${code}" could not be read`, error);
    return file;
  }
  return overrides.length > 0 ? applyOverrides(file, overrides) : file;
}

/** Minted here beside `locales`, for the same reason (ADR-178, Consequences). */
const MESSAGES_TAG = "messages";

/** The merged catalog a page renders with. Cached until an override is saved. */
export async function getCatalog(code: string): Promise<Catalog> {
  "use cache";
  cacheTag(MESSAGES_TAG);
  cacheLife({ revalidate: 3600 });
  return loadMergedCatalog(code);
}

/** Call after an override is saved, reset or machine-filled. */
export async function invalidateMessages(): Promise<void> {
  revalidateTag(MESSAGES_TAG, { expire: 0 });
}
