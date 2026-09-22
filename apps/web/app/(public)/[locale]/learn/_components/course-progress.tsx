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
import { CircleCheckBig, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
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
 * "Sign in or join us to save your progress" (changes-42) — the guest prompt
 * the quiz listing and the quiz runner share, so both offer the same two
 * doors. The course sidebar's copy was removed at the owner's request
 * (2026-09-22); the "Track your progress" band above the curriculum is the
 * course page's one guest prompt.
 *
 * Sign-in carries `?redirect=` back to THIS page (the sign-in form's own
 * open-redirect guard accepts same-origin paths only), so a reader who signs in
 * mid-lesson lands on the lesson rather than on the home page. `next/navigation`'s
 * pathname, not `@repo/i18n`'s: the form `location.assign`s the value as-is, so
 * it must keep its locale prefix.
 */
export function SaveProgressPrompt({ title, body }: { title: string; body: string }) {
  const t = useTranslations("learn");
  const pathname = usePathname();
  const signInHref = pathname
    ? `${ROUTE_PATHS["sign-in"]}?${new URLSearchParams({ redirect: pathname }).toString()}`
    : ROUTE_PATHS["sign-in"];

  // A container query, not `md:`: the same prompt sits full width on the quiz
  // index and inside the lesson page's narrow rail, and whether the buttons fit
  // beside the text is a question about THIS box, not the viewport.
  return (
    <div className="@container rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
            <LogIn aria-hidden className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        <LockedProgressTrack />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" render={<Link href={signInHref} />}>
            <LogIn data-icon="inline-start" aria-hidden />
            {t("progress.signInAction")}
          </Button>
          <Button size="sm" variant="outline" render={<Link href={ROUTE_PATHS["sign-up"]} />}>
            <UserPlus data-icon="inline-start" aria-hidden />
            {t("progress.joinAction")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A picture of the progress a guest is not keeping: a track with a padlock
 * where the knob would be. Decorative, so `aria-hidden` — the title beside it
 * already says it in words — and deliberately NOT `ProgressBar`, whose
 * role="progressbar" would announce a value that measures nothing.
 */
function LockedProgressTrack() {
  return (
    <div aria-hidden className="relative flex h-8 w-full max-w-48 shrink-0 items-center">
      <div className="h-2.5 w-full rounded-full bg-muted">
        <div className="h-full w-1/4 rounded-full bg-muted-foreground/40" />
      </div>
      <span className="absolute start-1/3 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm rtl:translate-x-1/2">
        <LockKeyhole className="size-4" />
      </span>
    </div>
  );
}
