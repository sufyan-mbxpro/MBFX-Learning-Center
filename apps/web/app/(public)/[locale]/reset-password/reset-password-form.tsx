"use client";

// Setting the new password (ADR-079 #1, #6).
//
// Unlike the request screen, this one is NOT anti-enumerating: the visitor
// holds a token, so telling them it has expired leaks nothing and withholding
// it strands them. The three outcomes get three different screens — an expired
// link needs a way to ask for another, a short password needs the field
// corrected, and anything else is the generic failure.
//
// The token is read from the live URL rather than `useSearchParams()`, which
// would force a Suspense boundary and opt this route out of prerendering for a
// value only `submit` needs (architecture.md #6). `resolveRedirect` in
// `_lib/credentials.ts` reads `?redirect=` the same way and for the same reason.
//
// On success Better Auth has already revoked every session
// (`revokeSessionsOnPasswordReset`), so the only honest next screen is sign-in.
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { resetPassword } from "../../../_lib/credentials.ts";

type Failure = "mismatch" | "tooShort" | "invalidToken" | "missingToken" | "failed";

export function ResetPasswordForm({
  signInHref,
  forgotHref,
  minPasswordLength,
  labels,
}: {
  /** Localized `/sign-in?reset=1` — where a completed reset lands. */
  signInHref: string;
  forgotHref: string;
  minPasswordLength: number;
  labels: {
    password: string;
    confirm: string;
    showPassword: string;
    hidePassword: string;
    passwordHint: string;
    submit: string;
    mismatch: string;
    tooShort: string;
    invalidToken: string;
    missingToken: string;
    requestAnother: string;
    failed: string;
  };
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);

    if (password !== confirm) {
      setFailure("mismatch");
      return;
    }

    // Read at submit time, not at render: this runs in the browser, where the
    // URL is available without making the page dynamic.
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setFailure("missingToken");
      return;
    }

    startTransition(async () => {
      const result = await resetPassword(token, password);
      if (result.status === "ok") {
        window.location.assign(signInHref);
        return;
      }
      setFailure(
        result.status === "invalidToken"
          ? "invalidToken"
          : result.status === "tooShort"
            ? "tooShort"
            : "failed",
      );
    });
  };

  // A dead link is a dead end unless the screen offers the way out, so these
  // two replace the form rather than annotating it.
  if (failure === "invalidToken" || failure === "missingToken") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive-interactive">
          {failure === "missingToken" ? labels.missingToken : labels.invalidToken}
        </p>
        <Button variant="outline" className="w-full" render={<a href={forgotHref} />}>
          {labels.requestAnother}
        </Button>
      </div>
    );
  }

  const errorId = failure ? "reset-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-password">{labels.password}</Label>
        <PasswordInput
          id="reset-password"
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          value={password}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId ?? "reset-password-hint"}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p id="reset-password-hint" className="text-xs text-muted-foreground">
          {labels.passwordHint}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-confirm">{labels.confirm}</Label>
        <PasswordInput
          id="reset-confirm"
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="new-password"
          required
          value={confirm}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {failure && (
        <p id="reset-error" role="alert" className="text-sm text-destructive-interactive">
          {failure === "mismatch"
            ? labels.mismatch
            : failure === "tooShort"
              ? labels.tooShort
              : labels.failed}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
