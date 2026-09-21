import { toNextJsHandler } from "better-auth/next-js";
import { authInstance, onEmailVerified } from "@repo/auth";
import { activateAccountSubscription } from "@repo/core";

// Mounts Better Auth at /api/auth/*. ADR-001 finding #4: rate limiting only
// runs on requests routed through this handler, not on direct auth.api.*()
// calls — sign-in/sign-up/reset flows must go through here, not be called
// server-side directly from a Server Action.
export const { GET, POST } = toNextJsHandler(authInstance);

// ADR-124: a newsletter opt-in ticked at sign-up becomes ACTIVE when the
// account's email is verified. Registered HERE, in the module that mounts the
// handler the verification link reaches, because `@repo/auth` may not import
// `@repo/core` (ADR-078) — so the app wires the two together.
onEmailVerified("newsletter", (user) => activateAccountSubscription(user.id));
