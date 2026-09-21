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

/** The seeded sample article, the one every article spec asserts against. */
const ARTICLE_SLUG = "risk-management-protect-your-trading-capital";

/**
 * A LEARNER, for the cross-surface probe ADR-006 left as a launch-gate item:
 * "learner session vs every `/admin/*` route and admin handler → 403/404,
 * never 200".
 *
 * It has to be a real learner rather than an anonymous visitor, because those
 * two are turned away by DIFFERENT code. Anonymous has no session cookie and
 * dies at `proxy.ts`'s gate; a learner has a perfectly valid session and is
 * refused for `userType` alone, by the `(admin)` layout and by every service
 * behind it (security.md #3, "two locks"). Only the second case can regress
 * without the first noticing.
 *
 * It holds NO role. A learner who acquires one must still be refused — that is
 * the whole point of checking `userType` first — and the suite says so by
 * probing a subject whose refusal cannot be attributed to missing permissions.
 */
const LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL ?? "e2e-learner@mbxpro.com";
const LEARNER_PASSWORD = process.env.E2E_LEARNER_PASSWORD ?? "E2E-Learner-Passw0rd!";

/** One credential user, created the way Better Auth expects to find it. */
async function upsertCredentialUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: "STAFF" | "LEARNER";
}) {
  // Same Argon2id parameters as the seed's admin (ADR-001), or Better Auth
  // will not verify the password at sign-in.
  const passwordHash = await hash(input.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await db.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      id: randomUUID(),
      email: input.email,
      name: `${input.firstName} ${input.lastName}`,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerified: true,
      userType: input.userType,
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

  return user;
}

export async function createE2eFixtures(): Promise<void> {
  const viewer = await upsertCredentialUser({
    email: VIEWER_EMAIL,
    password: VIEWER_PASSWORD,
    firstName: "E2E",
    lastName: "Viewer",
    userType: "STAFF",
  });

  const role = await db.role.findUniqueOrThrow({ where: { key: VIEWER_ROLE_KEY } });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: viewer.id, roleId: role.id } },
    update: {},
    create: { userId: viewer.id, roleId: role.id },
  });

  await upsertCredentialUser({
    email: LEARNER_EMAIL,
    password: LEARNER_PASSWORD,
    firstName: "E2E",
    lastName: "Learner",
    userType: "LEARNER",
  });

  await addKeyTakeaways();

  console.log(`  e2e fixtures: ${VIEWER_EMAIL} (${VIEWER_ROLE_KEY}, read-only on articles)`);
  console.log(`  e2e fixtures: ${LEARNER_EMAIL} (LEARNER, no role)`);
}

/**
 * Key takeaways on the sample article (changes-29 B4).
 *
 * The public block renders only when the list is non-empty, so without this
 * the one AI-adjacent surface a VISITOR ever sees is absent from every page
 * the suite loads — and "axe on B4's public takeaways block" was owed to
 * Module 14. A fixture rather than a seed change: the seed is the state a
 * fresh install gets, and a fresh install has no takeaways.
 *
 * `ArticleTranslation.keyTakeaways` is an ORDINARY column (ADR-097): nothing
 * about it records who wrote the words, which is the point — the block cannot
 * look different for being machine-written, and nor can this fixture.
 */
async function addKeyTakeaways(): Promise<void> {
  const translation = await db.articleTranslation.findFirst({
    where: { slug: ARTICLE_SLUG },
    select: { id: true },
  });
  if (!translation) return;

  await db.articleTranslation.update({
    where: { id: translation.id },
    data: {
      keyTakeaways: [
        "Risk no more than 1-2% of your account on a single trade.",
        "A stop loss is decided before the entry, never after it moves against you.",
        "Position size follows from the stop distance, not from conviction.",
      ],
    },
  });
}

// CLI entrypoint — the Playwright global setup invokes this file directly.
if (process.argv[1] && import.meta.url.endsWith("e2e-fixtures.ts")) {
  const { config } = await import("dotenv");
  config({ path: new URL("../../../.env", import.meta.url).pathname });
  await createE2eFixtures();
  await db.$disconnect();
}
