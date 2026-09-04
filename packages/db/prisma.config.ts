import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig, env } from "@prisma/config";

// Loaded explicitly (not the CWD-relative `dotenv/config` default) because
// `pnpm --filter @repo/db <script>` runs with this package as CWD, not the
// repo root where .env actually lives.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

// Prisma 7 (ADR-002): the datasource URL no longer lives in schema.prisma.
// This only feeds Migrate/introspection commands — the runtime PrismaClient
// still needs its own driver adapter (see src/index.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
