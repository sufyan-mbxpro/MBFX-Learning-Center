// Google reCAPTCHA v3 (ADR-156). The names both halves have to agree on — the
// browser that asks Google for a token and the server that checks it — and
// the shape of the Settings → General → reCAPTCHA save.
//
// The keys are DATA, not env: an admin enters them in that tab. The site key
// is public by design (Google puts it in the page). The secret key is sealed
// under CAPTCHA_SECRET_KEY and read by `@repo/auth` alone (security.md #10).
import { z } from "zod";

/** The header the auth guard reads the token from on a credential POST. */
export const CAPTCHA_HEADER = "x-captcha-response";

/** The hidden form field a non-auth form (the support form) carries the token in. */
export const CAPTCHA_FIELD = "captchaToken";

/**
 * reCAPTCHA v3 `action` names. The server REFUSES a token whose action is not
 * the one it expects, so a token minted on one form cannot be replayed at
 * another. `check` is the settings tab's own proof that the keys work, and
 * nothing else accepts it.
 */
export const CAPTCHA_ACTIONS = {
  auth: "auth",
  support: "support",
  check: "check",
} as const;

export type CaptchaAction = (typeof CAPTCHA_ACTIONS)[keyof typeof CAPTCHA_ACTIONS];

/** The scores the settings tab offers. Google suggests 0.5. */
export const CAPTCHA_MIN_SCORES = [0.3, 0.5, 0.7, 0.9] as const;

export const DEFAULT_CAPTCHA_MIN_SCORE = 0.5;

/**
 * Settings → General → reCAPTCHA. `secretKey` blank means "keep the saved
 * one", the SMTP password's rule (ADR-078). `checkToken` is a token the
 * browser minted with THIS site key for the `check` action. Switching the
 * feature on needs one that passes, because keys that do not work would
 * refuse every sign-in, the admin's own included.
 */
export const captchaSettingsSaveSchema = z
  .object({
    enabled: z.boolean(),
    siteKey: z.string().trim().max(100),
    secretKey: z.string().trim().max(100).optional(),
    minScore: z.literal([...CAPTCHA_MIN_SCORES]),
    checkToken: z.string().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    // On needs a site key. Whether a SECRET is saved is the server's to know,
    // so that half is checked in the service, not here.
    if (value.enabled && value.siteKey === "") {
      ctx.addIssue({
        code: "too_small",
        origin: "string",
        minimum: 1,
        inclusive: true,
        path: ["siteKey"],
        input: value.siteKey,
      });
    }
  });

export type CaptchaSettingsSaveInput = z.infer<typeof captchaSettingsSaveSchema>;
