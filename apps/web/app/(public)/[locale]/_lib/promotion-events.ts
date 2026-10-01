// The client half of the promotion counters (ADR-170, changes-52 P7).
//
// Events queue for a moment and leave together, so a three-promotion dialog
// seen and closed is one request rather than six, which keeps a reader well
// inside the endpoint's per-IP budget. `keepalive` lets the last report outlive
// a full page unload (an external link, a closed tab). Every failure is
// swallowed: counting is never allowed to cost the reader anything.
import { PROMOTION_EVENTS_MAX, PROMOTION_EVENTS_PATH, type PromotionEvent } from "@repo/contracts";

const FLUSH_DELAY_MS = 1_000;

let queue: PromotionEvent[] = [];
let queueLocale: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function send(locale: string, events: PromotionEvent[]): void {
  try {
    void fetch(PROMOTION_EVENTS_PATH, {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, events }),
    }).catch(() => {});
  } catch {
    /* no fetch, or keepalive refused — not counted */
  }
}

export function flushPromotionEvents(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const locale = queueLocale;
  const pending = queue;
  queue = [];
  queueLocale = null;
  if (!locale) return;
  for (let i = 0; i < pending.length; i += PROMOTION_EVENTS_MAX) {
    send(locale, pending.slice(i, i + PROMOTION_EVENTS_MAX));
  }
}

/** Queue one event. The server counts each (promotion, surface, event) once per day anyway. */
export function reportPromotionEvent(locale: string, event: PromotionEvent): void {
  if (typeof window === "undefined") return;
  // A language switch mid-queue sends what is queued under the old one first.
  if (queueLocale !== null && queueLocale !== locale) flushPromotionEvents();
  queueLocale = locale;
  if (
    !queue.some((q) => q.id === event.id && q.surface === event.surface && q.type === event.type)
  ) {
    queue.push(event);
  }
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", flushPromotionEvents);
  }
  if (timer === null) timer = setTimeout(flushPromotionEvents, FLUSH_DELAY_MS);
}
