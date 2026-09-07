"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { signUpWithPassword } from "../../../_lib/credentials.ts";

type Failure = "taken" | "failed";

export function SignUpForm({
  labels,
  homeHref,
  minPasswordLength,
}: {
  labels: {
    name: string;
    email: string;
    password: string;
    passwordHint: string;
    submit: string;
    failed: string;
    taken: string;
  };
  /** Localized "/" for this render's locale — where a new learner lands. */
  homeHref: string;
  /** Mirrors @repo/auth's emailAndPassword.minPasswordLength. */
  minPasswordLength: number;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signUpWithPassword({ name, email, password });
      if (result.status !== "ok") {
        setFailure(result.status === "taken" ? "taken" : "failed");
        return;
      }
      // Better Auth signs the new account in as part of sign-up, and
      // verification is deliberately NOT required to sign in (plan.md:
      // required to comment/access premium, not to read) — so the learner
      // lands on the site already signed in, with a verification mail on
      // its way and status PENDING_VERIFICATION until they use it.
      window.location.assign(homeHref);
    });
  };

  const errorId = failure ? "signup-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-name">{labels.name}</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">{labels.email}</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-password">{labels.password}</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          value={password}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId ?? "signup-password-hint"}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="signup-password-hint" className="text-xs text-muted-foreground">
          {labels.passwordHint}
        </p>
      </div>
      {failure && (
        <p id="signup-error" role="alert" className="text-sm text-destructive">
          {failure === "taken" ? labels.taken : labels.failed}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner aria-hidden data-icon="inline-start" />}
        {labels.submit}
      </Button>
    </form>
  );
}
