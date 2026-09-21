"use client";

import { useState, useTransition } from "react";
import { Lock, Mail, User } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";
import { AuthInputIcon } from "../../../_lib/auth-input-icon.tsx";
import { signUpWithPassword } from "../../../_lib/credentials.ts";
import { rememberSession } from "../../../_lib/session-hint.ts";
import { optInToNewsletterAction } from "../_actions/newsletter-opt-in.ts";

type Failure = "taken" | "failed";

export function SignUpForm({
  labels,
  homeHref,
  verifiedHref,
  minPasswordLength,
  locale,
  newsletterEnabled,
}: {
  labels: {
    name: string;
    email: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    passwordHint: string;
    submit: string;
    failed: string;
    taken: string;
    newsletterOptIn: string;
    newsletterOptInHint: string;
  };
  /** The locale the newsletter emails are sent in (ADR-124). */
  locale: string;
  /**
   * The `newsletter` flag, read by the page. Off means the checkbox is ABSENT,
   * not disabled — there is nothing to opt in to.
   */
  newsletterEnabled: boolean;
  /** Localized "/" for this render's locale — where a new learner lands. */
  homeHref: string;
  /** Localized `/sign-in?verified=1` — where the verification link returns them. */
  verifiedHref: string;
  /** Mirrors @repo/auth's emailAndPassword.minPasswordLength. */
  minPasswordLength: number;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // ADR-124: unchecked by default, always. A pre-ticked box is not consent.
  const [newsletter, setNewsletter] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    startTransition(async () => {
      const result = await signUpWithPassword({ name, email, password, callbackURL: verifiedHref });
      if (result.status !== "ok") {
        setFailure(result.status === "taken" ? "taken" : "failed");
        return;
      }
      // Better Auth signs the new account in as part of sign-up, and
      // verification is deliberately NOT required to sign in (plan.md:
      // required to comment/access premium, not to read) — so the learner
      // lands on the site already signed in, with a verification mail on
      // its way and status PENDING_VERIFICATION until they use it.
      //
      // ADR-124: the opt-in runs now, against the session sign-up just set,
      // so the address it subscribes is the account's and nobody else's. A
      // failure here does not fail the sign-up — the account exists, and the
      // reader can still subscribe later.
      if (newsletterEnabled && newsletter) {
        await optInToNewsletterAction({ locale }).catch(() => "failed");
      }
      rememberSession(true);
      window.location.assign(homeHref);
    });
  };

  const errorId = failure ? "signup-error" : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-name">{labels.name}</Label>
        <AuthInputIcon icon={User}>
          <Input
            className="ps-10"
            id="signup-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            aria-invalid={failure !== null || undefined}
            aria-describedby={errorId}
            onChange={(e) => setName(e.target.value)}
          />
        </AuthInputIcon>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">{labels.email}</Label>
        <AuthInputIcon icon={Mail}>
          <Input
            className="ps-10"
            id="signup-email"
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
        <Label htmlFor="signup-password">{labels.password}</Label>
        <AuthInputIcon icon={Lock}>
          <PasswordInput
            className="ps-10"
            id="signup-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            autoComplete="new-password"
            required
            minLength={minPasswordLength}
            value={password}
            aria-invalid={failure !== null || undefined}
            aria-describedby={errorId ?? "signup-password-hint"}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthInputIcon>
        <p id="signup-password-hint" className="text-xs text-muted-foreground">
          {labels.passwordHint}
        </p>
      </div>
      {newsletterEnabled && (
        <div className="flex items-start gap-3">
          <Checkbox
            id="signup-newsletter"
            name="newsletter"
            checked={newsletter}
            onCheckedChange={(checked) => setNewsletter(checked === true)}
            // Base UI puts `id` on its hidden input, so the visible
            // role="checkbox" element is named by pointing at the label.
            aria-labelledby="signup-newsletter-label"
            aria-describedby="signup-newsletter-hint"
            className="mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <Label
              id="signup-newsletter-label"
              htmlFor="signup-newsletter"
              className="text-sm leading-snug font-normal"
            >
              {labels.newsletterOptIn}
            </Label>
            <p id="signup-newsletter-hint" className="text-xs text-muted-foreground">
              {labels.newsletterOptInHint}
            </p>
          </div>
        </div>
      )}
      {failure && (
        <p id="signup-error" role="alert" className="text-sm text-destructive-interactive">
          {failure === "taken" ? labels.taken : labels.failed}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
