"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";

export function SignInForm({
  labels,
}: {
  labels: { email: string; password: string; submit: string; failed: string };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(false);
    startTransition(async () => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      // The ?redirect= param is only needed HERE, at submit time — read it
      // from the live URL instead of useSearchParams(), which would block
      // prerendering of the static page shell (Cache Components requires a
      // Suspense boundary around that hook; this needs neither).
      // Open-redirect guard: only same-origin paths, never full URLs.
      const target = new URLSearchParams(window.location.search).get("redirect");
      const safeTarget =
        target && target.startsWith("/") && !target.startsWith("//") ? target : "/admin";
      window.location.assign(safeTarget);
    });
  };

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
          aria-invalid={error || undefined}
          aria-describedby={error ? "signin-error" : undefined}
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
          aria-invalid={error || undefined}
          aria-describedby={error ? "signin-error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p id="signin-error" role="alert" className="text-sm text-destructive">
          {labels.failed}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner aria-hidden data-icon="inline-start" />}
        {labels.submit}
      </Button>
    </form>
  );
}
