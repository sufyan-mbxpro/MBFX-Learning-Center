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
import { useEffect, useRef, useState } from "react";

import { cn } from "@repo/ui/lib/utils";
import { Spinner } from "@repo/ui/components/spinner";

const SESSION_KEY = "mbx:site-loader-shown";
const HARD_CAP_MS = 900;
const FADE_MS = 200;

function SiteLoader({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  // changes-46: "when we click on preview or live view the first time it is
  // stuck on loading; after a refresh the page shows". The admin's Preview and
  // View live buttons open a NEW tab with `noopener`, which starts a fresh
  // sessionStorage, so the loader always shows there. The effect used to do
  // two jobs in one pass — claim the session AND arm the dismissal — and
  // React re-runs a mount effect (StrictMode in development, and any remount
  // of the root layout's island) after running its cleanup. The cleanup
  // cleared the cap and the `load` listener; the replay then found the
  // session already claimed and returned early. Nothing was left to dismiss
  // an overlay that was already visible, so it sat over the page until a
  // refresh, which skipped it because the session was marked. Whenever the
  // document had not finished loading at hydration (a cold page, a large
  // hero) that was every first open of a preview tab.
  //
  // `claimed` survives the replay (refs do; effects do not), so the SECOND
  // run knows this instance is the one showing the overlay and re-arms the
  // dismissal instead of bailing out.
  const claimed = useRef(false);

  useEffect(() => {
    if (!claimed.current) {
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

      claimed.current = true;
      setVisible(true);
    }

    // Armed on EVERY run of this effect, the replay included — the property
    // the bug above lacked. The cap restarts on a replay, which can only make
    // the overlay shorter than a reader would otherwise have seen, never
    // longer than 900ms from the last mount.
    let dismissed = false;
    let fade: number | undefined;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      setDismissing(true);
      fade = window.setTimeout(() => setVisible(false), FADE_MS);
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
      // A fade already under way finishes on the next run's dismissal.
      if (fade !== undefined) window.clearTimeout(fade);
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
      {/* The branded mark, not a plain CSS ring — same Spinner every other
          pending state uses, at overlay scale, wrapped in the shared
          zoom-in/breathe treatment (globals.css `.brand-loader-zoom`).
          Still pure CSS, so ADR-018 rule 1 holds: the JS above decides
          only WHETHER and HOW LONG, never how it looks. */}
      <Spinner aria-hidden className="brand-loader-zoom size-20" />
    </div>
  );
}

export { SiteLoader };
