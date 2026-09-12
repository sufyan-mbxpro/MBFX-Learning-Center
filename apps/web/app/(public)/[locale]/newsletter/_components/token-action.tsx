"use client";

// The one button on the confirm and unsubscribe screens (ADR-080 #4).
//
// **Why a button and not a link.** Mail security scanners fetch every URL in a
// message before a human ever opens it. A GET that confirmed a subscription
// would therefore confirm addresses nobody clicked for, and a GET that
// unsubscribed would quietly remove readers who never asked — so the link in
// the email lands here, and pressing the button is what mutates.
//
// **Why the token is read at press time.** Reading a search param on the
// server would opt the whole route out of prerendering (architecture.md #6)
// for a value only this submit needs, and reading it in an effect to fill a
// hidden input would be a `setState` in an effect — which lint rightly
// refuses, and which would flash "incomplete link" at everyone during the
// first client render. `window.location` inside the handler runs in the
// browser, where the URL is simply available: the same shape
// `reset-password-form.tsx` uses for `?token=`.
//
// The cost is that these two screens need JavaScript, unlike the signup form.
// That is accepted rather than hidden: the token is in the URL fragment of a
// link only an email client hands out, and every path through here says what
// happened.
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Link } from "@repo/i18n/navigation";

export interface TokenActionLabels {
  /** The idle prompt, above the button. */
  body: string;
  action: string;
  pending: string;
  doneTitle: string;
  doneBody: string;
  invalidTitle: string;
  invalidBody: string;
  missingTitle: string;
  missingBody: string;
  failed: string;
  backHome: string;
}

type Outcome = "done" | "invalid" | "missing" | "failed";

export function TokenAction({
  action,
  doneStatus,
  labels,
}: {
  /** `confirmSubscriptionAction` or `unsubscribeAction`. */
  action: (token: string) => Promise<string>;
  /** Which returned status counts as success — "confirmed" or "unsubscribed". */
  doneStatus: string;
  labels: TokenActionLabels;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();

  function press() {
    // Read at press time, not at render: this runs in the browser, where the
    // URL is available without making the page dynamic.
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setOutcome("missing");
      return;
    }
    startTransition(async () => {
      const result = await action(token);
      setOutcome(result === doneStatus ? "done" : result === "invalid" ? "invalid" : "failed");
    });
  }

  if (outcome === "done") {
    return <Result title={labels.doneTitle} body={labels.doneBody} backHome={labels.backHome} />;
  }
  if (outcome === "invalid") {
    return (
      <Result title={labels.invalidTitle} body={labels.invalidBody} backHome={labels.backHome} />
    );
  }
  if (outcome === "missing") {
    return (
      <Result title={labels.missingTitle} body={labels.missingBody} backHome={labels.backHome} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.body}</p>
      <Button type="button" loading={pending} onClick={press} className="w-full">
        {pending ? labels.pending : labels.action}
      </Button>
      {outcome === "failed" && (
        // A transient failure keeps the button, because retrying is the right
        // next move — unlike an expired token, where retrying cannot help.
        <p role="status" aria-live="polite" className="text-sm text-destructive-interactive">
          {labels.failed}
        </p>
      )}
    </div>
  );
}

function Result({ title, body, backHome }: { title: string; body: string; backHome: string }) {
  return (
    // `role="status"` on the wrapper, so the outcome is announced when it
    // replaces the button rather than silently swapping under a screen reader.
    <div role="status" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Button variant="outline" className="w-full" render={<Link href="/" />}>
        {backHome}
      </Button>
    </div>
  );
}
