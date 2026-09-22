"use client";

// Footer / homepage / news / analysis newsletter signup (ADR-080).
//
// This shipped hard-`disabled` from changes-03 until changes-21 F7, with
// "Newsletter signup is coming soon" underneath, because there was nowhere to
// put an address. The comment it carried named the conditions — a
// `NewsletterSubscriber` model and an ADR — and both now exist, so the
// placeholder is gone rather than retired: `loading-states.test.ts` fails on a
// `disabled` control here, which is what stops it coming back unnoticed.
//
// **It submits without JavaScript.** `useActionState` on a real `<form
// action={...}>` posts to the server action whether or not the bundle has
// hydrated, so the pre-hydration state is a working form and not a dead one.
// That is also why the honeypot, the locale and the source are hidden INPUTS
// rather than closure values passed to a click handler.
//
// **The four states a visitor can see** are the four the action returns
// (ADR-080 #1): sent, invalid, limited, failed. There is deliberately no
// "you are already subscribed" — that would turn the form into a membership
// oracle for anybody's address.
import { useActionState, useId } from "react";
import { NEWSLETTER_HONEYPOT_FIELD, type NewsletterSource } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { subscribeAction, type NewsletterState } from "../_actions/newsletter.ts";

export interface NewsletterFormLabels {
  placeholder: string;
  label: string;
  submitLabel: string;
  pendingLabel: string;
  consent: string;
  sent: string;
  invalid: string;
  limited: string;
  failed: string;
}

export function NewsletterForm({
  labels,
  locale,
  source,
  tone = "default",
}: {
  labels: NewsletterFormLabels;
  locale: string;
  /** Which placement this is — stored on the row so admin can filter by it. */
  source: NewsletterSource;
  /**
   * "onFill" is for the CTA band, where the surface is `bg-primary` —
   * `text-muted-foreground` is tuned for the page background and would be
   * close to illegible on a filled band. "onSecondary" is the footer's own
   * `bg-secondary` band: a DIFFERENT fill, so it needs the button to stay
   * `default` (primary pops against secondary — the "onFill" swap to a
   * `secondary` button would blend into a `bg-secondary` surface) and its
   * own foreground token for the message text.
   */
  tone?: "default" | "onFill" | "onSecondary";
}) {
  const [state, formAction, pending] = useActionState<NewsletterState, FormData>(subscribeAction, {
    status: "idle",
  });
  const messageId = useId();

  const message =
    state.status === "sent"
      ? labels.sent
      : state.status === "invalid"
        ? labels.invalid
        : state.status === "limited"
          ? labels.limited
          : state.status === "failed"
            ? labels.failed
            : labels.consent;

  // A refusal is an error to a screen reader; the consent line and the success
  // message are not. `aria-live` is on the element rather than a wrapper so a
  // state change is announced without re-reading the label.
  const isError =
    state.status === "invalid" || state.status === "limited" || state.status === "failed";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />

      {/*
        The honeypot. `sr-only` takes it out of sight while leaving it in the
        DOM and in the submitted FormData — `display: none` is the one thing
        some bots check for before deciding a field is not worth filling —
        and `aria-hidden` plus `tabIndex={-1}` takes it out of the
        accessibility tree and the tab order, so a screen-reader user never
        meets it either. It is never `required`, so no browser can block a
        human on a field they cannot see.
      */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${messageId}-hp`}>Website</label>
        <input
          id={`${messageId}-hp`}
          type="text"
          name={NEWSLETTER_HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          autoComplete="email"
          aria-label={labels.label}
          aria-describedby={messageId}
          aria-invalid={isError || undefined}
          placeholder={labels.placeholder}
          // Not cleared by hand: React 19 resets an uncontrolled form after
          // its action resolves, so the address is gone on success without
          // this component holding it in state. Making it controlled to
          // "clear it properly" would also break the no-JS submit.
          // On a filled band the input paints the PAGE surface, so it must take
          // the page's ink too — otherwise it inherits the band's foreground
          // and a dark-band footer types white on white.
          className={cn("flex-1", tone !== "default" && "bg-background text-foreground")}
        />
        <Button
          type="submit"
          loading={pending}
          variant={tone === "onFill" ? "secondary" : "default"}
        >
          {pending ? labels.pendingLabel : labels.submitLabel}
        </Button>
      </div>

      <p
        id={messageId}
        {...(isError || state.status === "sent" ? { role: "status", "aria-live": "polite" } : {})}
        className={cn(
          "text-xs",
          tone === "onFill" && "text-primary-foreground/80",
          tone === "onSecondary" && "text-secondary-foreground/70",
          tone === "default" && "text-muted-foreground",
          // Destructive TEXT is the interactive token on both surfaces
          // (ADR-077): raw red fails 4.5:1 on the dark ground. On a filled
          // band the tone token above already carries enough contrast, and
          // swapping in destructive ink there would fail instead.
          isError && tone === "default" && "text-destructive-interactive",
        )}
      >
        {message}
      </p>
    </form>
  );
}
