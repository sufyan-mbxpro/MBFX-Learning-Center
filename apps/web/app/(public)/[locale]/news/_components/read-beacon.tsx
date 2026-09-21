"use client";

// The article page's read beacon (ADR-123 #2).
//
// The page is cached and reads no session (ADR-056 #1), so recording "this
// learner read this" cannot happen while it renders. This island waits for the
// public session (ADR-094's one read — it adds no second one), and only for a
// signed-in LEARNER does it post the article id, once per mount. The route
// decides who the reader is from the session; nothing here is trusted.
//
// Renders nothing, and a failed post is ignored: a missing history row is not
// something a reader should be interrupted about.
import { useEffect, useRef } from "react";
import { usePublicSession } from "../../_components/public-session.tsx";

export const READ_BEACON_ENDPOINT = "/api/account/reads";

export function ReadBeacon({ articleId }: { articleId: string }) {
  const session = usePublicSession();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (session.status !== "learner" || sent.current === articleId) return;
    sent.current = articleId;
    void fetch(READ_BEACON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }),
      keepalive: true,
    }).catch(() => undefined);
  }, [session.status, articleId]);

  return null;
}
