"use client";

import { useState, useTransition } from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { AuthInputIcon } from "../../../_lib/auth-input-icon.tsx";
import { useSearchParam } from "../../../_lib/use-search-param.ts";
import { rememberSession } from "../../../_lib/session-hint.ts";
import {
  isAdminPath,
  resolveRedirect,
  signInWithPassword,
  signOutSilently,
  verifyTwoFactorSignIn,
} from "../../../_lib/credentials.ts";

type Failure = "credentials" | "learnersOnly" | "invalidCode" | "codeExpired";

export function SignInForm({
  labels,
  homeHref,
}: {
  labels: {
    email: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    failed: string;
    learnersOnly: string;
    resetDone: string;
    verifiedDone: string;
    codeTitle: string;
    codeHint: string;
    codeLabel: string;
    codeSubmit: string;
    invalidCode: string;
    codeExpired: string;
    back: string;
  };
  /** Localized "/" for this render's locale — where a learner lands by default. */
  homeHref: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  // ADR-123: a correct password on a two-factor account is not yet a session.
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  // `?reset=1` after a completed password reset, `?verified=1` after Better
  // Auth's verification callback. Read from the live URL, not through
  // `useSearchParams()`, which would force a Suspense boundary and opt this
  // static page out of prerendering (architecture.md #6) for one line of chrome.
  // Both read unconditionally — a hook inside a ternary is only called on
  // some renders, which is the Rules of Hooks violation, not a style point.
  const justReset = useSearchParam("reset") === "1";
  const justVerified = useSearchParam("verified") === "1";
  const notice = justReset ? ("reset" as const) : justVerified ? ("verified" as const) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signInWithPassword(email, password);
      if (result.status === "failed") {
        setFailure("credentials");
        return;
      }
      if (result.status === "twoFactor") {
        setStep("code");
        return;
      }
      await finish(result.userType);
    });
  };

  // The rest of a sign-in once a session exists — shared by both steps.
  const finish = async (userType: "LEARNER" | "STAFF" | null) => {
    // This is the LEARNER form (ADR-052). A staff credential is signed
    // straight back out so the public site never doubles as the portal's
    // way in — display logic, not a boundary, and worded without naming
    // the admin surface it deliberately doesn't advertise.
    if (userType === "STAFF") {
      await signOutSilently();
      setFailure("learnersOnly");
      return;
    }

    // ADR-124 §3: the page we land on hides its subscribe bands at first
    // paint rather than after its own session read.
    rememberSession(true);
    // Never into /keystone, whatever `?redirect=` says.
    window.location.assign(resolveRedirect(homeHref, (path) => !isAdminPath(path)));
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

  const errorId = failure ? "signin-error" : undefined;
  const failureText =
    failure === "learnersOnly"
      ? labels.learnersOnly
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
          <Label htmlFor="signin-code">{labels.codeLabel}</Label>
          <AuthInputIcon icon={KeyRound}>
            <Input
              className="ps-10"
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={7}
              value={code}
              aria-invalid={failure !== null || undefined}
              aria-describedby={errorId}
              onChange={(e) => setCode(e.target.value)}
            />
          </AuthInputIcon>
        </div>
        {failure && (
          <p id="signin-error" role="alert" className="text-sm text-destructive-interactive">
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
      {notice && (
        // `status`, not `alert`: both of these are good news, and an assertive
        // region would interrupt a screen reader to deliver it.
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success-interactive"
        >
          {notice === "reset" ? labels.resetDone : labels.verifiedDone}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-email">{labels.email}</Label>
        <AuthInputIcon icon={Mail}>
          <Input
            className="ps-10"
            id="signin-email"
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
        <Label htmlFor="signin-password">{labels.password}</Label>
        <AuthInputIcon icon={Lock}>
          <PasswordInput
            className="ps-10"
            id="signin-password"
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
        <p id="signin-error" role="alert" className="text-sm text-destructive-interactive">
          {failureText}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
