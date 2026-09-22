"use client";

// "Sign in to save your scores" (ADR-058 #7).
//
// The page is cached and reads no session, so the only way to know whether the
// reader has an account is to ask — the same shape the progress island uses,
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
import { cn } from "@repo/ui/lib/utils";
import { usePublicSession } from "../../_components/public-session.tsx";
import { SaveProgressPrompt } from "./course-progress.tsx";

export function QuizSignInPrompt({ className }: { className?: string }) {
  const t = useTranslations("learn");
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  // null until the probe answers; true when the feature exists for this reader.
  const [available, setAvailable] = useState<boolean | null>(null);
  const session = usePublicSession();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/learn/progress", { signal: controller.signal });
        setIsGuest(response.status === 401);
        setAvailable(response.status !== 404);
      } catch {
        // A failed probe is not evidence of anything. Staying silent is the
        // conservative answer: the worst case is a guest who is not offered
        // the prompt, and the attempt endpoint tells them anyway.
        if (!controller.signal.aborted) setIsGuest(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // changes-50: a staff session reads as signed out on the public site
  // (ADR-094), so it gets the prompt the header's "Sign in" already implies.
  const showAsGuest = isGuest === true || (session.status === "anonymous" && available === true);
  if (!showAsGuest) return null;

  return (
    // Flush on both edges with a short gap of its own above, and it pulls the
    // shelf below up into its top padding: the rhythm steps left the prompt
    // floating in ~90px of nothing between two bands it only annotates.
    <Section spacing="sm" className="section-flush-start section-flush-end">
      <Container>
        {/* `relative z-1`: the shelf's band paints its own ground, and the
            negative margin slides the card's lower edge underneath it. */}
        <div className={cn("relative z-1 -mb-4 pt-6", className)}>
          <SaveProgressPrompt title={t("quizzes.guestTitle")} body={t("quizzes.guestBody")} />
        </div>
      </Container>
    </Section>
  );
}
