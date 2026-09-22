"use client";

// The staff half of setting a new password (ADR-079 #1, #6).
//
// Same three outcomes as the public form, and the same reason it is not
// anti-enumerating: the visitor already holds a token, so naming an expired
// link costs nothing and withholding it strands them.
//
// On success every session is already revoked (`revokeSessionsOnPasswordReset`)
// and the lockout is cleared (`onPasswordReset`) — which is what makes this the
// route out of a locked-out staff account, not just a forgotten one. The only
// honest next screen is sign-in.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { resetPassword } from "../../../_lib/credentials.ts";

type Failure = "mismatch" | "tooShort" | "invalidToken" | "missingToken" | "failed";

export function AdminResetPasswordForm({
  minPasswordLength,
  labels,
}: {
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

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setFailure("missingToken");
      return;
    }

    startTransition(async () => {
      const result = await resetPassword(token, password);
      if (result.status === "ok") {
        // A FULL load, not router.push: the reset just revoked every session,
        // so the client router's cached RSC payloads and any client state
        // belong to a session that no longer exists. The rule's suggestion
        // would keep exactly what has to be thrown away.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
        window.location.assign("/keystone?reset=1");
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

  if (failure === "invalidToken" || failure === "missingToken") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive-interactive">
          {failure === "missingToken" ? labels.missingToken : labels.invalidToken}
        </p>
        <Button
          variant="outline"
          className="w-full"
          render={<Link href="/keystone/forgot-password" />}
        >
          {labels.requestAnother}
        </Button>
      </div>
    );
  }

  const errorId = failure ? "admin-reset-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-reset-password">{labels.password}</Label>
        <PasswordInput
          id="admin-reset-password"
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          value={password}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId ?? "admin-reset-hint"}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p id="admin-reset-hint" className="text-xs text-muted-foreground">
          {labels.passwordHint}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-reset-confirm">{labels.confirm}</Label>
        <PasswordInput
          id="admin-reset-confirm"
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
        <p id="admin-reset-error" role="alert" className="text-sm text-destructive-interactive">
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
