// Credential constants shared by the auth CONFIG and the screens that have
// to describe it to a user (ADR-052's public sign-up needs to state the
// minimum and set `minLength` on the input). They live here rather than in
// `@repo/auth` so the public route graph can read them without pulling in
// Better Auth, Prisma and ioredis — and so the number a learner is shown
// cannot drift from the one the server enforces.

/** `emailAndPassword.minPasswordLength` in `@repo/auth`. */
export const MIN_PASSWORD_LENGTH = 8;

/** `emailAndPassword.maxPasswordLength` in `@repo/auth`. */
export const MAX_PASSWORD_LENGTH = 128;
