"use client";

import { useState, useTransition } from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { AuthInputIcon } from "../../_lib/auth-input-icon.tsx";
import { useSearchParam } from "../../_lib/use-search-param.ts";
import { useRecaptcha } from "../../_lib/recaptcha.ts";
import {
  isAdminPath,
  resolveRedirect,
  signInWithPassword,
  signOutSilently,
  TWO_FACTOR_CODE_MAX_LENGTH,
  verifyTwoFactorSignIn,
} from "../../_lib/credentials.ts";

type Failure = "credentials" | "notStaff" | "captcha" | "invalidCode" | "codeExpired";

export function AdminSignInForm({
  labels,
  captchaSiteKey,
}: {
  labels: {
    email: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    failed: string;
    notStaff: string;
    captcha: string;
    resetDone: string;
    codeTitle: string;
    codeHint: string;
    codeLabel: string;
    codeSubmit: string;
    invalidCode: string;
    codeExpired: string;
    back: string;
  };
  /** Settings → General → reCAPTCHA's site key, or `null` while it is off (ADR-156). */
  captchaSiteKey: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  // ADR-157: a correct password on a two-factor account is not yet a session.
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  // ADR-156: load reCAPTCHA v3 now, so its token is ready at submit.
  useRecaptcha(captchaSiteKey);

  // `?reset=1` — where the staff reset screen sends someone once every session
  // has been revoked and the lockout cleared (ADR-079 #6).
  const reset = useSearchParam("reset") === "1";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signInWithPassword(email, password);
      if (result.status === "captcha") {
        setFailure("captcha");
        return;
      }
      // ADR-157: staff enrol on their profile now, so a challenge is a step.
      if (result.status === "twoFactor") {
        setStep("code");
        return;
      }
      if (result.status !== "ok") {
        setFailure("credentials");
        return;
      }
      await finish(result.userType);
    });
  };

  // The rest of a sign-in once a session exists — shared by both steps.
  const finish = async (userType: "LEARNER" | "STAFF" | null) => {
    // A learner who somehow reached this screen is signed back out and
    // told so, rather than being bounced into the proxy gate's redirect
    // loop with no explanation. UX only — proxy.ts's gate and the
    // (admin) layout's loadSubject() re-check are what actually keep a
    // non-STAFF session out of the portal (ADR-052 §3, security.md #3).
    // `null` means the field was absent, not that the user is a learner:
    // send them on and let the server-side re-check decide.
    if (userType === "LEARNER") {
      await signOutSilently();
      setStep("credentials");
      setFailure("notStaff");
      return;
    }

    // Only ever into the portal — the gate put this path here, and a
    // `?redirect=` pointing anywhere else has no business on this form.
    window.location.assign(resolveRedirect("/keystone/dashboard", isAdminPath));
  };

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await verifyTwoFactorSignIn(code.replace(/\s+/g, ""));
      if (result.status === "ok") {
        await finish(result.userType);
        return;
      }
      if (result.status === "expired") {
        // The challenge is gone: back to the password, and say why.
        setStep("credentials");
        setCode("");
        setFailure("codeExpired");
        return;
      }
      setFailure(result.status === "invalidCode" ? "invalidCode" : "credentials");
    });
  };

  const errorId = failure ? "admin-signin-error" : undefined;
  const failureText =
    failure === "notStaff"
      ? labels.notStaff
      : failure === "captcha"
        ? labels.captcha
        : failure === "invalidCode"
          ? labels.invalidCode
          : failure === "codeExpired"
            ? labels.codeExpired
            : labels.failed;

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{labels.codeTitle}</p>
          <p className="text-sm text-muted-foreground">{labels.codeHint}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-signin-code">{labels.codeLabel}</Label>
          <AuthInputIcon icon={KeyRound}>
            <Input
              className="ps-10"
              id="admin-signin-code"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={TWO_FACTOR_CODE_MAX_LENGTH}
              value={code}
              aria-invalid={failure !== null || undefined}
              aria-describedby={errorId}
              onChange={(e) => setCode(e.target.value)}
            />
          </AuthInputIcon>
        </div>
        {failure && (
          <p id="admin-signin-error" role="alert" className="text-sm text-destructive-interactive">
            {failureText}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {labels.codeSubmit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setStep("credentials");
            setCode("");
            setFailure(null);
          }}
        >
          {labels.back}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {reset && (
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success-interactive"
        >
          {labels.resetDone}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-signin-email">{labels.email}</Label>
        <AuthInputIcon icon={Mail}>
          <Input
            className="ps-10"
            id="admin-signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={failure !== null || undefined}
            aria-describedby={errorId}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthInputIcon>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-signin-password">{labels.password}</Label>
        <AuthInputIcon icon={Lock}>
          <PasswordInput
            className="ps-10"
            id="admin-signin-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={failure !== null || undefined}
            aria-describedby={errorId}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthInputIcon>
      </div>
      {failure && (
        <p id="admin-signin-error" role="alert" className="text-sm text-destructive-interactive">
          {failureText}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
