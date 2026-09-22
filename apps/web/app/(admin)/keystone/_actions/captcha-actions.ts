"use server";

// Settings → General → reCAPTCHA (ADR-156). The service is `@repo/auth`'s,
// because the guard that applies these keys lives there. It is the same split
// as `setUserPassword` and `impersonateLearner` in `user-actions.ts`.
import { headers } from "next/headers";
import { saveCaptchaSettings, type CaptchaSaveResult } from "@repo/auth";
import { captchaSettingsSaveSchema } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";
import { clientIp } from "../../../_lib/client-ip.ts";

/**
 * `settings.update`, the key every other General tab saves under. The one
 * harm this adds is refusing every sign-in with keys that do not work, and
 * the service will not switch the check on until a browser token has passed
 * with the keys being saved.
 */
export async function saveCaptchaSettingsAction(input: unknown): Promise<CaptchaSaveResult> {
  const subject = await requirePermission("settings.update");
  const parsed = captchaSettingsSaveSchema.parse(input);
  return saveCaptchaSettings(subject.id, parsed, { remoteIp: clientIp(await headers()) });
}
