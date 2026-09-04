import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Root .env — REDIS_URL (real container, shared across test runs; rate-limit
// and session-cache keys are scoped per test run's random emails so this is
// safe) and a fallback BETTER_AUTH_SECRET. DATABASE_URL is overridden per
// test file to point at its own Testcontainers instance.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
