// Shared bootstrapping for the two changes-46 commands (ADR-144 §1):
// `seed:export-defaults` and `seed:live`.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED_LIVE_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SEED_LIVE_DIR, "../../..");
export const MEDIA_DIR = join(SEED_LIVE_DIR, "media");
export const DEFAULTS_FILE = join(SEED_LIVE_DIR, "defaults.json");

/**
 * The repo-root `.env`, as `prisma.config.ts` and `next.config.ts` load it.
 * A variable already in the process environment wins (`loadEnvFile` never
 * overwrites), so a production shell's exported values are what count.
 */
export function loadRootEnv(): void {
  const file = join(REPO_ROOT, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * Pin the storage root to the one the APP reads.
 *
 * `uploadsRootDir()` falls back to `<cwd>/storage/uploads`, and the app runs
 * with `apps/web` as its cwd while this command runs from `packages/core`.
 * Without this, every image the seed stores would land in a directory the site
 * never serves from — the rows would exist and every picture would 404.
 * An explicit `UPLOADS_DIR` (production) is left alone.
 */
export function pinUploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (!configured) {
    process.env.UPLOADS_DIR = join(REPO_ROOT, "apps", "web", "storage", "uploads");
  }
  return process.env.UPLOADS_DIR as string;
}
