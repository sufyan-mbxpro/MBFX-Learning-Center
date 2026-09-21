import { execFileSync } from "node:child_process";
import path from "node:path";
import { e2eDatabaseUrl } from "./database.ts";
import { VIEWER_EMAIL } from "./accounts.ts";

// Verifies the E2E database is there and carries its fixtures. It does NOT
// provision — `e2e/provision.mts` does, from the web server's own command,
// because Playwright starts the server BEFORE it runs this file (the plugin
// setup tasks come first; see the long note in provision.mts).
//
// So what is left for this hook is the one thing it is positioned to do: turn
// the confusing failure into a clear one. The server is reused rather than
// started when one is already listening (`reuseExistingServer`), and in that
// case nothing provisioned anything — a suite about to assert against an empty
// or absent database should say so here, not fail eighty times downstream.

const dbPackageRoot = path.resolve(__dirname, "../../../packages/db");

export default async function globalSetup() {
  const databaseUrl = e2eDatabaseUrl();

  try {
    const out = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "prisma/e2e-query.ts", "fixtureUser"],
      { cwd: dbPackageRoot, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8" },
    );
    if (JSON.parse(out) === null) throw new Error(`no ${VIEWER_EMAIL} row`);
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string };
    throw new Error(
      `The E2E database is not ready (${new URL(databaseUrl).pathname.slice(1)}).\n\n` +
        `It is provisioned by the web server's own command, so this usually means a server was ` +
        `REUSED instead of started — stop whatever is listening on the E2E port and run again.\n\n` +
        `${err.stderr?.toString() ?? err.message ?? ""}`,
    );
  }
}
