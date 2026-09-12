"use client";

// "Email me a reset link" (ADR-079 #4).
//
// **There is exactly one outcome on screen.** Whether the address exists, is
// unknown, or has already asked three times this hour, this form says the same
// thing — because anything else is an account-enumeration oracle, and the whole
// point of Better Auth's identical response and `after()` send is that neither
// the body nor the timing gives the answer away. `requestPasswordReset` cannot
// even report a network failure for the same reason: a visible error on a real
// address and silence on an unknown one would be the leak in a different coat.
//
// The consequence to accept: a genuinely broken mail configuration looks like
// success here. It is visible in the delivery log instead (ADR-078 #10).
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { requestPasswordReset } from "../../../_lib/credentials.ts";

export function ForgotPasswordForm({
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
        {/* `role="status"`, not `alert`: this is a confirmation, and an
            assertive live region would interrupt a screen reader mid-sentence
            for good news. */}
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
        <Label htmlFor="forgot-email">{labels.email}</Label>
        <Input
          id="forgot-email"
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
