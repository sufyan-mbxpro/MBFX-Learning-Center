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
import { e2eDatabaseUrl } from "../playwright.config.ts";

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
