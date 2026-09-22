"use client";

// Password and two-factor (ADR-123 #5, #6).
//
// Both talk to Better Auth's own handler through `_lib/account-security.ts`:
// the rate limits live there, and every one of these calls rotates the session
// cookie, which only an HTTP response can deliver. The audit rows are written
// by `@repo/auth`'s hooks on the server, not by anything here.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, LockKeyhole, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import {
  changePasswordFormSchema,
  twoFactorCodeSchema,
  twoFactorPasswordSchema,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import {
  changePassword,
  confirmTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  type SecurityResult,
  type TwoFactorEnrolment,
} from "../../../../_lib/account-security.ts";
import { AccountCard } from "./account-card.tsx";
import { NoticeLine } from "./profile-panel.tsx";
import { QrCode } from "../../../../_lib/qr-code.tsx";
import { useAccountForm } from "./use-account-form.ts";

type Notice = { tone: "success" | "error"; text: string } | null;

export function SecurityPanel({
  hasPassword,
  twoFactorEnabled,
  issuer,
}: {
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  issuer: string;
}) {
  const t = useTranslations("account.security");

  const failureText = (result: Exclude<SecurityResult<unknown>, { status: "ok" }>) => {
    switch (result.status) {
      case "wrongPassword":
        return t("wrongPassword");
      case "invalidCode":
        return t("invalidCode");
      case "tooMany":
        return t("tooMany");
      default:
        return t("failed");
    }
  };

  return (
    <AccountCard
      id="account-security"
      icon={LockKeyhole}
      tone="warning"
      title={t("title")}
      description={t("description")}
      status={
        hasPassword &&
        (twoFactorEnabled ? (
          <Badge variant="success">
            <ShieldCheck aria-hidden /> {t("protected")}
          </Badge>
        ) : (
          <Badge variant="outline-warning">
            <ShieldAlert aria-hidden /> {t("basic")}
          </Badge>
        ))
      }
    >
      {hasPassword ? (
        <>
          <PasswordForm failureText={failureText} />
          <hr className="border-border" />
          <TwoFactor enabled={twoFactorEnabled} issuer={issuer} failureText={failureText} />
        </>
      ) : (
        // An OAuth-only account has no password to change and nothing for
        // Better Auth's 2FA endpoints to re-confirm with.
        <p className="text-sm text-muted-foreground">{t("noPassword")}</p>
      )}
    </AccountCard>
  );
}

type FailureText = (result: Exclude<SecurityResult<unknown>, { status: "ok" }>) => string;

function PasswordForm({ failureText }: { failureText: FailureText }) {
  const t = useTranslations("account.security");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  const form = useAccountForm(changePasswordFormSchema, {
    currentPassword: current,
    newPassword: next,
    confirmPassword: confirm,
  });
  // A filled confirmation can only fail by not matching.
  const confirmError =
    form.invalid("confirmPassword") && confirm ? t("mismatch") : form.error("confirmPassword");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!form.validate()) return;
    startTransition(async () => {
      const result = await changePassword(current, next);
      if (result.status === "ok") {
        setCurrent("");
        setNext("");
        setConfirm("");
        form.reset();
        setNotice({ tone: "success", text: t("passwordChanged") });
      } else {
        setNotice({ tone: "error", text: failureText(result) });
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound aria-hidden className="size-4 text-warning-interactive" /> {t("passwordTitle")}
      </h3>
      <Field invalid={form.invalid("currentPassword")} required>
        <FieldLabel>{t("currentPassword")}</FieldLabel>
        <PasswordInput
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <FieldError>{form.error("currentPassword")}</FieldError>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field invalid={form.invalid("newPassword")} required>
          <FieldLabel>{t("newPassword")}</FieldLabel>
          <PasswordInput
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <FieldError>{form.error("newPassword")}</FieldError>
        </Field>
        <Field invalid={form.invalid("confirmPassword")} required>
          <FieldLabel>{t("confirmPassword")}</FieldLabel>
          <PasswordInput
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FieldError>{confirmError}</FieldError>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <NoticeLine notice={notice} />
        <Button type="submit" loading={pending}>
          {t("changePassword")}
        </Button>
      </div>
    </form>
  );
}

type TwoFactorStep =
  | { kind: "idle" }
  | { kind: "password"; intent: "enable" | "disable" }
  | { kind: "verify"; enrolment: TwoFactorEnrolment };

function TwoFactor({
  enabled,
  issuer,
  failureText,
}: {
  enabled: boolean;
  issuer: string;
  failureText: FailureText;
}) {
  const t = useTranslations("account.security");
  const router = useRouter();
  const [step, setStep] = useState<TwoFactorStep>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();

  const passwordForm = useAccountForm(twoFactorPasswordSchema, { password });
  const codeForm = useAccountForm(twoFactorCodeSchema, { code });

  const cancel = () => {
    setStep({ kind: "idle" });
    setPassword("");
    setCode("");
    passwordForm.reset();
    codeForm.reset();
  };

  const submitPassword = (intent: "enable" | "disable") => (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!passwordForm.validate()) return;
    startTransition(async () => {
      if (intent === "enable") {
        const result = await enableTwoFactor(password, issuer);
        if (result.status !== "ok") {
          setNotice({ tone: "error", text: failureText(result) });
          return;
        }
        setPassword("");
        passwordForm.reset();
        setStep({ kind: "verify", enrolment: result.value });
        return;
      }
      const result = await disableTwoFactor(password);
      if (result.status !== "ok") {
        setNotice({ tone: "error", text: failureText(result) });
        return;
      }
      cancel();
      setNotice({ tone: "success", text: t("twoFactorDisabled") });
      router.refresh();
    });
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!codeForm.validate()) return;
    startTransition(async () => {
      const result = await confirmTwoFactor(code.replace(/\s+/g, ""));
      if (result.status !== "ok") {
        setNotice({ tone: "error", text: failureText(result) });
        return;
      }
      cancel();
      setNotice({ tone: "success", text: t("twoFactorEnabled") });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4" data-slot="two-factor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck aria-hidden className="size-4 text-warning-interactive" />
            {t("twoFactorTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("twoFactorDescription")}</p>
        </div>
        <Badge variant={enabled ? "success" : "pill"}>
          {enabled ? t("twoFactorOn") : t("twoFactorOff")}
        </Badge>
      </div>

      {step.kind === "idle" && (
        <div>
          {enabled ? (
            <Button
              variant="outline"
              onClick={() => setStep({ kind: "password", intent: "disable" })}
            >
              <ShieldOff aria-hidden /> {t("disable")}
            </Button>
          ) : (
            <Button onClick={() => setStep({ kind: "password", intent: "enable" })}>
              <ShieldCheck aria-hidden /> {t("enable")}
            </Button>
          )}
        </div>
      )}

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
            <FieldError>{codeForm.error("code") && t("codeFormat")}</FieldError>
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

      <NoticeLine notice={notice} />
    </div>
  );
}
