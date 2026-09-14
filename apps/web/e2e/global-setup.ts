import { execFileSync } from "node:child_process";
import path from "node:path";
import { e2eDatabaseUrl } from "../playwright.config.ts";

// Provisions the isolated E2E database before any test runs: create it if
// missing, apply migrations, seed it, then add the fixture users the suite
// needs beyond the seed.
//
// Prisma and Argon2 work runs as CHILD PROCESSES with `cwd: packages/db`, so
// `apps/web` needs no MySQL driver or Argon2 binding of its own.
//
// Deliberately NOT Testcontainers, unlike the @repo/core integration tests.
// Those spin up a container per test FILE, which is fine for a Node-only
// suite; here the same database must be reachable by a separate Next.js server
// process for the whole run, and pointing that server at a container whose
// lifetime Playwright doesn't own is more moving parts than value. A named
// database on the MySQL the developer already runs is simpler and just as
// isolated from the dev data, which is the property that actually matters.

const dbPackageRoot = path.resolve(__dirname, "../../../packages/db");
const prismaCli = require.resolve("prisma/build/index.js");

/** The read-only staff account created by `packages/db/prisma/e2e-fixtures.ts`. */
export const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? "e2e-viewer@mbxpro.com";
export const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD ?? "E2E-Viewer-Passw0rd!";

function inDbPackage(args: string[], databaseUrl: string, label: string, input?: string): void {
  try {
    execFileSync(process.execPath, args, {
      cwd: dbPackageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: input === undefined ? "pipe" : ["pipe", "pipe", "pipe"],
      ...(input === undefined ? {} : { input }),
    });
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `E2E setup failed at "${label}":\n${err.stderr?.toString() ?? ""}${err.stdout?.toString() ?? ""}`,
    );
  }
}

export default async function globalSetup() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("DATABASE_URL is not set — E2E derives its own database from it.");

  const databaseUrl = e2eDatabaseUrl();
  const dbName = new URL(databaseUrl).pathname.slice(1);
  const devDbName = new URL(devUrl).pathname.slice(1);

  // Guard rail, not paranoia: this setup MIGRATES and SEEDS whatever it points
  // at. Running it against the development database would destroy real work.
  if (!dbName || dbName === devDbName) {
    throw new Error(
      `Refusing to run E2E against "${dbName}": it must be a dedicated database, never the dev ` +
        `one ("${devDbName}"). Set E2E_DATABASE_NAME to something else.`,
    );
  }

  // DROP, then create. `IF NOT EXISTS` is what this used to say, and it made
  // the seed's idempotence a liability rather than a feature: the seed upserts
  // create-only, so a database first created weeks ago keeps its ORIGINAL
  // values for every setting and every row the seed will not overwrite. The
  // symptom is a suite that passes against a site nobody ships — this one was
  // asserting against a one-column footer months after the footer became a
  // three-column sitemap, and its homepage carried none of the sections added
  // since. Recreating costs one `migrate deploy` per run, and it is the only
  // way "the suite's starting state" means the state a fresh install gets.
  //
  // Prisma 7 dropped `--url` from `db execute`, so the connection comes from
  // DATABASE_URL — pointed at the DEV database here because that URL is
  // known-valid. Both statements name a DIFFERENT database, the one the guard
  // above has already refused to let be the dev one: no dev data is read or
  // written.
  // One statement per call: `db execute` hands the script to the driver as a
  // single query, and MySQL rejects two semicolon-separated statements there
  // unless multi-statement mode is on — which it is not, and which is not
  // worth turning on for this.
  for (const statement of [
    `DROP DATABASE IF EXISTS \`${dbName}\`;`,
    `CREATE DATABASE \`${dbName}\`;`,
  ]) {
    inDbPackage([prismaCli, "db", "execute", "--stdin"], devUrl, "recreate database", statement);
  }

  inDbPackage([prismaCli, "migrate", "deploy"], databaseUrl, "migrate deploy");
  // Onto an empty database, so every create-only upsert actually creates and
  // the starting state is the one a fresh install gets — see above.
  inDbPackage(["--experimental-strip-types", "prisma/seed.ts"], databaseUrl, "seed");
  inDbPackage(["--experimental-strip-types", "prisma/e2e-fixtures.ts"], databaseUrl, "fixtures");
}
