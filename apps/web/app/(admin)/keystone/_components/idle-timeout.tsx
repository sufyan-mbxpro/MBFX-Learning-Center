"use client";

// Idle auto sign-out, ADMIN SURFACE ONLY. Mounted once by AdminShell, which is
// what makes "admin only" structural rather than a rule someone has to
// remember (ADR-041).
//
// ADR-128: this watcher no longer keeps its own clock. ADR-041 shipped a
// hard-coded ten minutes; ADR-105 later made the timeout an admin setting and
// enforced it on the SERVER as the session's own expiry — and the two never
// met. The visible dialog kept firing at ten minutes whatever was chosen
// ("never" included), while the real expiry passed silently on an open page.
// Now the SERVER's expiry is the only deadline:
//
//   - activity (throttled) calls `/keystone/api/session/activity`, which slides
//     the expiry through `auth()` and reports what is left;
//   - when the warning is due, `/keystone/api/session` is PEEKED — that read does
//     not count as activity — so a session another tab kept alive is followed
//     rather than ended;
//   - a 401 from either means the session is already over, and the page leaves.
//
// Still UX on top of the boundary, not the boundary: the expiry is enforced by
// `auth()` whether or not this runs (ADR-105 #1).
//
// Sign-out goes through Better Auth's own endpoint, so the session row is
// deleted server-side — a client-side cookie clear would leave a live,
// stealable session and is exactly what security.md #11 exists to prevent.
import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut as endSession } from "../../../_lib/credentials.ts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  ACTIVITY_PING_MS,
  deadlineFrom,
  extendedPastWarning,
  idleWarningMs,
  warningDelayMs,
  type SessionStatus,
} from "./idle-timing.ts";

const PEEK_URL = "/keystone/api/session";
const ACTIVITY_URL = "/keystone/api/session/activity";

// Deliberately NOT mousemove: a resting mouse on a jittery trackpad fires
// it continuously and would defeat the timer entirely. `visibilitychange`
// counts as activity (coming back to the tab is a person arriving), and it is
// also how a laptop waking from sleep finds out its session ended meanwhile.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const;

/** `null` = the session is over; `undefined` = could not tell (offline, 5xx). */
async function readStatus(url: string): Promise<SessionStatus | null | undefined> {
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "manual" });
    // The proxy redirects a request with no session cookie at all.
    if (response.status === 401 || response.type === "opaqueredirect") return null;
    if (!response.ok) return undefined;
    return (await response.json()) as SessionStatus;
  } catch {
    return undefined;
  }
}

export interface IdleTimeoutLabels {
  title: string;
  /** Takes a {seconds} placeholder, filled client-side as the countdown ticks. */
  description: string;
  stay: string;
  signOut: string;
}

export function IdleTimeout({
  timeoutMs: initialTimeoutMs,
  labels,
}: {
  /** The configured timeout; AdminShell does not mount this for "never". */
  timeoutMs: number;
  labels: IdleTimeoutLabels;
}) {
  const router = useRouter();
  // `warning` is the phase: false = watching, true = counting down. Both
  // effects key off it, so each phase owns its own timers.
  const [warning, setWarning] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  // The setting can change under an open tab; the server reports it on every
  // answer, and `null` (turned off) stops the watcher. AdminShell keys this
  // component by the timeout, so a re-render with a new value remounts it.
  const [timeoutMs, setTimeoutMs] = React.useState<number | null>(initialTimeoutMs);
  // The layout's `auth()` slid the session while rendering this page, so
  // "a full timeout from now" is the right first guess until the server says.
  const deadline = React.useRef(0);

  const signOut = React.useCallback(async () => {
    await endSession();
    router.push("/keystone");
    router.refresh();
  }, [router]);

  /** Apply a server answer; returns false when the page must leave. */
  const apply = React.useCallback((status: SessionStatus | null | undefined): boolean => {
    if (status === null) return false;
    if (status !== undefined) {
      deadline.current = deadlineFrom(status, Date.now());
      setTimeoutMs(status.timeoutMs);
    }
    return true;
  }, []);

  // Phase 1 — watching. Schedules a PEEK at the moment the warning would be
  // due, and tells the server about activity along the way.
  React.useEffect(() => {
    if (warning || timeoutMs === null) return;
    if (deadline.current === 0) deadline.current = Date.now() + timeoutMs;

    let cancelled = false;
    let timer = 0;
    let lastPing = 0;

    function schedule(ms: number) {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => void onWarningDue(ms),
        warningDelayMs(deadline.current, ms, Date.now()),
      );
    }

    async function onWarningDue(ms: number) {
      const status = await readStatus(PEEK_URL);
      if (cancelled) return;
      if (!apply(status)) return void signOut();
      if (status?.timeoutMs === null) return;
      if (status && extendedPastWarning(status, status.timeoutMs)) {
        schedule(status.timeoutMs);
        return;
      }
      // Could not reach the server: trust the last deadline we had.
      if (status === undefined && deadline.current - Date.now() > idleWarningMs(ms) + 1_000) {
        schedule(ms);
        return;
      }
      setRemaining(Math.ceil(Math.max(0, deadline.current - Date.now()) / 1000));
      setWarning(true);
    }

    async function ping(force: boolean) {
      const now = Date.now();
      if (!force && now - lastPing < ACTIVITY_PING_MS) return;
      lastPing = now;
      const status = await readStatus(ACTIVITY_URL);
      if (cancelled) return;
      if (!apply(status)) return void signOut();
      if (status?.timeoutMs != null) schedule(status.timeoutMs);
    }

    function onActivity() {
      void ping(false);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void ping(true);
    }

    schedule(timeoutMs);
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [warning, timeoutMs, apply, signOut]);

  // Phase 2 — the countdown to the server's deadline. At zero, one last peek:
  // another tab may have kept the session alive, and ending it from here would
  // sign that tab out too.
  React.useEffect(() => {
    if (!warning) return;
    let cancelled = false;

    const ticker = window.setInterval(() => {
      setRemaining(Math.ceil(Math.max(0, deadline.current - Date.now()) / 1000));
    }, 1000);
    const timer = window.setTimeout(
      async () => {
        const status = await readStatus(PEEK_URL);
        if (cancelled) return;
        if (
          status &&
          (status.timeoutMs === null || extendedPastWarning(status, status.timeoutMs))
        ) {
          apply(status);
          setWarning(false);
          return;
        }
        void signOut();
      },
      Math.max(0, deadline.current - Date.now()),
    );

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
      window.clearTimeout(timer);
    };
  }, [warning, apply, signOut]);

  // "Stay" is activity: it must reach the server, or the dialog closes over a
  // session that ends a few seconds later anyway.
  const stay = React.useCallback(async () => {
    const status = await readStatus(ACTIVITY_URL);
    if (!apply(status)) return void signOut();
    if (status === undefined) deadline.current = 0;
    setWarning(false);
  }, [apply, signOut]);

  return (
    <Dialog open={warning} onOpenChange={(open) => !open && void stay()}>
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
          <Button onClick={() => void stay()}>{labels.stay}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
