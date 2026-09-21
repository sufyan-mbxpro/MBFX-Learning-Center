"use client";

// Brings the header's session into line with what the account page just
// rendered (ADR-125 §3).
//
// The page is rendered from the database; the header menu is rendered from
// the one client session read, which ran when the page loaded. After a new
// picture (`router.refresh()` re-renders this with the new URL), a saved name,
// or a verification link that landed here, the two disagree — and this is the
// moment to re-read. Once per distinct server value: if the re-read still
// disagrees (a failed request), it does not try again in a loop.
import { useEffect, useRef } from "react";
import { usePublicSession, useRefreshPublicSession } from "../../_components/public-session.tsx";

export function SessionSync({
  name,
  image,
  emailVerified,
}: {
  name: string;
  image: string | null;
  emailVerified: boolean;
}) {
  const session = usePublicSession();
  const refresh = useRefreshPublicSession();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (session.status !== "learner") return;
    const stale =
      session.name !== name || session.image !== image || session.emailVerified !== emailVerified;
    if (!stale) return;
    const key = JSON.stringify([name, image, emailVerified]);
    if (attempted.current === key) return;
    attempted.current = key;
    void refresh();
  }, [session, name, image, emailVerified, refresh]);

  return null;
}
