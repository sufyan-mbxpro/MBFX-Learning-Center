// Google reCAPTCHA v3 (ADR-156) — the server half.
//
// The configuration is DATA: Settings → General → reCAPTCHA edits one
// `CaptchaConfig` row (on/off, site key, sealed secret key, minimum score).
// This file owns that row. It reads it, writes it, and applies it:
//
//   - `recaptchaGuard()` is a Better Auth plugin that refuses `/sign-in/email`
//     and `/sign-up/email` without a passing token. Every credential form on
//     both surfaces posts there (ADR-052), so the staff sign-in and the
//     learner pair are one guard. It reads the row on each guarded request,
//     so switching the tab on or off takes effect at once, without a restart.
//   - `verifyCaptchaToken()` is the same check for a form that is not a Better
//     Auth endpoint: the support form's server action.
//
// **The secret is security.md #10's fourth sealed database secret.** It is
// AES-256-GCM under CAPTCHA_SECRET_KEY, write-only in the UI, and
// `loadCaptchaRuntime()` is its one reader. `CaptchaSettingsView` has no
// secret property at all.
//
// **Two failure directions, deliberately.** A TOKEN that fails (missing, low
// score, wrong action, Google's own "no", Google unreachable) is refused: that
// is the check doing its job. A CONFIGURATION we cannot use (the sealing key
// is gone, the row is half-filled) turns the check OFF and logs it. Failing
// closed there would refuse every sign-in, including the admin who has to
// sign in to fix it. `CAPTCHA_DISABLED=1` in the environment is the break-glass
// switch for the one lockout left: Google itself being down.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { BetterAuthPlugin } from "better-auth";
import {
  CAPTCHA_ACTIONS,
  CAPTCHA_HEADER,
  DEFAULT_CAPTCHA_MIN_SCORE,
  type CaptchaAction,
  type CaptchaSettingsSaveInput,
} from "@repo/contracts";
import { db } from "@repo/db";
import { hasSecretKey, openSecret, sealSecret } from "@repo/secrets";

export const CAPTCHA_SEAL_ENV = "CAPTCHA_SECRET_KEY";
export const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** The auth endpoints the guard covers, relative to Better Auth's base path. */
export const CAPTCHA_AUTH_ENDPOINTS: readonly string[] = ["/sign-in/email", "/sign-up/email"];

/**
 * The cache tag the public site-key read carries. It is the `settings:{group}`
 * family (architecture.md #12), because the tab is a Settings → General tab.
 */
export const CAPTCHA_CACHE_TAG = "settings:captcha";

const CONFIG_ID = "default";

/** A hanging Google must not hang the form: refuse after this long. */
const VERIFY_TIMEOUT_MS = 10_000;

// ─── Reading the row ──────────────────────────────────────────

/** What the guard and the support form need, or `null` when the check is off. */
export interface CaptchaRuntime {
  siteKey: string;
  secretKey: string;
  minScore: number;
}

/** The break-glass switch. Any non-empty value other than `0`/`false` is "off". */
export function captchaForcedOff(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.CAPTCHA_DISABLED?.trim().toLowerCase();
  return raw !== undefined && raw !== "" && raw !== "0" && raw !== "false";
}

interface CaptchaRow {
  enabled: boolean;
  siteKey: string | null;
  secretKeyCipher: string | null;
  minScore: number;
}

/**
 * Pure: the row → the runtime config. Off unless the row is switched on AND
 * complete AND its secret opens. `open` is injected so a test can fail it.
 */
export function resolveCaptchaRuntime(
  row: CaptchaRow | null,
  open: (sealed: string) => string,
): CaptchaRuntime | null {
  if (!row?.enabled || !row.siteKey || !row.secretKeyCipher) return null;
  let secretKey: string;
  try {
    secretKey = open(row.secretKeyCipher);
  } catch (error) {
    // A lost or rotated CAPTCHA_SECRET_KEY. Off, loudly, never "refuse all".
    console.error("reCAPTCHA is switched on but its secret key cannot be opened.", error);
    return null;
  }
  if (!secretKey) return null;
  const minScore = row.minScore > 0 && row.minScore <= 1 ? row.minScore : DEFAULT_CAPTCHA_MIN_SCORE;
  return { siteKey: row.siteKey, secretKey, minScore };
}

/** The ONE reader of the sealed secret. Uncached: the guard must see a switch-off at once. */
export async function loadCaptchaRuntime(): Promise<CaptchaRuntime | null> {
  if (captchaForcedOff()) return null;
  const row = await db.captchaConfig.findUnique({
    where: { id: CONFIG_ID },
    select: { enabled: true, siteKey: true, secretKeyCipher: true, minScore: true },
  });
  return resolveCaptchaRuntime(row, (sealed) => openSecret(sealed, CAPTCHA_SEAL_ENV));
}

/**
 * The site key a public form needs, or `null` when the check is off. Cached
 * and tagged, so a static page carries it and a save in the tab revalidates
 * it. It holds nothing secret: the site key is in the page by design.
 *
 * "Off" follows the rule the guard uses, so a page is never told to mint
 * tokens the server would not check, or the reverse, beyond the moment
 * between a save and the revalidation.
 */
export async function getCaptchaSiteKey(): Promise<string | null> {
  "use cache";
  cacheTag(CAPTCHA_CACHE_TAG);
  cacheLife({ revalidate: 300 });
  const runtime = await loadCaptchaRuntime();
  return runtime?.siteKey ?? null;
}

// ─── Checking a token ─────────────────────────────────────────

/** The part of Google's siteverify answer this decision reads. */
export interface RecaptchaVerifyResponse {
  success?: boolean;
  score?: number;
  action?: string;
}

/**
 * Pure: does this siteverify answer pass? All three must hold. Google says the
 * token is genuine, the score clears the bar, and the token was minted for THIS
 * form's action, so a support-form token replayed at sign-in fails here.
 */
export function recaptchaPasses(
  response: RecaptchaVerifyResponse,
  expected: { action: CaptchaAction; minScore: number },
): boolean {
  if (response.success !== true) return false;
  if (typeof response.score !== "number" || response.score < expected.minScore) return false;
  return response.action === expected.action;
}

/** One siteverify call. Fails closed: any error is a failed check. */
export async function checkRecaptchaToken(input: {
  secretKey: string;
  token: string | null | undefined;
  action: CaptchaAction;
  minScore: number;
  remoteIp?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (!input.token) return false;
  const body = new URLSearchParams({ secret: input.secretKey, response: input.token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);
  try {
    const response = await (input.fetchImpl ?? fetch)(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as RecaptchaVerifyResponse;
    return recaptchaPasses(data, { action: input.action, minScore: input.minScore });
  } catch {
    return false;
  }
}

/**
 * The check for a form that is not a Better Auth endpoint (the support form).
 * `true` when the check is off; otherwise the token must pass.
 */
export async function verifyCaptchaToken(input: {
  token: string | null | undefined;
  action: CaptchaAction;
  remoteIp?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const runtime = await loadCaptchaRuntime();
  if (!runtime) return true;
  return checkRecaptchaToken({
    ...input,
    secretKey: runtime.secretKey,
    minScore: runtime.minScore,
  });
}

// ─── The auth guard ───────────────────────────────────────────

/** The path a request is for, relative to Better Auth's base path. */
export function authPath(url: string, basePath: string): string {
  const pathname = new URL(url).pathname;
  const relative = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  return relative.replace(/\/+$/, "") || "/";
}

/** `x-real-ip` first: the same order as `advanced.ipAddress` (changes-49). */
function requestIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

function refusal(status: number, code: "MISSING_RESPONSE" | "VERIFICATION_FAILED") {
  const message =
    code === "MISSING_RESPONSE" ? "Missing CAPTCHA response" : "Captcha verification failed";
  return { response: Response.json({ message, code }, { status }) };
}

/**
 * The guard on the credential endpoints. The error codes are the ones Better
 * Auth's own `captcha` plugin uses, so the browser helper reads either. That
 * plugin is not used because its keys are fixed when the server starts, and
 * these come from the settings tab.
 *
 * `onRequest` sees HTTP requests only. A server-side `auth.api.*` call (the
 * seed, an integration test) is not a browser and is not asked for a token.
 */
export function recaptchaGuard(): BetterAuthPlugin {
  return {
    id: "mbx-recaptcha",
    onRequest: async (request, ctx) => {
      const path = authPath(request.url, ctx.options.basePath ?? "/api/auth");
      if (!CAPTCHA_AUTH_ENDPOINTS.includes(path)) return;
      const runtime = await loadCaptchaRuntime();
      if (!runtime) return;
      const token = request.headers.get(CAPTCHA_HEADER);
      if (!token) return refusal(400, "MISSING_RESPONSE");
      const passed = await checkRecaptchaToken({
        secretKey: runtime.secretKey,
        token,
        action: CAPTCHA_ACTIONS.auth,
        minScore: runtime.minScore,
        remoteIp: requestIp(request.headers),
      });
      return passed ? undefined : refusal(403, "VERIFICATION_FAILED");
    },
  };
}

// ─── The settings tab ─────────────────────────────────────────

/** What the tab renders. No secret, only whether one is saved. */
export interface CaptchaSettingsView {
  enabled: boolean;
  siteKey: string;
  hasSecretKey: boolean;
  minScore: number;
  lastVerifiedAt: string | null;
  /** CAPTCHA_SECRET_KEY is set and usable, so a secret can be saved at all. */
  sealKeyPresent: boolean;
  /** CAPTCHA_DISABLED is set: whatever the tab says, the check is off. */
  forcedOff: boolean;
}

export async function loadCaptchaSettings(): Promise<CaptchaSettingsView> {
  const row = await db.captchaConfig.findUnique({ where: { id: CONFIG_ID } });
  return {
    enabled: row?.enabled ?? false,
    siteKey: row?.siteKey ?? "",
    hasSecretKey: Boolean(row?.secretKeyCipher),
    minScore: row?.minScore ?? DEFAULT_CAPTCHA_MIN_SCORE,
    lastVerifiedAt: row?.lastVerifiedAt?.toISOString() ?? null,
    sealKeyPresent: hasSecretKey(CAPTCHA_SEAL_ENV),
    forcedOff: captchaForcedOff(),
  };
}

/** Why a save was refused. Each one names a thing the admin can fix. */
export type CaptchaSaveRefusal =
  /** CAPTCHA_SECRET_KEY is not set, so a secret cannot be stored. */
  | "sealKeyMissing"
  /** Switching on with no secret saved or typed. */
  | "secretRequired"
  /** The browser's token did not pass with these keys. */
  | "checkFailed";

export type CaptchaSaveResult = { ok: true } | { ok: false; reason: CaptchaSaveRefusal };

/**
 * Saves the tab. The caller has already run `requirePermission` and parsed
 * the input with `captchaSettingsSaveSchema`.
 *
 * **Switching on is proved, not trusted.** The browser mints a token with the
 * site key being saved, and it has to pass with the secret being saved
 * (typed now, or the one already stored). Keys that do not work would refuse
 * every sign-in, and the admin could not sign back in to undo it. Switching
 * off, or saving while off, needs no proof.
 */
export async function saveCaptchaSettings(
  actorId: string,
  input: CaptchaSettingsSaveInput,
  options: { remoteIp?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<CaptchaSaveResult> {
  const before = await db.captchaConfig.findUnique({ where: { id: CONFIG_ID } });
  const typedSecret = input.secretKey?.trim() ?? "";
  if (typedSecret && !hasSecretKey(CAPTCHA_SEAL_ENV)) {
    return { ok: false, reason: "sealKeyMissing" };
  }

  let secretKey = typedSecret;
  if (!secretKey && before?.secretKeyCipher) {
    try {
      secretKey = openSecret(before.secretKeyCipher, CAPTCHA_SEAL_ENV);
    } catch {
      secretKey = "";
    }
  }

  const siteKey = input.siteKey.trim();
  let lastVerifiedAt = before?.lastVerifiedAt ?? null;
  if (input.enabled) {
    if (!secretKey) return { ok: false, reason: "secretRequired" };
    const passed = await checkRecaptchaToken({
      secretKey,
      token: input.checkToken,
      action: CAPTCHA_ACTIONS.check,
      minScore: input.minScore,
      remoteIp: options.remoteIp,
      fetchImpl: options.fetchImpl,
    });
    if (!passed) return { ok: false, reason: "checkFailed" };
    lastVerifiedAt = new Date();
  } else if (siteKey !== (before?.siteKey ?? "") || typedSecret) {
    // New keys that were never checked: what the last check proved is gone.
    lastVerifiedAt = null;
  }

  const data = {
    enabled: input.enabled,
    siteKey: siteKey || null,
    minScore: input.minScore,
    lastVerifiedAt,
    updatedBy: actorId,
    ...(typedSecret ? { secretKeyCipher: sealSecret(typedSecret, CAPTCHA_SEAL_ENV) } : {}),
  };
  await db.captchaConfig.upsert({
    where: { id: CONFIG_ID },
    update: data,
    create: { id: CONFIG_ID, ...data },
  });

  // security.md #5. Never the secret, only whether it changed.
  await db.auditLog.create({
    data: {
      userId: actorId,
      action: "settings.captcha.update",
      entityType: "CaptchaConfig",
      entityId: CONFIG_ID,
      changes: {
        before: before
          ? { enabled: before.enabled, siteKey: before.siteKey, minScore: before.minScore }
          : null,
        after: { enabled: input.enabled, siteKey: siteKey || null, minScore: input.minScore },
        secretKeyChanged: Boolean(typedSecret),
      },
    },
  });

  revalidateTag(CAPTCHA_CACHE_TAG, { expire: 0 });
  return { ok: true };
}
