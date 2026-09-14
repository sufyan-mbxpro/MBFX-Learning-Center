"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { useSearchParam } from "../../../_lib/use-search-param.ts";
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
  };
  /** Localized "/" for this render's locale — where a learner lands by default. */
  homeHref: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
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
        <PasswordInput
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
      </div>
      {failure && (
        <p id="signin-error" role="alert" className="text-sm text-destructive-interactive">
          {failure === "learnersOnly" ? labels.learnersOnly : labels.failed}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
