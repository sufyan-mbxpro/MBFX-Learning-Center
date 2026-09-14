"use client";

// The public surface's ONE session read (changes-28 PR 5, ADR-094).
//
// ─── Why client-side at all ───────────────────────────────────────────────
//
// The public surface is static/cached (ADR-004). A SERVER session read here
// puts an uncached `auth()` — a DB/Redis round trip that deliberately bypasses
// the cookie cache — on EVERY public navigation, which is what Cache
// Components' dev insight flagged when `AuthSlot` first did it. Auth state on
// a public page is DISPLAY, not authorization, so it hydrates from Better
// Auth's get-session endpoint (which honours the fast signed cookie cache) and
// the server shell carries no session read at all.
//
// The real boundaries are untouched: the proxy gate, the admin layout's
// `loadSubject` re-check, and `requirePermission()` in every action.
//
// ─── Why a provider rather than a second fetch ────────────────────────────
//
// `AuthSlot` used to own this fetch. changes-28 adds a second consumer — the
// signed-out visitor band above the footer, on every page — and two islands
// each calling `/api/auth/get-session` is two round trips for one answer, two
// independent loading states, and two chances for the header and the footer to
// disagree about who is reading the page. One provider, mounted in the root
// layout, resolves all three.
//
// ─── A STAFF session reads as anonymous ───────────────────────────────────
//
// Staff sign in at `/admin/sign-in` and belong to the admin surface (ADR-052).
// Putting "System Administrator" in the public header both advertises the
// portal the public site deliberately hides and hands a visitor an identity
// chip with nowhere to go. Display-only — the session is untouched, and
// `/admin` still recognises it. Applied HERE, once, so every consumer inherits
// it rather than each remembering to.
import { createContext, useContext, useEffect, useState } from "react";

export type PublicSession =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "learner"; name: string; email: string; emailVerified: boolean };

const PublicSessionContext = createContext<PublicSession>({ status: "loading" });

/**
 * The session as the public surface sees it.
 *
 * Outside the provider this returns `loading` forever rather than throwing.
 * Every consumer already has to render something sane while the fetch is in
 * flight, so "loading" is a state they all handle — and a throw here would
 * turn a misplaced island into a blank page rather than a missing chip.
 */
export function usePublicSession(): PublicSession {
  return useContext(PublicSessionContext);
}

export function PublicSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PublicSession>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/get-session", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          payload: {
            user?: { name?: string; email?: string; userType?: string; emailVerified?: boolean };
          } | null,
        ) => {
          if (cancelled) return;
          setSession(
            payload?.user && payload.user.userType !== "STAFF"
              ? {
                  status: "learner",
                  name: payload.user.name ?? "",
                  email: payload.user.email ?? "",
                  // Better Auth returns this on the session user by default.
                  // ADR-079 #7's consequence applies: an unverified learner
                  // keeps full access, so nothing may ASSUME this is true —
                  // which is exactly why the nudge is a nudge.
                  emailVerified: payload.user.emailVerified === true,
                }
              : { status: "anonymous" },
          );
        },
      )
      // A failed session read resolves to anonymous, never to an error state.
      // The worst outcome is a signed-in learner briefly seeing a sign-up
      // prompt; the alternative — a stuck spinner in the header of every
      // cached page — is worse and lasts longer.
      .catch(() => {
        if (!cancelled) setSession({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <PublicSessionContext value={session}>{children}</PublicSessionContext>;
}
