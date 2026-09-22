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
// Staff sign in at `/keystone` and belong to the admin surface (ADR-052).
// Putting "System Administrator" in the public header both advertises the
// portal the public site deliberately hides and hands a visitor an identity
// chip with nowhere to go. Display-only — the session is untouched, and
// `/keystone` still recognises it. Applied HERE, once, so every consumer inherits
// it rather than each remembering to.
//
// ─── Refreshing after a change on the account page (ADR-125 §3) ──────────
//
// The read runs once per page load, so a picture or name changed on
// `/account` would otherwise stay stale in the header until the next full
// navigation — and past it, for as long as Better Auth's signed cookie cache
// lives. `refresh()` re-reads with `disableCookieCache`, which also re-signs
// that cookie from the fresh copy. It is a SEPARATE context so the session
// value every consumer reads keeps its shape.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { rememberSession } from "../../../_lib/session-hint.ts";

export type PublicSession =
  | { status: "loading" }
  | { status: "anonymous" }
  | {
      status: "learner";
      name: string;
      email: string;
      emailVerified: boolean;
      /** The avatar the profile page set (ADR-123), for the header menu's trigger. */
      image: string | null;
      /**
       * A STAFF member is inside this learner's session (ADR-142 §3) — the
       * session row carries `impersonatedBy`. Drives the "return to admin"
       * banner; grants nothing.
       */
      impersonating: boolean;
    };

const PublicSessionContext = createContext<PublicSession>({ status: "loading" });
const RefreshContext = createContext<() => Promise<void>>(async () => {});

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

/** Re-read the session past the cookie cache (ADR-125 §3). A no-op outside the provider. */
export function useRefreshPublicSession(): () => Promise<void> {
  return useContext(RefreshContext);
}

type SessionPayload = {
  session?: { impersonatedBy?: string | null };
  user?: {
    name?: string;
    email?: string;
    userType?: string;
    emailVerified?: boolean;
    image?: string | null;
  };
} | null;

async function readSession(fresh: boolean): Promise<PublicSession> {
  const url = fresh ? "/api/auth/get-session?disableCookieCache=true" : "/api/auth/get-session";
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (response.ok ? await response.json() : null) as SessionPayload;
    const signedIn = Boolean(payload?.user && payload.user.userType !== "STAFF");
    // ADR-124 §3: the attribute the subscribe bands hide under, and the
    // hint the next page's pre-paint script reads. Corrected here on
    // every read, so a stale hint lasts one paint at most.
    rememberSession(signedIn);
    return payload?.user && signedIn
      ? {
          status: "learner",
          name: payload.user.name ?? "",
          email: payload.user.email ?? "",
          // Better Auth returns this on the session user by default.
          // ADR-079 #7's consequence applies: an unverified learner
          // keeps full access, so nothing may ASSUME this is true —
          // which is exactly why the nudge is a nudge.
          emailVerified: payload.user.emailVerified === true,
          image: typeof payload.user.image === "string" ? payload.user.image : null,
          impersonating: typeof payload.session?.impersonatedBy === "string",
        }
      : { status: "anonymous" };
  } catch {
    // A failed session read resolves to anonymous, never to an error state.
    // The worst outcome is a signed-in learner briefly seeing a sign-up
    // prompt; the alternative — a stuck spinner in the header of every
    // cached page — is worse and lasts longer.
    rememberSession(false);
    return { status: "anonymous" };
  }
}

export function PublicSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PublicSession>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void readSession(false).then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setSession(await readSession(true));
  }, []);

  return (
    <RefreshContext value={refresh}>
      <PublicSessionContext value={session}>{children}</PublicSessionContext>
    </RefreshContext>
  );
}
