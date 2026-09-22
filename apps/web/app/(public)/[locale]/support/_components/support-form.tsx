"use client";

// The "Still Need Help?" form (Module 12, ADR-113, ADR-131).
//
// **It submits without JavaScript.** `useActionState` on a real
// `<form action={…}>` posts to the server action whether or not the bundle
// has hydrated, so the pre-hydration state is a working form and not a dead
// one. That is also why the honeypot and the locale are hidden INPUTS rather
// than closure values handed to a click handler — `newsletter-form.tsx` is
// the precedent and the reasoning is identical.
//
// **`required` does the inline validation, not `useFieldErrors`.**
// code-style.md #24 requires a `Field` with a `FieldLabel` per control and a
// message from the action's own `@repo/contracts` schema — but #24 is written
// for the ADMIN, where a Save is disabled by nothing and the schema is
// mirrored client-side. Here the four fields are `required` with a typed
// address, so the browser refuses an empty or malformed submit natively and
// the pre-hydration path keeps the same behaviour; the action's `invalid`
// state is what a TAMPERED submission gets, and it renders in the one alert
// rather than beside a field, because a tampered form has no field to point
// at. Everything else #24 asks for is here: the `Field` wrapper, the
// `FieldLabel`, the asterisk from `required`, and a Save that is never
// disabled for validation.
//
// **Success is a message UNDER the Send button** (changes-43, superseding
// ADR-131's panel). The owner asked for the form to stay where it is with the
// confirmation beneath it, and for its colours to be the site's: so it is the
// brand's own tint and ink, not the blue `success` tone that read as another
// site's alert. It is a bordered box with a check glyph and a bold first line,
// not the grey hint ADR-131 replaced, so it is not missed after a submit.
// React has already reset the form, so the next message can be typed at once.
//
// **A signed-in learner's name and address are filled in** from the one
// public session read (ADR-094). Display only: the action still parses what is
// posted, and both fields stay editable for a reply-to that is not the
// account's.
//
// **The four states are the action's four**, and there is deliberately no
// fifth. In particular there is no "we already have a message from you" —
// that would make the form a disclosure oracle for anybody's address, the
// same trap ADR-080 #1 named for signup.
import { startTransition, useActionState, useEffect, useId, useRef } from "react";
import { CircleAlert, CircleCheckBig, Send, UserCheck } from "lucide-react";
import {
  CAPTCHA_ACTIONS,
  CAPTCHA_FIELD,
  SUPPORT_HONEYPOT_FIELD,
  SUPPORT_MESSAGE_MAX,
} from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { sendSupportRequestAction, type SupportRequestState } from "../../_actions/support.ts";
import { getCaptchaToken, useRecaptcha } from "../../../../_lib/recaptcha.ts";
import { usePublicSession } from "../../_components/public-session.tsx";

export interface SupportFormLabels {
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  pending: string;
  sentTitle: string;
  sent: string;
  errorTitle: string;
  signedInHint: string;
  invalid: string;
  limited: string;
  captcha: string;
  failed: string;
}

export function SupportForm({
  labels,
  locale,
  captchaSiteKey,
}: {
  labels: SupportFormLabels;
  locale: string;
  /** Settings → General → reCAPTCHA's site key, or `null` while it is off (ADR-156). */
  captchaSiteKey: string | null;
}) {
  const [state, formAction, pending] = useActionState<SupportRequestState, FormData>(
    sendSupportRequestAction,
    { status: "idle" },
  );
  const messageId = useId();
  const session = usePublicSession();
  const learner = session.status === "learner" ? session : null;

  // Focus moves to the confirmation, so a keyboard or screen-reader user
  // hears it; it is also a live region for anyone whose focus stays put.
  const sent = state.status === "sent";
  const sentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent, state]);

  const error =
    state.status === "invalid"
      ? labels.invalid
      : state.status === "limited"
        ? labels.limited
        : state.status === "captcha"
          ? labels.captcha
          : state.status === "failed"
            ? labels.failed
            : null;

  // A refusal hands back what was typed, because React resets the form once
  // the action settles. Failing that, a signed-in learner's own details.
  const echoed = "values" in state ? state.values : undefined;

  // ADR-156: with reCAPTCHA on, a token is minted at submit and added to the
  // form data before the server action sees it. Tokens are single-use and
  // expire in two minutes, so it cannot be fetched earlier. With it off the
  // form keeps posting the action directly, which is what lets it submit
  // before hydration. With it on, a submit needs JavaScript, because a
  // token does. No token (a blocker) still posts, and the action answers
  // `captcha`, so there is one refusal path and not two.
  useRecaptcha(captchaSiteKey);
  const submitWithCaptcha = async (formData: FormData) => {
    const captcha = await getCaptchaToken(CAPTCHA_ACTIONS.support);
    if (captcha.ok && captcha.token) formData.set(CAPTCHA_FIELD, captcha.token);
    startTransition(() => formAction(formData));
  };

  return (
    <form
      action={captchaSiteKey ? submitWithCaptcha : formAction}
      className="flex flex-col gap-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8"
    >
      <input type="hidden" name="locale" value={locale} />

      {/*
        The honeypot. `sr-only` takes it out of sight while leaving it in the
        DOM and in the submitted FormData — `display: none` is the one thing
        some bots check before deciding a field is not worth filling — and
        `aria-hidden` plus `tabIndex={-1}` takes it out of the accessibility
        tree and the tab order, so a screen-reader user never meets it. It is
        never `required`, so no browser can block a human on a field they
        cannot see.
      */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${messageId}-hp`}>Company</label>
        <input
          id={`${messageId}-hp`}
          type="text"
          name={SUPPORT_HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {learner && (
        <p className="flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-info-interactive">
          <UserCheck aria-hidden className="size-4 shrink-0" />
          {labels.signedInHint}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field required>
          <FieldLabel>{labels.nameLabel}</FieldLabel>
          <Input
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            defaultValue={echoed?.name ?? learner?.name ?? ""}
            placeholder={labels.namePlaceholder}
          />
        </Field>

        <Field required>
          <FieldLabel>{labels.emailLabel}</FieldLabel>
          <Input
            name="email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            defaultValue={echoed?.email ?? learner?.email ?? ""}
            placeholder={labels.emailPlaceholder}
          />
        </Field>
      </div>

      <Field required>
        <FieldLabel>{labels.subjectLabel}</FieldLabel>
        <Input
          name="subject"
          type="text"
          required
          maxLength={200}
          defaultValue={echoed?.subject ?? ""}
          placeholder={labels.subjectPlaceholder}
        />
      </Field>

      <Field required>
        <FieldLabel>{labels.messageLabel}</FieldLabel>
        <Textarea
          name="message"
          required
          rows={6}
          // The schema's own bound, imported rather than repeated: a form that
          // lets someone type 6000 characters and an action that refuses them
          // is a lost message with no explanation.
          maxLength={SUPPORT_MESSAGE_MAX}
          defaultValue={echoed?.message ?? ""}
          placeholder={labels.messagePlaceholder}
          className="resize-y"
        />
      </Field>

      {error && (
        // `Alert`'s destructive variant already uses the interactive ink
        // (ADR-077): raw red fails 4.5:1 on the dark ground.
        <Alert id={messageId} variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{labels.errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/*
        Never disabled for validation (code-style #24). `loading` disables it
        only while a submit is in flight, which is a different claim: the
        press has been accepted. `support-page.test.ts` fails on a `disabled`
        attribute here, the guard that stopped the newsletter placeholder
        coming back and now stops this one shipping inert.
      */}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {!pending && <Send aria-hidden data-icon="inline-start" />}
        {pending ? labels.pending : labels.submit}
      </Button>

      {sent && (
        <div
          ref={sentRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg bg-primary/10 px-4 py-3 ring-1 ring-primary/30 outline-none"
        >
          <CircleCheckBig aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-interactive" />
          <p className="flex flex-col gap-0.5 text-sm text-foreground">
            <span className="font-semibold">{labels.sentTitle}</span>
            <span className="text-muted-foreground">{labels.sent}</span>
          </p>
        </div>
      )}
    </form>
  );
}
