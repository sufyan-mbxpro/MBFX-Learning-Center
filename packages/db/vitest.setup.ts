import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Root .env, so `vitest run` here has the same DATABASE_URL/etc. Next.js
// would load automatically for the real app.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
