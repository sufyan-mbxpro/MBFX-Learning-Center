import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Root .env — proxy.test.ts's getCookieCache call needs BETTER_AUTH_SECRET.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
