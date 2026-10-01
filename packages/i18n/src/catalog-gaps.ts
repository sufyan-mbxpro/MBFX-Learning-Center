// The runtime half of `check:catalog-completeness` (ADR-163 #2).
//
// CI refuses an incomplete PUBLIC catalog only for a locale listed in
// `ENFORCED_LOCALES`. An admin switching `Locale.isActive` never passes
// through CI, and a missing key falls back to English at request time
// (`request.ts`), so without this check a half-translated public site could go
// live from a button — the outcome ADR-043 #4 exists to prevent. Same rule as
// the script, same namespace split: admin namespaces are English-only by
// design (ADR-043 #2) and never count as gaps.
import { hasLocale } from "next-intl";
import {
  catalogValueAt,
  loadMergedCatalog,
  loadMessageOverrides,
  type OverrideLoader,
} from "./catalog.ts";
import { routing } from "./routing.ts";

/**
 * Namespaces the admin surface owns. Must equal the script's
 * `ADMIN_NAMESPACES` (`scripts/check-catalog-completeness.mjs`) — the script is
 * plain Node with no TypeScript loader, so it cannot import this one, and
 * `catalog-gaps.test.ts` fails when the two disagree.
 */
export const ADMIN_MESSAGE_NAMESPACES: ReadonlySet<string> = new Set(["admin", "cms"]);

/** Flattens a nested catalog into dotted leaf keys: {a:{b:"x"}} → ["a.b"]. */
export function flattenMessageKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenMessageKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Public keys present in `source` and absent from `target`. Pure. */
export function missingPublicKeys(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): string[] {
  const present = new Set(flattenMessageKeys(target));
  return flattenMessageKeys(source).filter(
    (key) => !ADMIN_MESSAGE_NAMESPACES.has(key.split(".")[0] ?? "") && !present.has(key),
  );
}

/**
 * The public keys `locale`'s catalog lacks, or `null` when next-intl cannot
 * route the code at all. "The catalog" is the file with the admin's overrides
 * over it (ADR-178 #3), on BOTH sides: an English override adds no key, and a
 * language added in the admin has no file, so every key it has is an override.
 */
export async function publicCatalogGaps(
  locale: string,
  loadOverrides: OverrideLoader = loadMessageOverrides,
): Promise<string[] | null> {
  if (!hasLocale(routing.locales, locale)) return null;
  if (locale === routing.defaultLocale) return [];
  const [source, target] = await Promise.all([
    loadMergedCatalog(routing.defaultLocale, loadOverrides),
    loadMergedCatalog(locale, loadOverrides),
  ]);
  return missingPublicKeys(source, target);
}

/**
 * One catalog string, for a server-side renderer with no request to hang
 * next-intl on (an email a runner sends, ADR-171). The locale's own value,
 * then the default locale's, then null — both with overrides applied. No ICU
 * formatting: a caller that needs arguments uses next-intl.
 */
export async function catalogMessage(
  locale: string,
  key: string,
  loadOverrides: OverrideLoader = loadMessageOverrides,
): Promise<string | null> {
  const codes = hasLocale(routing.locales, locale)
    ? [locale, routing.defaultLocale]
    : [routing.defaultLocale];
  for (const code of codes) {
    const value = catalogValueAt(await loadMergedCatalog(code, loadOverrides), key);
    if (typeof value === "string") return value;
  }
  return null;
}
