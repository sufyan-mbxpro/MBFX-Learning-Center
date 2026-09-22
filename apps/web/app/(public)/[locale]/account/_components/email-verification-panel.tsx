"use client";

// The email card on the profile page: verification (ADR-125 §2) and, since
// ADR-155, changing the address.
//
// Verification never blocks anything (ADR-079 #7), so this card is where a
// learner sees the state of their address and can ask for the link again —
// the header menu's nudge, given room. It sends through `resendVerification`,
// Better Auth's own rate-limited endpoint (security.md #13), exactly as the
// menu does.
//
// A change goes to Better Auth's `/change-email` from the browser
// (`account-security.ts`). Nothing moves until the link mailed to the NEW
// address is opened, so the success state says "check that inbox", never
// "saved".
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AtSign, Mail, MailCheck, MailWarning, Pencil, RotateCw, ShieldCheck } from "lucide-react";
import { changeEmailFormSchema } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { resendVerification } from "../../../../_lib/credentials.ts";
import { changeEmail } from "../../../../_lib/account-security.ts";
import { AccountCard } from "./account-card.tsx";
import { NoticeLine } from "./profile-panel.tsx";
import { useAccountForm } from "./use-account-form.ts";

export function EmailVerificationPanel({
  email,
  emailVerified,
  justVerified,
  justChanged,
  callbackURL,
  changeCallbackURL,
}: {
  email: string;
  emailVerified: boolean;
  /** The reader arrived from the verification link (`?verified=1`). */
  justVerified: boolean;
  /** The reader arrived from an address-change link (`?emailChanged=1`). */
  justChanged: boolean;
  /** Localized `/account?verified=1`, resolved on the server. */
  callbackURL: string;
  /** Localized `/account?emailChanged=1`, where a change link lands. */
  changeCallbackURL: string;
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
    <AccountCard
      id="account-email"
      data-slot="email-verification"
      icon={Mail}
      tone="info"
      title={t("title")}
      description={t("description")}
      status={
        <Badge variant={emailVerified ? "success" : "warning"}>
          {emailVerified ? <ShieldCheck aria-hidden /> : <MailWarning aria-hidden />}
          {emailVerified ? t("verified") : t("unverified")}
        </Badge>
      }
    >
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
        <AtSign aria-hidden className="size-5 shrink-0 text-info-interactive" />
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">{t("address")}</span>
          <span className="font-medium break-all">{email}</span>
        </div>
      </div>

      {justChanged ? (
        <p role="status" className="flex items-start gap-2 text-sm text-success-interactive">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("justChanged", { email })}
        </p>
      ) : emailVerified ? (
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

      <hr className="border-border" />
      <ChangeEmailForm currentEmail={email} callbackURL={changeCallbackURL} />
    </AccountCard>
  );
}

type Notice = { tone: "success" | "error"; text: string } | null;

function ChangeEmailForm({
  currentEmail,
  callbackURL,
}: {
  currentEmail: string;
  callbackURL: string;
}) {
  const t = useTranslations("account.changeEmail");
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const form = useAccountForm(changeEmailFormSchema, { newEmail });

  const close = () => {
    setOpen(false);
    setNewEmail("");
    setNotice(null);
    form.reset();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!form.validate()) return;
    const target = changeEmailFormSchema.parse({ newEmail }).newEmail;
    if (target === currentEmail.toLowerCase()) {
      setNotice({ tone: "error", text: t("same") });
      return;
    }
    startTransition(async () => {
      const result = await changeEmail(target, callbackURL);
      if (result.status === "ok") {
        close();
        setSentTo(target);
        return;
      }
      setNotice({
        tone: "error",
        text:
          result.status === "tooMany"
            ? t("tooMany")
            : result.status === "signInAgain"
              ? t("signInAgain")
              : t("failed"),
      });
    });
  };

  if (sentTo && !open) {
    return (
      <div
        role="status"
        data-slot="change-email-sent"
        className="flex flex-col gap-3 rounded-md bg-info/10 p-4 text-sm"
      >
        <p className="flex items-start gap-2 text-info-interactive">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("sentTitle")}</span>
            <span className="text-muted-foreground">{t("sentDetail", { email: sentTo })}</span>
          </span>
        </p>
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <Pencil aria-hidden /> {t("useAnother")}
          </Button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Pencil aria-hidden /> {t("open")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-slot="change-email">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <Field invalid={form.invalid("newEmail")} required>
        <FieldLabel>{t("newEmail")}</FieldLabel>
        <Input
          type="email"
          autoComplete="email"
          autoFocus
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <FieldDescription>{t("hint")}</FieldDescription>
        <FieldError>{form.error("newEmail")}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <NoticeLine notice={notice} />
        <Button type="button" variant="ghost" onClick={close}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          <MailCheck aria-hidden /> {t("submit")}
        </Button>
      </div>
    </form>
  );
}
