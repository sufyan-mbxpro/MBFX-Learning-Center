"use client";

// The completion state (changes-11 Phase 7).
//
// Phase 7's other three items already shipped: the admin picker writing
// `ContentRelation` landed in PR 3.2, the same-track top-up lives in
// `resolveRecommendations`, and the course page has rendered the block since
// PR 4.2. **This is the one surface that was missing** — what a learner sees at
// the moment they finish.
//
// It renders from the SAME recommendations the page already loaded, passed
// down rather than fetched: the list is public, cached content, and asking the
// server again at the moment of completion would put a request in the path of
// a celebration.
//
// It appears only on `isCompleted`, which the progress island reports after
// hydrate (ADR-056 #1). A guest never sees it, and neither does a learner
// mid-course — there is nothing to congratulate yet.
import { PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";
import { useProgress } from "./progress-provider.tsx";

export interface NextCourse {
  id: string;
  href: string;
  title: string;
  meta: string;
}

export function CourseCompletionBanner({ recommendations }: { recommendations: NextCourse[] }) {
  const t = useTranslations("learn");
  const { status, view } = useProgress();

  if (status !== "ready" || !view?.isCompleted) return null;

  return (
    // `aria-live` because this appears AFTER paint, on hydrate — a screen
    // reader that has already read the page would otherwise never learn the
    // course is finished.
    <div
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border-2 border-success/40 bg-success/5 p-5"
    >
      <p className="flex items-center gap-2 font-semibold">
        <PartyPopper aria-hidden className="size-5 text-success-interactive" />
        {t("progress.completedTitle")}
      </p>
      <p className="text-sm text-muted-foreground">{t("progress.completedBody")}</p>

      {recommendations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("progress.whatNext")}</p>
          <ul className="flex flex-col gap-1.5">
            {recommendations.map((course) => (
              <li key={course.id}>
                <Link
                  href={course.href}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 transition-colors duration-(--duration-base) hover:bg-success/10"
                >
                  <span className="text-sm font-medium">{course.title}</span>
                  <span className="text-xs text-muted-foreground">{course.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
