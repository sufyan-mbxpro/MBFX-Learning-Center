"use client";

// Keeps a dynamic admin screen current while it is open (changes-51: "check
// the usage & stats … will work in real time").
//
// The data behind such a screen is already live — it is read uncached on every
// request — so what goes stale is only the PAGE the reader is looking at.
// `router.refresh()` re-renders the server component in place: the URL, the
// scroll position and any client state (a table's filters) survive it.
//
// Three triggers, each for a reason:
//   - on MOUNT, because a tab strip prefetches its routes in full (ADR-140 §4)
//     and a prefetched payload can be minutes old by the time it is opened;
//   - on an INTERVAL, only while the tab is visible, so a background tab
//     costs nothing;
//   - on becoming VISIBLE again, so returning to the tab is never stale.
import { useEffect, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/button";

const noopSubscribe = () => () => {};

export function LiveRefresh({
  renderedAt,
  intervalMs = 30_000,
  labels,
}: {
  /** When the server rendered this payload, ISO. It changes on every refresh. */
  renderedAt: string;
  intervalMs?: number;
  labels: { updated: string; refresh: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The time is formatted only on the client: the server's clock zone is not
  // the reader's, and a mismatched text node is a hydration warning.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const time = hydrated ? new Date(renderedAt).toLocaleTimeString() : null;

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    };
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-success" />
        {time ? labels.updated.replace("{time}", time) : null}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => startTransition(() => router.refresh())}
        loading={pending}
      >
        <RefreshCw aria-hidden data-icon="inline-start" />
        {labels.refresh}
      </Button>
    </div>
  );
}
