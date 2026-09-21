"use client";

// "Sign in to save your scores" (ADR-058 #7).
//
// The page is cached and reads no session, so the only way to know whether the
// reader has an account is to ask — the same shape `ProgressSignInCard` uses,
// and the same reason. It asks the CHEAPEST endpoint that answers the
// question: the progress dashboard, which returns 401 for a guest and a
// (usually tiny) list otherwise.
//
// It renders nothing at all until it knows. A prompt that flashes for
// signed-in readers on every quiz page is worse than one that appears a beat
// late for guests.
//
// **It owns its own band** (design pass 2026-09-09), and that is not a styling
// preference. "Renders nothing" has to mean nothing: a `<Section>` wrapped
// around this by the page would keep its `padding-block` for every signed-in
// reader, leaving a blank strip where the component correctly decided to say
// nothing. A component whose answer is usually "no" cannot leave its spacing
// to a caller that has already committed to it.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SaveProgressPrompt } from "./course-progress.tsx";

export function QuizSignInPrompt({ className }: { className?: string }) {
  const t = useTranslations("learn");
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/learn/progress", { signal: controller.signal });
        setIsGuest(response.status === 401);
      } catch {
        // A failed probe is not evidence of anything. Staying silent is the
        // conservative answer: the worst case is a guest who is not offered
        // the prompt, and the attempt endpoint tells them anyway.
        if (!controller.signal.aborted) setIsGuest(false);
      }
    })();
    return () => controller.abort();
  }, []);

  if (isGuest !== true) return null;

  return (
    <Section spacing="sm">
      <Container>
        <div className={className}>
          <SaveProgressPrompt title={t("quizzes.guestTitle")} body={t("quizzes.guestBody")} />
        </div>
      </Container>
    </Section>
  );
}
