"use client";

// The course page's three progress consumers (PR 5.3).
//
// They are one file because they are one feature and they share a set of
// catalog keys; they are three components because they render in three places
// the layout keeps far apart.
//
// Every one of them renders something meaningful in EVERY status, including
// `loading` and `guest`. That is the rule that makes the island honest: the
// server has already painted a complete, correct, not-started page, so a
// consumer that returned `null` until its fetch resolved would remove content
// that was already on screen and shift the layout — the exact cost ADR-056
// accepted the island in order to avoid.
import { CircleCheckBig, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { ProgressBar } from "@repo/ui/components/progress-bar";
import { useProgress } from "./progress-provider.tsx";

/**
 * `lessonsTotal` comes from the page, not from the fetch: it is public,
 * cached, and already correct at first paint. Taking it from the response
 * would render "0 of 0" for a beat and then resize the row.
 */
export function CourseProgressBar({ lessonsTotal }: { lessonsTotal: number }) {
  const t = useTranslations("learn");
  const { view, status } = useProgress();

  const done = status === "ready" ? (view?.lessonsCompleted ?? 0) : 0;
  const total = view?.lessonsTotal ?? lessonsTotal;
  const percent = total <= 0 ? 0 : Math.min(100, Math.round((done / total) * 100));

  return (
    <div className="flex flex-col gap-2">
      <ProgressBar
        value={done}
        total={total}
        label={t("course.progressLabel")}
        countLabel={t("course.progressCount", { done, total })}
        percentLabel={t("course.progressPercent", { percent })}
      />
      {view?.isCompleted && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success-interactive">
          <CircleCheckBig aria-hidden className="size-4" />
          {t("progress.courseCompleted")}
        </p>
      )}
    </div>
  );
}

/**
 * "Start the first lesson" until the learner has one to come back to, then
 * "Continue learning", then "Review the course" once it is finished.
 *
 * `lessonHrefs` is the id→href map the page already built for the curriculum,
 * passed in rather than resolved here: the API deliberately returns no slugs
 * (a per-learner response carrying content would be content in an uncacheable
 * payload), and the page has every href in hand.
 */
export function CourseStartCta({
  firstLessonHref,
  lessonHrefs,
}: {
  firstLessonHref: string | null;
  lessonHrefs: Record<string, string>;
}) {
  const t = useTranslations("learn");
  const { view, status } = useProgress();

  const resumeHref =
    status === "ready" && view?.lastLessonId ? lessonHrefs[view.lastLessonId] : undefined;
  const href = resumeHref ?? firstLessonHref;
  if (!href) return null;

  const label = !resumeHref
    ? t("course.startCourse")
    : view?.isCompleted
      ? t("progress.review")
      : t("progress.continue");

  return (
    <Button size="lg" className="w-full" render={<Link href={href} />}>
      {label}
    </Button>
  );
}

/**
 * ADR-056 #3's one inline card. Shown only to a reader the API answered 401
 * for — never while the request is in flight (it would flash for everyone) and
 * never when the feature is off (`off`), because inviting someone to sign in
 * for something switched off is a promise we cannot keep.
 */
export function ProgressSignInCard({ className }: { className?: string }) {
  const t = useTranslations("learn");
  const { status } = useProgress();
  if (status !== "guest") return null;

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <LogIn aria-hidden className="size-4 text-primary-interactive" />
          {t("progress.signInTitle")}
        </p>
        <p className="text-sm text-muted-foreground">{t("progress.signInBody")}</p>
        <div>
          <Button size="sm" variant="outline" render={<Link href={ROUTE_PATHS["sign-in"]} />}>
            {t("progress.signInAction")}
          </Button>
        </div>
      </div>
    </div>
  );
}
