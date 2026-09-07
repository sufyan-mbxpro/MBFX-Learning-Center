"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import {
  isAdminPath,
  resolveRedirect,
  signInWithPassword,
  signOutSilently,
} from "../../../_lib/credentials.ts";

type Failure = "credentials" | "learnersOnly";

export function SignInForm({
  labels,
  homeHref,
}: {
  labels: { email: string; password: string; submit: string; failed: string; learnersOnly: string };
  /** Localized "/" for this render's locale — where a learner lands by default. */
  homeHref: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signInWithPassword(email, password);
      if (result.status === "failed") {
        setFailure("credentials");
        return;
      }

      // This is the LEARNER form (ADR-052). A staff credential is signed
      // straight back out so the public site never doubles as the portal's
      // way in — display logic, not a boundary, and worded without naming
      // the admin surface it deliberately doesn't advertise.
      if (result.userType === "STAFF") {
        await signOutSilently();
        setFailure("learnersOnly");
        return;
      }

      // Never into /admin, whatever `?redirect=` says.
      window.location.assign(resolveRedirect(homeHref, (path) => !isAdminPath(path)));
    });
  };

  const errorId = failure ? "signin-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-email">{labels.email}</Label>
        <Input
          id="signin-email"
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
        <Label htmlFor="signin-password">{labels.password}</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          aria-invalid={failure !== null || undefined}
          aria-describedby={errorId}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {failure && (
        <p id="signin-error" role="alert" className="text-sm text-destructive">
          {failure === "learnersOnly" ? labels.learnersOnly : labels.failed}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner aria-hidden data-icon="inline-start" />}
        {labels.submit}
      </Button>
    </form>
  );
}
