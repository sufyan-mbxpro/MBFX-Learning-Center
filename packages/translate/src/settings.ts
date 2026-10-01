// Settings → Translation (ADR-160). The caller has already run
// `requirePermission("translations.provider.manage")` and parsed the input
// with the `@repo/contracts` schema; this is the service behind it.
//
// Three properties, the reCAPTCHA tab's (ADR-156) applied to a new key:
//
//   1. **The key is write-only.** The view says whether one is saved, never
//      what it is, and a blank field keeps the saved one.
//   2. **Switching on is proved.** A test translation has to pass with the
//      key being saved (typed now, or the one stored) before `enabled` may
//      become true. A key that does not work would fail every job.
//   3. **Every change is audited, and the key never is** — only whether it
//      changed (security.md #5).
import { db } from "@repo/db";
import type {
  TranslateReason,
  TranslateSettingsSaveInput,
  TranslateTestInput,
} from "@repo/contracts";

import { reasonOf } from "./errors.ts";
import { loadTranslateDriver, PROVIDER_ID } from "./provider.ts";
import { hasTranslateSecretKey, sealTranslateKey } from "./secret.ts";
import { getPeriodUsage, recordUsage, type PeriodUsage } from "./usage.ts";

/** What "Test connection" translates: short, fixed, and cheap. */
export const TEST_SAMPLE = "Hello, world.";
const TEST_SOURCE = "en";
const TEST_TARGET = "es";

export interface TranslateSettingsView {
  enabled: boolean;
  hasApiKey: boolean;
  pricePerMillionChars: number;
  monthlyCharBudget: number | null;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  /** TRANSLATE_SECRET_KEY is set and usable, so a key can be saved at all. */
  sealKeyPresent: boolean;
  usage: PeriodUsage;
}

export async function loadTranslateSettings(
  now: Date = new Date(),
): Promise<TranslateSettingsView> {
  const [row, usage] = await Promise.all([
    db.translateProvider.findUnique({
      where: { id: PROVIDER_ID },
      // Deliberately not the cipher: `hasStoredKey()` asks the database.
      select: {
        enabled: true,
        pricePerMillionChars: true,
        monthlyCharBudget: true,
        lastTestedAt: true,
        lastTestResult: true,
      },
    }),
    getPeriodUsage(now),
  ]);
  return {
    enabled: row?.enabled ?? false,
    hasApiKey: await hasStoredKey(),
    pricePerMillionChars: row ? Number(row.pricePerMillionChars) : 20,
    monthlyCharBudget: row?.monthlyCharBudget ?? null,
    lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    lastTestResult: row?.lastTestResult ?? null,
    sealKeyPresent: hasTranslateSecretKey(),
    usage,
  };
}

/** Why a save or a test was refused. Each names something the admin can fix. */
export type TranslateSettingsRefusal =
  /** TRANSLATE_SECRET_KEY is not set, so a key cannot be stored. */
  | "sealKeyMissing"
  /** Switching on, or testing, with no key typed or saved. */
  | "keyRequired"
  /** The test translation failed; the reason says how. */
  | TranslateReason;

export type TranslateSettingsResult =
  { ok: true } | { ok: false; reason: TranslateSettingsRefusal };

/**
 * Runs the test translation with a typed key or the stored one, records the
 * attempt in the usage log, and returns its reason ("ok" on success).
 */
async function runTest(
  actorId: string,
  apiKey: string | undefined,
): Promise<"ok" | TranslateReason> {
  const started = Date.now();
  let price = 20;
  try {
    const { driver, config } = await loadTranslateDriver({ includeDisabled: true, apiKey });
    price = config.pricePerMillionChars;
    const [answer] = await driver.translate({
      segments: [TEST_SAMPLE],
      source: TEST_SOURCE,
      target: TEST_TARGET,
      format: "text",
    });
    const ok = typeof answer === "string" && answer.trim() !== "";
    await recordUsage({
      status: ok ? "OK" : "FAILED",
      reason: ok ? null : "network_error",
      sourceLocale: TEST_SOURCE,
      targetLocale: TEST_TARGET,
      format: "TEXT",
      segments: 1,
      characters: TEST_SAMPLE.length,
      pricePerMillionChars: price,
      durationMs: Date.now() - started,
      userId: actorId,
      entityType: "TranslateProvider",
      entityId: PROVIDER_ID,
    });
    return ok ? "ok" : "network_error";
  } catch (error) {
    const reason = reasonOf(error);
    await recordUsage({
      status: reason === "not_configured" || reason === "seal_unavailable" ? "REFUSED" : "FAILED",
      reason,
      sourceLocale: TEST_SOURCE,
      targetLocale: TEST_TARGET,
      format: "TEXT",
      segments: 1,
      characters: 0,
      pricePerMillionChars: price,
      durationMs: Date.now() - started,
      userId: actorId,
      entityType: "TranslateProvider",
      entityId: PROVIDER_ID,
    });
    return reason;
  }
}

async function hasStoredKey(): Promise<boolean> {
  return (
    (await db.translateProvider.count({
      where: { id: PROVIDER_ID, apiKeyCipher: { not: null } },
    })) > 0
  );
}

/** "Test connection". Records when and how it went; changes nothing else. */
export async function testTranslateConnection(
  actorId: string,
  input: TranslateTestInput,
): Promise<TranslateSettingsResult> {
  const typed = input.apiKey?.trim() || undefined;
  if (!typed && !(await hasStoredKey())) return { ok: false, reason: "keyRequired" };

  const result = await runTest(actorId, typed);
  const testedAt = new Date();
  await db.translateProvider.upsert({
    where: { id: PROVIDER_ID },
    // A typed key's result says nothing about the stored one, so only a test
    // of the STORED key is kept as the row's last result.
    update: typed ? {} : { lastTestedAt: testedAt, lastTestResult: result },
    create: typed
      ? { id: PROVIDER_ID }
      : { id: PROVIDER_ID, lastTestedAt: testedAt, lastTestResult: result },
  });
  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "settings.translate.test",
      entityType: "TranslateProvider",
      entityId: PROVIDER_ID,
      changes: { result, typedKey: Boolean(typed) },
    },
  });
  return result === "ok" ? { ok: true } : { ok: false, reason: result };
}

export async function saveTranslateSettings(
  actorId: string,
  input: TranslateSettingsSaveInput,
): Promise<TranslateSettingsResult> {
  const typed = input.apiKey?.trim() || undefined;
  if (typed && !hasTranslateSecretKey()) return { ok: false, reason: "sealKeyMissing" };

  const before = await db.translateProvider.findUnique({
    where: { id: PROVIDER_ID },
    select: {
      enabled: true,
      pricePerMillionChars: true,
      monthlyCharBudget: true,
      lastTestedAt: true,
      lastTestResult: true,
    },
  });

  let lastTestedAt = before?.lastTestedAt ?? null;
  let lastTestResult = before?.lastTestResult ?? null;
  if (input.enabled) {
    if (!typed && !(await hasStoredKey())) return { ok: false, reason: "keyRequired" };
    const result = await runTest(actorId, typed);
    if (result !== "ok") return { ok: false, reason: result };
    lastTestedAt = new Date();
    lastTestResult = "ok";
  } else if (typed) {
    // A new key nobody tested: what the last test proved is gone.
    lastTestedAt = null;
    lastTestResult = null;
  }

  const data = {
    enabled: input.enabled,
    pricePerMillionChars: input.pricePerMillionChars.toFixed(6),
    monthlyCharBudget: input.monthlyCharBudget,
    lastTestedAt,
    lastTestResult,
    updatedBy: actorId,
    ...(typed ? { apiKeyCipher: sealTranslateKey(typed) } : {}),
  };
  await db.translateProvider.upsert({
    where: { id: PROVIDER_ID },
    update: data,
    create: { id: PROVIDER_ID, ...data },
  });

  // security.md #5. Never the key, only whether it changed.
  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "settings.translate.update",
      entityType: "TranslateProvider",
      entityId: PROVIDER_ID,
      changes: {
        before: before
          ? {
              enabled: before.enabled,
              pricePerMillionChars: Number(before.pricePerMillionChars),
              monthlyCharBudget: before.monthlyCharBudget,
            }
          : null,
        after: {
          enabled: input.enabled,
          pricePerMillionChars: input.pricePerMillionChars,
          monthlyCharBudget: input.monthlyCharBudget,
        },
        apiKeyChanged: Boolean(typed),
      },
    },
  });
  return { ok: true };
}

/**
 * Whether automatic translation can run: switched on with a key saved. No
 * permission and no secret — it is what decides whether an editor DRAWS the
 * "Translate with Google" button (absent, not disabled, as ADR-097's AI
 * affordances are). The action behind the button checks everything again.
 */
export async function isAutoTranslateAvailable(): Promise<boolean> {
  return (
    (await db.translateProvider.count({
      where: { id: PROVIDER_ID, enabled: true, apiKeyCipher: { not: null } },
    })) > 0
  );
}
