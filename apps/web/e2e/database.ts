/**
 * Where the E2E suite's database lives, and how its URL is derived.
 *
 * Its own module rather than a corner of `playwright.config.ts`, because
 * `e2e/provision.mts` runs as a plain Node script BEFORE Playwright exists in
 * the process (see the config's `webServer.command`) — importing the config
 * from there would drag `@playwright/test` into a `node --experimental-
 * strip-types` run for the sake of one pure function.
 */

/** The env var carrying the DEVELOPMENT database URL into the server process. */
export const SOURCE_URL_VAR = "E2E_SOURCE_DATABASE_URL";

/**
 * The isolated E2E database URL, derived from the development one by swapping
 * the database name. Never the dev database — `provision.mts` refuses that
 * explicitly, because it DROPs whatever it is pointed at.
 */
export function e2eDatabaseUrl(sourceUrl = process.env.DATABASE_URL): string {
  if (!sourceUrl)
    throw new Error("DATABASE_URL is not set — E2E needs it to derive its own database.");
  const url = new URL(sourceUrl);
  url.pathname = `/${process.env.E2E_DATABASE_NAME ?? "mbfx_e2e"}`;
  return url.toString();
}

/** The database name inside a connection URL. */
export function databaseName(url: string): string {
  return new URL(url).pathname.slice(1);
}
