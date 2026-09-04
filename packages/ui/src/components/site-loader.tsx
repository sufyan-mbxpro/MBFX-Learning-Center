"use client";

// ADR-018 §3.1 — the reference's full-screen preloader, as a bounded
// deviation. The overlay's VISUAL (spin, fade) is pure CSS, per ADR-018
// rule 1; the JS here only decides WHETHER and HOW LONG to show it, which
// "first visit this tab, capped at 900ms" cannot be expressed in CSS alone.
//
// It never delays first paint: this component renders nothing during SSR
// and the initial client render (sessionStorage isn't readable then), so
// the page underneath is already painted before this can appear at all —
// rule 4(a) is satisfied structurally, not by careful timing. `pointer-
// events-none` means it never blocks interaction either, for the same
// belt-and-suspenders reason. The `layout.pageLoader` kill switch (rule 4d)
// is the CALLER's job — this component takes no settings dependency
// (architecture.md #10: @repo/ui doesn't depend on @repo/settings) and
// simply isn't rendered when the setting is off.
import { useEffect, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

const SESSION_KEY = "mbfx:site-loader-shown";
const HARD_CAP_MS = 900;
const FADE_MS = 200;

function SiteLoader({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
      if (!alreadyShown) sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Storage can throw (private mode, blocked cookies). Fail open: skip
      // the loader rather than risk a permanently-visible overlay with no
      // way to mark itself as shown.
      return;
    }
    if (alreadyShown) return;

    setVisible(true);
    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      setDismissing(true);
      window.setTimeout(() => setVisible(false), FADE_MS);
    }

    const cap = window.setTimeout(dismiss, HARD_CAP_MS);
    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }

    return () => {
      window.clearTimeout(cap);
      window.removeEventListener("load", dismiss);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      data-slot="site-loader"
      className={cn(
        "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-(--duration-base)",
        dismissing ? "opacity-0" : "opacity-100",
        className,
      )}
    >
      <span className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary-interactive" />
    </div>
  );
}

export { SiteLoader };
