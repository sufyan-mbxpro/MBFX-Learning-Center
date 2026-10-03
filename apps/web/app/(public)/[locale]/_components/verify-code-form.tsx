"use client";

// Entering the six-digit verification code (changes-61, ADR-184).
//
// One form for both places a learner meets it: the step that follows a
// successful sign-up, and the email card on the account page. Verification
// still blocks nothing (ADR-079 #7), which is why the sign-up step offers
// "I'll do this later" — the code stays valid for its ten minutes and the
// account page can always send another.
//
// Both requests go to Better Auth's own `email-otp` handlers
// (`credentials.ts`), so the per-IP limits on those paths apply.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, MailCheck, RotateCw } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { AuthInputIcon } from "../../../_lib/auth-input-icon.tsx";
import { sendVerificationCode, verifyEmailCode } from "../../../_lib/credentials.ts";

const CODE_LENGTH = 6;

type Failure = "invalid" | "expired" | "failed" | "resendFailed";

export function VerifyCodeForm({
  email,
  onVerified,
  onSkip,
  showHeading = true,
}: {
  email: string;
  /**
   * Runs once the address is verified. It is awaited inside the form's
   * transition, so a caller that navigates (`navigateAway`) keeps the button
   * spinning until the next page arrives.
   */
  onVerified: () => Promise<void> | void;
  /** Present on the sign-up step only: verification can wait. */
  onSkip?: () => Promise<void> | void;
  /** The account card has its own heading. */
  showHeading?: boolean;
}) {
  const t = useTranslations("auth.verifyCode");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const [skipping, startSkip] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    setResent(false);
    startTransition(async () => {
      const result = await verifyEmailCode(email, code.replace(/\s+/g, ""));
      if (result.status === "ok") {
        await onVerified();
        return;
      }
      setFailure(result.status);
    });
  };

  const resend = () =>
    startResend(async () => {
      setFailure(null);
      const ok = await sendVerificationCode(email);
      setResent(ok);
      if (!ok) setFailure("resendFailed");
      setCode("");
    });

  const errorId = failure ? "verify-code-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-slot="verify-code">
      {showHeading && (
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MailCheck aria-hidden className="size-4 text-primary-interactive" />
            {t("title")}
          </p>
          <p className="text-sm text-muted-foreground">{t("description", { email })}</p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="verify-code">{t("label")}</Label>
        <AuthInputIcon icon={KeyRound}>
          <Input
            className="ps-10 font-mono text-lg tracking-widest"
            id="verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={CODE_LENGTH + 2}
            value={code}
            aria-invalid={failure === "invalid" || failure === "expired" || undefined}
            aria-describedby={errorId}
            onChange={(event) => setCode(event.target.value)}
          />
        </AuthInputIcon>
      </div>
      {failure && (
        <p id="verify-code-error" role="alert" className="text-sm text-destructive-interactive">
          {t(failure)}
        </p>
      )}
      {resent && !failure && (
        <p role="status" className="text-sm text-success-interactive">
          {t("resent")}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("submit")}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" loading={resending} onClick={resend}>
          <RotateCw aria-hidden /> {t("resend")}
        </Button>
        {onSkip && (
          <Button
            type="button"
            variant="link"
            size="sm"
            loading={skipping}
            onClick={() => startSkip(async () => void (await onSkip()))}
          >
            {t("skip")}
          </Button>
        )}
      </div>
    </form>
  );
}
