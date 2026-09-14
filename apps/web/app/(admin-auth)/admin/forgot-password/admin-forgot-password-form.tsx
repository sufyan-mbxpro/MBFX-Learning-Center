"use client";

// The staff half of "email me a reset link" (ADR-079 #4).
//
// Identical in behaviour to the public form, and deliberately so: one outcome
// on screen whatever the server knows, because an enumeration oracle on the
// STAFF surface is worse, not better — it would confirm which addresses are
// staff accounts.
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { requestPasswordReset } from "../../../_lib/credentials.ts";

export function AdminForgotPasswordForm({
  labels,
}: {
  labels: { email: string; submit: string; sent: string; sentAgain: string };
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-muted-foreground">
          {labels.sent}
        </p>
        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          {labels.sentAgain}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-forgot-email">{labels.email}</Label>
        <Input
          id="admin-forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
