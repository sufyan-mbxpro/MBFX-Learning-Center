"use client";

// Client-side auth chip. The public surface is static/cached; a SERVER
// session read here put an uncached auth() (DB/Redis round trip, cookie
// cache deliberately bypassed) on EVERY public navigation — Cache
// Components' dev insight rightly flagged it. Auth state on the public
// header is DISPLAY, not authorization, so it hydrates client-side from
// Better Auth's get-session endpoint (which honors the fast signed cookie
// cache) and the server shell carries no session read at all. The real
// boundaries are untouched: proxy gate + admin layout's loadSubject
// re-check + requirePermission in every action.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";

type AuthState =
  { status: "loading" } | { status: "anonymous" } | { status: "signed-in"; name: string };

export function AuthSlot() {
  const t = useTranslations("nav");
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/get-session", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: { name?: string } } | null) => {
        if (cancelled) return;
        setState(
          session?.user
            ? { status: "signed-in", name: session.user.name ?? "" }
            : { status: "anonymous" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <span className="h-5 w-16 animate-pulse rounded bg-muted" aria-hidden />;
  }

  if (state.status === "anonymous") {
    return (
      <Link
        href="/sign-in"
        className="text-sm font-medium text-primary-interactive underline-offset-4 hover:underline"
      >
        {t("signIn")}
      </Link>
    );
  }

  // The account menu proper lands with the user-facing account area
  // (Module 12); until then the chip just reflects auth state.
  return <span className="max-w-32 truncate text-sm text-muted-foreground">{state.name}</span>;
}
