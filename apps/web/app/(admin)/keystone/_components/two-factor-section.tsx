"use client";

// Two-factor enrolment for STAFF (ADR-157 §1). It is drawn in two places: the
// profile page, and the enrolment screen the admin layout shows in place of
// the portal while `security.requireStaffTwoFactor` holds this staff member.
//
// The same Better Auth endpoints as the learner card (ADR-123 #5, #6), through
// `_lib/account-security.ts`. The rate limits live on that handler, every one
// of these calls rotates the session cookie (which only an HTTP response can
// deliver), and the audit rows are written by `@repo/auth`'s hooks, not here.
// Its own component rather than the learner card, which is public-site chrome.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { twoFactorCodeSchema, twoFactorPasswordSchema } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import {
  confirmTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  type SecurityResult,
  type TwoFactorEnrolment,
} from "../../../_lib/account-security.ts";
import { QrCode } from "../../../_lib/qr-code.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";

type Step =
  | { kind: "idle" }
  | { kind: "password"; intent: "enable" | "disable" }
  | { kind: "verify"; enrolment: TwoFactorEnrolment };

export function TwoFactorSection({
  enabled,
  required,
  hasPassword,
  issuer,
  onEnabled,
}: {
  enabled: boolean;
  /** The site requires it (ADR-157 §3): no "Turn off". */
  required: boolean;
  /** An OAuth-only account has nothing for Better Auth to re-confirm with. */
  hasPassword: boolean;
  /** `site.name`, so the authenticator app lists the account under it. */
  issuer: string;
  /** Where to go once it is on. Default: refresh the page. */
  onEnabled?: () => void;
}) {
  const t = useTranslations("admin.twoFactor");
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const passwordForm = useFieldErrors(twoFactorPasswordSchema, { password });
  const codeForm = useFieldErrors(twoFactorCodeSchema, { code });

  const failure = (result: Exclude<SecurityResult<unknown>, { status: "ok" }>) => {
    const key =
      result.status === "wrongPassword" ||
      result.status === "invalidCode" ||
      result.status === "tooMany" ||
      result.status === "signInAgain"
        ? result.status
        : "failed";
    toast.error(t(key));
  };

  const cancel = () => {
    setStep({ kind: "idle" });
    setPassword("");
    setCode("");
    passwordForm.reset();
    codeForm.reset();
  };

  const submitPassword = (intent: "enable" | "disable") => (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordForm.validate()) return;
    startTransition(async () => {
      if (intent === "enable") {
        const result = await enableTwoFactor(password, issuer);
        if (result.status !== "ok") return failure(result);
        setPassword("");
        passwordForm.reset();
        setStep({ kind: "verify", enrolment: result.value });
        return;
      }
      const result = await disableTwoFactor(password);
      if (result.status !== "ok") return failure(result);
      cancel();
      toast.success(t("disabled"));
      router.refresh();
    });
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!codeForm.validate()) return;
    startTransition(async () => {
      const result = await confirmTwoFactor(code.replace(/\s+/g, ""));
      if (result.status !== "ok") return failure(result);
      cancel();
      toast.success(t("enabled"));
      if (onEnabled) onEnabled();
      else router.refresh();
    });
  };

  if (!hasPassword) {
    return <p className="text-sm text-muted-foreground">{t("noPassword")}</p>;
  }

  return (
    <div className="flex flex-col gap-4" data-slot="staff-two-factor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Badge variant={enabled ? "success" : "pill"}>{enabled ? t("on") : t("off")}</Badge>
      </div>

      {step.kind === "idle" &&
        (enabled ? (
          required ? (
            <p className="text-sm text-muted-foreground">{t("requiredNote")}</p>
          ) : (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setStep({ kind: "password", intent: "disable" })}
              >
                <ShieldOff aria-hidden /> {t("disable")}
              </Button>
            </div>
          )
        ) : (
          <div className="flex justify-end">
            <Button onClick={() => setStep({ kind: "password", intent: "enable" })}>
              <ShieldCheck aria-hidden /> {t("enable")}
            </Button>
          </div>
        ))}

      {step.kind === "password" && (
        <form onSubmit={submitPassword(step.intent)} noValidate className="flex flex-col gap-4">
          <Field invalid={passwordForm.invalid("password")} required>
            <FieldLabel>{t("confirmWithPassword")}</FieldLabel>
            <PasswordInput
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>
              {step.intent === "enable" ? t("enablePasswordHint") : t("disablePasswordHint")}
            </FieldDescription>
            <FieldError>{passwordForm.error("password")}</FieldError>
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={cancel}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              loading={pending}
              variant={step.intent === "disable" ? "destructive" : "default"}
            >
              {step.intent === "enable" ? t("continue") : t("disable")}
            </Button>
          </div>
        </form>
      )}

      {step.kind === "verify" && (
        <form onSubmit={submitCode} noValidate className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm text-muted-foreground">
            <li>{t("stepScan")}</li>
            <li>{t("stepCode")}</li>
          </ol>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <QrCode value={step.enrolment.totpURI} label={t("qrLabel")} />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t("manualEntry")}</p>
              {/* The setup key is read character by character (code-style #6's exception). */}
              <p className="font-mono text-sm break-all select-all" data-slot="totp-secret">
                {step.enrolment.secret}
              </p>
            </div>
          </div>
          {step.enrolment.backupCodes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-4">
              <p className="text-sm font-medium">{t("backupTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("backupHint")}</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm select-all">
                {step.enrolment.backupCodes.map((backup) => (
                  <li key={backup}>{backup}</li>
                ))}
              </ul>
            </div>
          )}
          <Field invalid={codeForm.invalid("code")} required>
            <FieldLabel>{t("code")}</FieldLabel>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <FieldError>{codeForm.error("code")}</FieldError>
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={cancel}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("verifyAndEnable")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
