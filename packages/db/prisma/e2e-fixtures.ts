// Extra fixture rows the E2E suite needs beyond `seed.ts`.
//
// Lives in @repo/db, not apps/web/e2e, so the app package doesn't have to
// depend on `@node-rs/argon2` and the Prisma internals just to create a test
// user — the Playwright global setup runs this the same way it runs the seed.
//
// Idempotent, like the seed: safe to re-run before every suite.
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { db } from "../src/index.ts";

/**
 * A STAFF user whose role grants `analysis.view` and NO article write
 * permission. testing.md #1 wants permission-denied asserted at the database
 * level, which needs a subject who genuinely lacks the right — not a super
 * admin with a hidden button.
 *
 * `seo_manager` is a real seeded role with exactly that shape, so the denial
 * under test is the one production would produce.
 */
const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? "e2e-viewer@mbxpro.com";
const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD ?? "E2E-Viewer-Passw0rd!";
const VIEWER_ROLE_KEY = "seo_manager";

export async function createE2eFixtures(): Promise<void> {
  // Same Argon2id parameters as the seed's admin (ADR-001), or Better Auth
  // will not verify the password at sign-in.
  const passwordHash = await hash(VIEWER_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await db.user.upsert({
    where: { email: VIEWER_EMAIL },
    update: {},
    create: {
      id: randomUUID(),
      email: VIEWER_EMAIL,
      name: "E2E Viewer",
      firstName: "E2E",
      lastName: "Viewer",
      emailVerified: true,
      userType: "STAFF",
      status: "ACTIVE",
      locale: "en",
    },
  });

  // Account shape must match Better Auth's credential provider exactly — see
  // seed.ts's comment: `issuer` is the synthetic `local:<providerId>` key and
  // `accountId` is the user's own id.
  await db.account.upsert({
    where: { issuer_accountId: { issuer: "local:credential", accountId: user.id } },
    update: { password: passwordHash },
    create: {
      id: randomUUID(),
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      issuer: "local:credential",
      password: passwordHash,
    },
  });

  const role = await db.role.findUniqueOrThrow({ where: { key: VIEWER_ROLE_KEY } });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`  e2e fixtures: ${VIEWER_EMAIL} (${VIEWER_ROLE_KEY}, read-only on articles)`);
}

// CLI entrypoint — the Playwright global setup invokes this file directly.
if (process.argv[1] && import.meta.url.endsWith("e2e-fixtures.ts")) {
  const { config } = await import("dotenv");
  config({ path: new URL("../../../.env", import.meta.url).pathname });
  await createE2eFixtures();
  await db.$disconnect();
}
