import { toNextJsHandler } from "better-auth/next-js";
import { authInstance } from "@repo/auth";

// Mounts Better Auth at /api/auth/*. ADR-001 finding #4: rate limiting only
// runs on requests routed through this handler, not on direct auth.api.*()
// calls — sign-in/sign-up/reset flows must go through here, not be called
// server-side directly from a Server Action.
export const { GET, POST } = toNextJsHandler(authInstance);
