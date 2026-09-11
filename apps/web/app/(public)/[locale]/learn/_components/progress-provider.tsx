"use client";

// The progress island's brain (changes-11 PR 5.3, ADR-056 #1).
//
// **Why a provider rather than one component.** A course page needs the same
// progress in three places that are nowhere near each other in the tree — the
// bar in the header card, the CTA beside it, and the marker on every lesson
// row further down. Three islands would mean three fetches of the same thing
// on one paint. One provider fetches once and the consumers are cheap.
//
// **Why the children stay server-rendered.** `children` is passed THROUGH this
// client component, so everything inside it (the hero, the prose, the
// recommendations) is still rendered on the server and streamed as RSC
// payload. Only the leaves that call `useProgress()` are client components.
//
// **Why there is no optimistic state.** Every write returns the recomputed
// `CourseProgressView` from the server, and that value replaces local state
// wholesale. An optimistic ✓ that a failed request has to walk back is a worse
// experience than a control that is briefly busy, and it would let the
// denormalised counter and the screen disagree.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CourseProgressView,
  EnrollmentSummary,
  LearnerDashboardView,
  LessonProgressState,
} from "@repo/contracts";

/**
 * - `loading` — the fetch is in flight; render the not-started state.
 * - `guest`   — 401. The reader may read everything and save nothing
 *               (ADR-056 #3); this is what shows the sign-in card.
 * - `off`     — 404. `courses` or `progress_tracking` is not visible to this
 *               reader, so progress does not exist here. Distinct from `guest`
 *               because inviting someone to sign in for a feature that is
 *               switched off is a broken promise.
 * - `ready`   — real state, in `view`.
 * - `error`   — the request failed. The page still works; nothing is claimed.
 */
export type ProgressStatus = "loading" | "guest" | "off" | "ready" | "error";

export type ProgressAction = "complete" | "incomplete" | "touch";

interface ProgressContextValue {
  status: ProgressStatus;
  view: CourseProgressView | null;
  /** Per-lesson state, or undefined for a lesson with no row (= not started). */
  stateFor: (lessonId: string) => LessonProgressState | undefined;
  /** True while a write is in flight, so a control can disable itself. */
  pending: boolean;
  write: (action: ProgressAction, lessonId: string) => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const ENDPOINT = "/api/learn/progress";

/**
 * `null` outside a provider rather than a throw.
 *
 * A consumer rendered outside one should degrade to the not-started state the
 * server already rendered, not crash the page. The progress island is an
 * enhancement; nothing on these pages is allowed to depend on it existing.
 */
export function useProgress(): ProgressContextValue {
  return (
    use(ProgressContext) ?? {
      status: "off",
      view: null,
      stateFor: () => undefined,
      pending: false,
      write: async () => {},
    }
  );
}

export function ProgressProvider({
  courseId,
  /**
   * Recorded as visited as soon as the provider mounts, when given — the
   * lesson page passes the lesson being read. This is what moves "Continue
   * learning" forward without the reader pressing anything.
   */
  touchLessonId,
  children,
}: {
  courseId: string;
  touchLessonId?: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<ProgressStatus>("loading");
  const [view, setView] = useState<CourseProgressView | null>(null);
  const [pending, setPending] = useState(false);

  /** Applies one response to state, mapping the status codes to the union. */
  const apply = useCallback(async (response: Response): Promise<void> => {
    if (response.status === 401) {
      setStatus("guest");
      return;
    }
    if (response.status === 404) {
      setStatus("off");
      return;
    }
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setView((await response.json()) as CourseProgressView);
    setStatus("ready");
  }, []);

  // The provider is mounted once per page view and the effect runs once. React
  // 19 Strict Mode double-invokes effects in development, which would fire two
  // touches; the ref makes that a no-op rather than two rows racing for the
  // same unique key.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const controller = new AbortController();
    void (async () => {
      try {
        // A touch is a write that ALSO returns the full view, so a lesson page
        // costs one request rather than a POST and then a GET.
        const response = touchLessonId
          ? await fetch(ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lessonId: touchLessonId, action: "touch" }),
              signal: controller.signal,
            })
          : await fetch(`${ENDPOINT}?course=${encodeURIComponent(courseId)}`, {
              signal: controller.signal,
            });
        await apply(response);
      } catch {
        // An aborted fetch is a navigation, not a failure — leaving the status
        // at `loading` on an unmounting tree avoids a flash of the error state.
        if (!controller.signal.aborted) setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [courseId, touchLessonId, apply]);

  const write = useCallback(
    async (action: ProgressAction, lessonId: string) => {
      setPending(true);
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, action }),
        });
        await apply(response);
      } catch {
        setStatus("error");
      } finally {
        setPending(false);
      }
    },
    [apply],
  );

  const value = useMemo<ProgressContextValue>(() => {
    const byLesson = new Map(view?.lessons.map((row) => [row.lessonId, row.state]) ?? []);
    return {
      status,
      view,
      stateFor: (lessonId: string) => byLesson.get(lessonId),
      pending,
      write,
    };
  }, [status, view, pending, write]);

  return <ProgressContext value={value}>{children}</ProgressContext>;
}

/**
 * The learner's enrollment summaries, for the `/learn` shelf's "Pick up where
 * you left off" band (PR 5.4).
 *
 * A hook rather than a second provider because it has exactly one consumer,
 * and it is deliberately NOT part of `ProgressProvider`: that provider is
 * scoped to one course and this answers a question about all of them. Merging
 * them would make every lesson page fetch a dashboard it never renders.
 *
 * The same three non-`ready` statuses mean the same things here, and the band
 * renders in none of them — an empty "your courses" band on a first visit is
 * chrome for content that does not exist.
 */
export function useLearnerDashboard(): {
  status: ProgressStatus;
  enrollments: EnrollmentSummary[];
} {
  const [status, setStatus] = useState<ProgressStatus>("loading");
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(ENDPOINT, { signal: controller.signal });
        if (response.status === 401) return setStatus("guest");
        if (response.status === 404) return setStatus("off");
        if (!response.ok) return setStatus("error");
        const body = (await response.json()) as LearnerDashboardView;
        setEnrollments(body.enrollments);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, []);

  return { status, enrollments };
}
