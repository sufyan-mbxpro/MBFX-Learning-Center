"use client";

// The strip a STAFF member sees while inside a learner's session (ADR-142 §3).
//
// It exists for two reasons. The person reading the page must never mistake
// it for their own account — they are seeing someone else's progress and
// someone else's name in the header. And the way back must be one press: the
// learner session is refused by the `/keystone` gate, so without this strip the
// only exit would be waiting out the hour.
//
// "Return to admin" posts to `/api/auth/staff-impersonation/stop`, which
// deletes the learner session, writes the stop audit row and restores the
// parked staff session, then leaves with a FULL load into the admin's own
// root layout.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { usePublicSession } from "./public-session.tsx";

export function ImpersonationBanner() {
  const t = useTranslations("impersonation");
  const session = usePublicSession();
  const [leaving, setLeaving] = useState(false);

  if (session.status !== "learner" || !session.impersonating) return null;

  const stop = async () => {
    setLeaving(true);
    const response = await fetch("/api/auth/staff-impersonation/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    const restored =
      response?.ok === true &&
      ((await response.json().catch(() => null)) as { restored?: boolean } | null)?.restored;
    window.location.assign(restored ? "/keystone/users" : "/keystone");
  };

  return (
    <div
      role="status"
      data-slot="impersonation-banner"
      className="bg-secondary text-secondary-foreground"
    >
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
        <p className="flex items-center gap-2">
          <Eye aria-hidden className="size-4 shrink-0" />
          {t("viewingAs", { name: session.name || session.email })}
        </p>
        <Button size="sm" variant="inverted" loading={leaving} onClick={stop}>
          {t("returnToAdmin")}
        </Button>
      </div>
    </div>
  );
}
