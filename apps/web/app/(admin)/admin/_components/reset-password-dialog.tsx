"use client";

// Admin password reset modal (changes-01: users + employee detail).
// Guarded server-side by users.password.reset; the generated password is
// shown once so the admin can hand it over — sessions are revoked by the
// action, forcing a fresh sign-in.
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { resetUserPasswordAction } from "../_actions/user-actions.ts";

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function ResetPasswordDialog({
  userId,
  userLabel,
  open,
  onOpenChange,
  labels,
}: {
  userId: string;
  /** Shown in the description — the email/name being reset. */
  userLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: {
    title: string;
    description: string;
    newPassword: string;
    generate: string;
    confirm: string;
    cancel: string;
    done: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = React.useState("");

  const submit = () =>
    startTransition(async () => {
      try {
        await resetUserPasswordAction({ userId, newPassword: password });
        toast.success(labels.done);
        onOpenChange(false);
        setPassword("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPassword("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>
            {labels.description} <span className="font-medium">{userLabel}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password-value">{labels.newPassword}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="reset-password-value"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={labels.generate}
              onClick={() => setPassword(generatePassword())}
            >
              <RefreshCw aria-hidden />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button onClick={submit} disabled={pending || password.length < 8}>
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
