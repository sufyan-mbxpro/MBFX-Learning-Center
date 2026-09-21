// Database-level assertions for the E2E suite.
//
// testing.md #1: "every admin screen ships happy-path + permission-denied E2E
// (denied asserted at the DB level, not just the UI)". A test that only checks
// a button is missing proves nothing — the button could be hidden while the
// server action happily writes. These helpers assert what actually landed.
//
// Queries run in a CHILD PROCESS against `packages/db/prisma/e2e-query.ts`.
// Importing `@repo/db` here would need it as a dependency of `apps/web` —
// which is exactly the import architecture.md #2 keeps out of the app package
// — and its `declare global` block does not survive Playwright's CommonJS
// transpilation anyway.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { e2eDatabaseUrl } from "./database.ts";

const dbPackageRoot = path.resolve(__dirname, "../../../packages/db");

function query<T>(name: string, args?: unknown): T {
  const out = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "prisma/e2e-query.ts",
      name,
      ...(args === undefined ? [] : [JSON.stringify(args)]),
    ],
    {
      cwd: dbPackageRoot,
      env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() },
      encoding: "utf8",
    },
  );
  return JSON.parse(out) as T;
}

export interface SeededArticle {
  id: string;
  articleId: string;
  title: string;
  slug: string;
  seoTitle: string | null;
  focusKeywords: string | null;
  noIndex: boolean;
  noFollow: boolean;
  faqItems: { id: string; question: string; answer: string }[];
  article: { id: string; isFeatured: boolean; status: string; showRelated: boolean };
}

export function seededArticle(): SeededArticle {
  return query<SeededArticle>("seededArticle");
}

export function auditCount(entityId: string, action: string): number {
  return query<number>("auditCount", { entityId, action });
}

/** An active locale, as ADR-091's `getServableLocales()` would report it. */
export interface ActiveLocaleRow {
  code: string;
  isRtl: boolean;
}

/** The locales this install actually serves (ADR-091). */
export function activeLocales(): ActiveLocaleRow[] {
  return query<ActiveLocaleRow[]>("activeLocales");
}

/** One settings row as the database holds it. */
export interface SettingRow {
  key: string;
  value: unknown;
  groupName: string;
  isPublic: boolean;
}

/** A settings screen's save, read back from the row rather than the form. */
export function setting(key: string): SettingRow | null {
  return query<SettingRow | null>("setting", { key });
}

export interface AiFeatureRow {
  key: string;
  isEnabled: boolean;
  providerId: string | null;
  modelId: string | null;
  maxOutputTokens: number | null;
  extraInstructions: string | null;
}

/** One `AiFeature` row (Module 18), for the AI screens' DB-level assertions. */
export function aiFeature(key: string): AiFeatureRow | null {
  return query<AiFeatureRow | null>("aiFeature", { key });
}

export interface SeededTool {
  id: string;
  key: string;
  isEnabled: boolean;
  relatedCount: number;
  config: Record<string, unknown>;
  translations: { locale: string; title: string; tagline: string | null }[];
}

/** One tool row, for the admin suite's database-level assertions. */
export function seededTool(key: string): SeededTool {
  return query<SeededTool>("tool", { key });
}
