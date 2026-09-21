"use client";

// Email verification on the profile page (ADR-125 §2).
//
// Verification never blocks anything (ADR-079 #7), so this panel is where a
// learner sees the state of their address and can ask for the link again —
// the header menu's nudge, given room. It sends through `resendVerification`,
// Better Auth's own rate-limited endpoint (security.md #13), exactly as the
// menu does.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MailCheck, MailWarning, RotateCw, ShieldCheck } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { resendVerification } from "../../../../_lib/credentials.ts";

export function EmailVerificationPanel({
  email,
  emailVerified,
  justVerified,
  callbackURL,
}: {
  email: string;
  emailVerified: boolean;
  /** The reader arrived from the verification link (`?verified=1`). */
  justVerified: boolean;
  /** Localized `/account?verified=1`, resolved on the server. */
  callbackURL: string;
}) {
  const t = useTranslations("account.verification");
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [sending, startSend] = useTransition();

  const send = () =>
    startSend(async () => {
      const ok = await resendVerification(email, callbackURL);
      setState(ok ? "sent" : "failed");
    });

  return (
    <section
      aria-labelledby="account-verification"
      data-slot="email-verification"
      className="flex flex-col gap-4 rounded-lg border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="account-verification" className="text-base font-semibold">
            {t("title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant={emailVerified ? "success" : "warning"}>
          {emailVerified ? t("verified") : t("unverified")}
        </Badge>
      </div>

      <p className="text-sm">
        <span className="text-muted-foreground">{t("address")}</span>{" "}
        <span className="font-medium break-all">{email}</span>
      </p>

      {emailVerified ? (
        <p
          role={justVerified ? "status" : undefined}
          className="flex items-start gap-2 text-sm text-success-interactive"
        >
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {justVerified ? t("justVerified") : t("verifiedDetail")}
        </p>
      ) : state === "sent" ? (
        <div
          role="status"
          data-slot="verification-sent"
          className="flex flex-col gap-3 rounded-md bg-success/10 p-4 text-sm"
        >
          <p className="flex items-start gap-2 text-success-interactive">
            <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("sentTitle")}</span>
              <span className="text-muted-foreground">{t("sentDetail", { email })}</span>
            </span>
          </p>
          <div>
            <Button type="button" variant="ghost" size="sm" loading={sending} onClick={send}>
              <RotateCw aria-hidden /> {t("resendAgain")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-sm text-warning-interactive">
            <MailWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("unverifiedDetail")}
          </p>
          {state === "failed" && (
            <p role="alert" className="text-sm text-destructive-interactive">
              {t("failed")}
            </p>
          )}
          <div>
            <Button type="button" loading={sending} onClick={send} data-slot="resend-verification">
              <MailCheck aria-hidden /> {state === "failed" ? t("retry") : t("resend")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
