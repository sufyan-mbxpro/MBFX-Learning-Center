// `pnpm seed:export-defaults` (ADR-144 §1) — snapshot THIS install's theme,
// brand assets, settings, flags and provider configuration into the committed
// `defaults.json`, so `pnpm seed:live` can bring a fresh server up looking and
// behaving exactly like this one.
//
// Run it on a development machine against the database whose look you want to
// ship, then commit `defaults.json` and `media/defaults/`. Never on a server.
//
// What it will NOT export, by construction:
//   - the three sealed secrets (SMTP password, market key, AI key) — the
//     columns are never selected; the live seed reads keys from SEED_* env;
//   - the SMTP transport at all (host and username come from env too);
//   - any setting whose key looks like a secret (`assertNotSecret` throws).
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "@repo/db";
import { SETTINGS_SCHEMAS } from "@repo/contracts";
import { DEFAULTS_FILE, MEDIA_DIR, loadRootEnv, pinUploadsRoot } from "./env.ts";
import { assertNotSecret, type DefaultsFile } from "./defaults-file.ts";

const UPLOAD_URL = /^\/uploads\/([A-Za-z0-9][A-Za-z0-9/_.-]*)$/;
const EXPORT_DIR = join(MEDIA_DIR, "defaults");

function slug(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Copy an uploaded file into `media/defaults/` and return its path relative to `media/`. */
function copyUpload(uploadsRoot: string, url: string, name: string): string | null {
  const match = UPLOAD_URL.exec(url);
  if (!match || match[1]?.includes("..")) return null;
  const source = join(uploadsRoot, match[1] as string);
  if (!existsSync(source)) {
    console.warn(`  ! ${url} is referenced but not on disk — left as-is`);
    return null;
  }
  const file = `${slug(name)}${extname(source).toLowerCase()}`;
  copyFileSync(source, join(EXPORT_DIR, file));
  return `defaults/${file}`;
}

/** Replace every `/uploads/…` string inside a setting value with a `$file` ref. */
function withFileRefs(uploadsRoot: string, key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (!UPLOAD_URL.test(value)) return value;
    const file = copyUpload(uploadsRoot, value, `setting-${key}`);
    return file ? { $file: file } : value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => withFileRefs(uploadsRoot, `${key}-${index}`, item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, withFileRefs(uploadsRoot, `${key}-${k}`, v)]),
    );
  }
  return value;
}

async function main(): Promise<void> {
  loadRootEnv();
  const uploadsRoot = pinUploadsRoot();
  rmSync(EXPORT_DIR, { recursive: true, force: true });
  mkdirSync(EXPORT_DIR, { recursive: true });

  const theme = await db.theme.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const brandRows = await db.brandAsset.findMany({ orderBy: { key: "asc" } });
  const brandAssets: DefaultsFile["brandAssets"] = brandRows.map((row) => {
    const file = copyUpload(uploadsRoot, row.url, `brand-${row.key}`);
    return file
      ? { key: row.key, altText: row.altText, file }
      : { key: row.key, altText: row.altText, url: row.url };
  });

  // Only keys the typed registry knows: a row the registry has dropped cannot
  // be written back through `updateSettings` anyway.
  const registered = new Set(Object.keys(SETTINGS_SCHEMAS));
  const settingRows = await db.setting.findMany({ orderBy: { key: "asc" } });
  const settings: Record<string, unknown> = {};
  for (const row of settingRows) {
    if (!registered.has(row.key)) continue;
    assertNotSecret(row.key);
    settings[row.key] = withFileRefs(uploadsRoot, row.key, row.value);
  }

  const flags = Object.fromEntries(
    (await db.featureFlag.findMany({ orderBy: { key: "asc" } })).map((f) => [f.key, f.isEnabled]),
  );

  // Provider CONFIGURATION only. `apiKeyCipher` is deliberately not selected.
  const market = await db.marketProvider.findFirst({
    select: {
      driver: true,
      baseUrl: true,
      refreshSeconds: true,
      staleSeconds: true,
      isEnabled: true,
    },
  });

  const aiProvider = await db.aiProvider.findFirst({
    where: { isDefault: true, isEnabled: true },
    select: { id: true, kind: true, baseUrl: true },
  });
  const ai: DefaultsFile["ai"] = aiProvider
    ? {
        kind: aiProvider.kind,
        baseUrl: aiProvider.baseUrl,
        models: (
          await db.aiModel.findMany({
            where: { providerId: aiProvider.id, isEnabled: true },
            orderBy: [{ sortOrder: "asc" }, { modelId: "asc" }],
          })
        ).map((m) => ({
          modelId: m.modelId,
          label: m.label,
          inputPricePerMTok: Number(m.inputPricePerMTok),
          outputPricePerMTok: Number(m.outputPricePerMTok),
          cachedInputPricePerMTok:
            m.cachedInputPricePerMTok === null ? null : Number(m.cachedInputPricePerMTok),
          maxOutputTokens: m.maxOutputTokens,
          supportsVision: m.supportsVision,
        })),
        features: (await db.aiFeature.findMany({ orderBy: { key: "asc" } })).map((f) => ({
          key: f.key,
          isEnabled: f.isEnabled,
          maxOutputTokens: f.maxOutputTokens,
          extraInstructions: f.extraInstructions,
        })),
      }
    : null;

  const out: DefaultsFile = {
    exportedAt: new Date().toISOString(),
    theme: theme
      ? {
          key: theme.key,
          name: theme.name,
          description: theme.description,
          brandColors: theme.brandColors,
          lightSurface: theme.lightSurface,
          darkSurface: theme.darkSurface,
          darkBrandOverrides: theme.darkBrandOverrides,
          layoutTokens: theme.layoutTokens,
          defaultMode: theme.defaultMode,
        }
      : null,
    brandAssets,
    settings,
    flags,
    market,
    ai,
  };

  writeFileSync(DEFAULTS_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `Exported theme ${theme?.key ?? "(none)"}, ${brandAssets.length} brand asset(s), ` +
      `${Object.keys(settings).length} setting(s), ${Object.keys(flags).length} flag(s), ` +
      `market ${market?.driver ?? "(none)"}, AI ${ai?.kind ?? "(none)"} → ${DEFAULTS_FILE}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
