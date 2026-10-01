"use client";

// The buttons on the announcement unsubscribe page (ADR-171 #9).
//
// **A button, not a link, and not on load.** Mail scanners fetch every URL in
// a message, so the link lands here and pressing the button is what stops the
// mail — the newsletter's `TokenAction` reasoning, unchanged. The token is read
// from `window.location` at press time, so the page stays a static shell.
//
// **It POSTs to the same route a mail client's one-click does**
// (`/api/email/unsubscribe`), with `op=undo` or `op=newsletter` for the second
// and third buttons: one anonymous endpoint, one guard stack.
import { useState, useTransition } from "react";
import { Button } from "@repo/ui/components/button";
import { Link } from "@repo/i18n/navigation";

export interface AnnouncementUnsubscribeLabels {
  body: string;
  action: string;
  pending: string;
  doneTitle: string;
  doneBody: string;
  undo: string;
  undoneTitle: string;
  undoneBody: string;
  newsletterPrompt: string;
  newsletterAction: string;
  newsletterDone: string;
  missingTitle: string;
  missingBody: string;
  failed: string;
  backHome: string;
}

type Stage = "idle" | "done" | "undone" | "missing";

const ENDPOINT = "/api/email/unsubscribe";

async function post(token: string, op?: "undo" | "newsletter"): Promise<{ newsletter: boolean }> {
  const query = new URLSearchParams({ t: token, ...(op ? { op } : {}) });
  const response = await fetch(`${ENDPOINT}?${query.toString()}`, { method: "POST" });
  if (!response.ok) throw new Error(String(response.status));
  const body = (await response.json()) as { newsletter?: boolean };
  return { newsletter: body.newsletter === true };
}

function readToken(): string | null {
  return new URLSearchParams(window.location.search).get("t");
}

export function AnnouncementUnsubscribe({ labels }: { labels: AnnouncementUnsubscribeLabels }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [offerNewsletter, setOfferNewsletter] = useState(false);
  const [newsletterDone, setNewsletterDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(op: "unsubscribe" | "undo" | "newsletter") {
    const token = readToken();
    if (!token) {
      setStage("missing");
      return;
    }
    setFailed(false);
    startTransition(async () => {
      try {
        if (op === "unsubscribe") {
          const result = await post(token);
          setOfferNewsletter(result.newsletter);
          setStage("done");
        } else if (op === "undo") {
          await post(token, "undo");
          setStage("undone");
        } else {
          await post(token, "newsletter");
          setNewsletterDone(true);
        }
      } catch {
        // A transient failure keeps the button: retrying is the right move.
        setFailed(true);
      }
    });
  }

  const failure = failed && (
    <p role="status" aria-live="polite" className="text-sm text-destructive-interactive">
      {labels.failed}
    </p>
  );
  const home = (
    <Button variant="outline" className="w-full" render={<Link href="/" />}>
      {labels.backHome}
    </Button>
  );

  if (stage === "missing") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold">{labels.missingTitle}</p>
          <p className="text-sm text-muted-foreground">{labels.missingBody}</p>
        </div>
        {home}
      </div>
    );
  }

  if (stage === "undone") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold">{labels.undoneTitle}</p>
          <p className="text-sm text-muted-foreground">{labels.undoneBody}</p>
        </div>
        {home}
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex flex-col gap-1.5">
          <p className="text-base font-semibold">{labels.doneTitle}</p>
          <p className="text-sm text-muted-foreground">{labels.doneBody}</p>
        </div>
        {offerNewsletter && !newsletterDone && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{labels.newsletterPrompt}</p>
            <Button
              type="button"
              variant="outline"
              loading={pending}
              onClick={() => run("newsletter")}
              className="w-full"
            >
              {labels.newsletterAction}
            </Button>
          </div>
        )}
        {newsletterDone && (
          <p role="status" className="text-sm text-muted-foreground">
            {labels.newsletterDone}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          loading={pending}
          onClick={() => run("undo")}
          className="w-full"
        >
          {labels.undo}
        </Button>
        {failure}
        {home}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{labels.body}</p>
      <Button type="button" loading={pending} onClick={() => run("unsubscribe")} className="w-full">
        {pending ? labels.pending : labels.action}
      </Button>
      {failure}
    </div>
  );
}
