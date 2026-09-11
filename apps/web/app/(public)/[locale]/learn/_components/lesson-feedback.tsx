"use client";

// "Was this lesson helpful?" (PR 5.5, ADR-056 #8).
//
// Two buttons, one POST, and a thank-you. It asks everyone, signed in or not:
// gating the question behind an account would collect almost nothing, and the
// endpoint accepts anonymous votes for that reason.
//
// **`localStorage` here is UX, not security.** It stops a reader voting twice
// by accident and remembers the thank-you across a reload. It is trivially
// cleared and it is not a deduplication mechanism the server relies on — the
// route is written as though this file did not exist. Every access is wrapped:
// a browser with site data blocked throws on the property itself, and a
// feedback widget must not be the thing that breaks a lesson page.
import { useCallback, useState, useSyncExternalStore } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";

const STORAGE_PREFIX = "mbx.lesson-feedback.";

function readVoted(lessonId: string): boolean {
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${lessonId}`) !== null;
  } catch {
    return false;
  }
}

function rememberVoted(lessonId: string): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${lessonId}`, "1");
  } catch {
    // A browser that refuses storage still gets to vote; it just gets asked
    // again next visit. Losing the memory is not losing the feature.
  }
}

/**
 * Nothing outside this component ever changes the stored flag, so there is
 * nothing to subscribe to — but `useSyncExternalStore` is still the right tool
 * and not a workaround. It is the one hook that reads a client-only value with
 * a SEPARATE server snapshot, which is exactly the shape of the problem:
 * `localStorage` does not exist during SSR, and reading it in the initial
 * client render would make the two markups disagree.
 *
 * The obvious alternative — an effect that calls `setState` — is a cascading
 * render, and `react-hooks/set-state-in-effect` rejects it.
 */
function noopSubscribe(): () => void {
  return () => {};
}

export function LessonFeedback({ lessonId }: { lessonId: string }) {
  const t = useTranslations("learn");
  const [state, setState] = useState<"asking" | "sending" | "thanks" | "error">("asking");

  const alreadyVoted = useSyncExternalStore(
    noopSubscribe,
    useCallback(() => readVoted(lessonId), [lessonId]),
    // The server, and the first client render, always assume "not yet voted".
    () => false,
  );

  async function vote(helpful: boolean) {
    setState("sending");
    try {
      const response = await fetch("/api/learn/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, helpful }),
      });
      if (!response.ok) return setState("error");
      rememberVoted(lessonId);
      setState("thanks");
    } catch {
      setState("error");
    }
  }

  if (state === "thanks" || (alreadyVoted && state === "asking")) {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t("feedback.thanks")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-medium">{t("feedback.question")}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={state === "sending"}
          onClick={() => void vote(true)}
        >
          <ThumbsUp data-icon="inline-start" aria-hidden />
          {t("feedback.yes")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={state === "sending"}
          onClick={() => void vote(false)}
        >
          <ThumbsDown data-icon="inline-start" aria-hidden />
          {t("feedback.no")}
        </Button>
      </div>
      {state === "error" && (
        <p aria-live="polite" className="text-sm text-destructive">
          {t("feedback.error")}
        </p>
      )}
    </div>
  );
}
