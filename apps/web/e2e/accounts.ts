/**
 * The accounts the E2E suite signs in as.
 *
 * Kept apart from the provisioning script so a spec can import a credential
 * without pulling `node:child_process` and the Prisma CLI into its module
 * graph — which is what importing `global-setup.ts` used to do.
 */

/** The seeded super admin (`packages/db/prisma/seed.ts`). */
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@mbxpro.com";

/** The read-only staff account created by `packages/db/prisma/e2e-fixtures.ts`. */
export const VIEWER_EMAIL = process.env.E2E_VIEWER_EMAIL ?? "e2e-viewer@mbxpro.com";
export const VIEWER_PASSWORD = process.env.E2E_VIEWER_PASSWORD ?? "E2E-Viewer-Passw0rd!";

/**
 * The LEARNER created by the same file, for the cross-surface probe. Holds no
 * role at all — see `learner-admin-probe.spec.ts`.
 */
export const LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL ?? "e2e-learner@mbxpro.com";
export const LEARNER_PASSWORD = process.env.E2E_LEARNER_PASSWORD ?? "E2E-Learner-Passw0rd!";

/**
 * The admin password has no default on purpose: `SEED_ADMIN_PASSWORD` is
 * dev-only (security.md #10) and a fallback here would be a credential
 * committed to the repository.
 */
export function adminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is not set — the seeded admin has no credential to use.");
  }
  return password;
}
