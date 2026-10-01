// The setting keys whose `isTranslatable` column the seed sets (ADR-165 #1).
//
// A copy of `TRANSLATABLE_SETTING_KEYS` (@repo/contracts), because @repo/db
// sits below contracts and cannot import it. `@repo/settings`, which depends
// on both, has a test holding the two lists equal — the same arrangement as
// `PERMISSION_GROUPS`. The code reads the registry, never the column; the
// column exists so the database tells the truth to whoever queries it.
export const TRANSLATABLE_SETTING_KEY_LIST = [
  "site.description",
  "legal.riskDisclaimer",
  "legal.copyrightNotice",
  "header.announcementBar",
  "header.topBar",
  "header.cta",
] as const;
