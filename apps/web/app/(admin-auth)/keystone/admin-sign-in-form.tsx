"use client";

import { useState, useTransition } from "react";
import { Lock, Mail } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { AuthInputIcon } from "../../_lib/auth-input-icon.tsx";
import { useSearchParam } from "../../_lib/use-search-param.ts";
import {
  isAdminPath,
  resolveRedirect,
  signInWithPassword,
  signOutSilently,
} from "../../_lib/credentials.ts";

type Failure = "credentials" | "notStaff";

export function AdminSignInForm({
  labels,
}: {
  labels: {
    email: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    failed: string;
    notStaff: string;
    resetDone: string;
  };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  // `?reset=1` — where the staff reset screen sends someone once every session
  // has been revoked and the lockout cleared (ADR-079 #6).
  const reset = useSearchParam("reset") === "1";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signInWithPassword(email, password);
      // `twoFactor` is refused with the generic message: a staff account has
      // no way to turn two-factor on (the learner profile page is the only
      // enrolment screen, ADR-123), so a challenge here is not a flow this
      // form supports.
      if (result.status !== "ok") {
        setFailure("credentials");
        return;
      }

      // A learner who somehow reached this screen is signed back out and
      // told so, rather than being bounced into the proxy gate's redirect
      // loop with no explanation. UX only — proxy.ts's gate and the
      // (admin) layout's loadSubject() re-check are what actually keep a
      // non-STAFF session out of the portal (ADR-052 §3, security.md #3).
      // `null` means the field was absent, not that the user is a learner:
      // send them on and let the server-side re-check decide.
      if (result.userType === "LEARNER") {
        await signOutSilently();
        setFailure("notStaff");
        return;
      }

      // Only ever into the portal — the gate put this path here, and a
      // `?redirect=` pointing anywhere else has no business on this form.
      window.location.assign(resolveRedirect("/keystone/dashboard", isAdminPath));
    });
  };

  const errorId = failure ? "admin-signin-error" : undefined;

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
          {failure === "notStaff" ? labels.notStaff : labels.failed}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
