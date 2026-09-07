"use client";

// ADR-041 — ten-minute idle auto sign-out, ADMIN SURFACE ONLY. Mounted once
// by AdminShell, which is what makes "admin only" structural rather than a
// rule someone has to remember.
//
// This is a UX-grade control, and the ADR says so plainly: it is client
// JavaScript, so it can be disabled, and a closed tab stops the timer with
// the session still valid until `expiresIn`. It shortens the window on an
// UNATTENDED SCREEN, which is the actual threat. Every server-side check
// (requirePermission, the admin layout's STAFF re-check, the proxy gate)
// is untouched and remains the real boundary.
//
// Sign-out goes through Better Auth's own endpoint, so the session row is
// deleted server-side — a client-side cookie clear would leave a live,
// stealable session and is exactly what security.md #11 exists to prevent.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

/** ADR-041: the owner's number. One constant, one place to change it. */
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
/** How long the "you're about to be signed out" dialog stands. */
const WARNING_MS = 60 * 1000;
/** Don't reset the deadline more than this often — activity events are noisy. */
const THROTTLE_MS = 5 * 1000;

// Deliberately NOT mousemove: a resting mouse on a jittery trackpad fires
// it continuously and would defeat the timer entirely. `visibilitychange`
// counts as activity (coming back to the tab is a person arriving), which
// also means background-tab timer throttling can only ever DELAY the
// sign-out, never trigger one early.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

export interface IdleTimeoutLabels {
  title: string;
  /** Takes a {seconds} placeholder, filled client-side as the countdown ticks. */
  description: string;
  stay: string;
  signOut: string;
}

export function IdleTimeout({ labels }: { labels: IdleTimeoutLabels }) {
  const router = useRouter();
  // `warning` is the whole state machine: false = watching for idleness,
  // true = counting down to sign-out. Both effects below key off it, which
  // is what keeps this free of refs-written-during-render (each phase owns
  // its own timers and tears them down when the phase ends).
  const [warning, setWarning] = React.useState(false);
  const [remaining, setRemaining] = React.useState(Math.ceil(WARNING_MS / 1000));

  const signOut = React.useCallback(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/admin/sign-in");
    router.refresh();
  }, [router]);

  // Phase 1 — watch for idleness. Runs only while the dialog is DOWN, so
  // once the warning is up ordinary activity cannot silently cancel it:
  // the person has to answer. (Otherwise a stray scroll from someone
  // walking past the desk resets the very timer that was doing its job.)
  React.useEffect(() => {
    if (warning) return;

    // The countdown is seeded HERE, at the moment the phase flips, rather
    // than in phase 2's effect body — a setState in an effect body is a
    // cascading render, and this is a timer callback, which is exactly the
    // "call setState from a callback when external state changes" shape
    // effects are for.
    function startWarning() {
      setRemaining(Math.ceil(WARNING_MS / 1000));
      setWarning(true);
    }

    let timer = window.setTimeout(startWarning, IDLE_TIMEOUT_MS - WARNING_MS);
    let lastReset = Date.now();

    function onActivity() {
      const now = Date.now();
      if (now - lastReset < THROTTLE_MS) return;
      lastReset = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(startWarning, IDLE_TIMEOUT_MS - WARNING_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") onActivity();
    }

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [warning]);

  // Phase 2 — the countdown, and the sign-out at the end of it.
  React.useEffect(() => {
    if (!warning) return;

    const deadline = Date.now() + WARNING_MS;
    const ticker = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    const timer = window.setTimeout(() => void signOut(), WARNING_MS);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(timer);
    };
  }, [warning, signOut]);

  // Dismissing the dialog re-arms phase 1 by flipping the one piece of
  // state both effects key off — there is no second copy of the timer
  // setup that could drift from the listener's.
  const stay = () => setWarning(false);

  return (
    <Dialog open={warning} onOpenChange={(open) => !open && stay()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription aria-live="assertive">
            {labels.description.replace("{seconds}", String(remaining))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void signOut()}>
            {labels.signOut}
          </Button>
          <Button onClick={stay}>{labels.stay}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
