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

type Failure = "credentials" | "notStaff";

export function AdminSignInForm({
  labels,
}: {
  labels: { email: string; password: string; submit: string; failed: string; notStaff: string };
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
      window.location.assign(resolveRedirect("/admin", isAdminPath));
    });
  };

  const errorId = failure ? "admin-signin-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-signin-email">{labels.email}</Label>
        <Input
          id="admin-signin-email"
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
        <Label htmlFor="admin-signin-password">{labels.password}</Label>
        <Input
          id="admin-signin-password"
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
        <p id="admin-signin-error" role="alert" className="text-sm text-destructive">
          {failure === "notStaff" ? labels.notStaff : labels.failed}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner aria-hidden data-icon="inline-start" />}
        {labels.submit}
      </Button>
    </form>
  );
}
