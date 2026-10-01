"use client";

// Stop or resume course announcements for one learner (ADR-171 #5).
//
// Staff can stop announcements to an address, and can resume only a stop that
// STAFF made. A learner's own unsubscribe is their decision: there is no
// button to undo it, and the service refuses if one is forged.
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { setAnnouncementSuppressionAction } from "../../_actions/announcement-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export type SuppressionState = "none" | "UNSUBSCRIBED" | "ADMIN" | "BOUNCE" | "COMPLAINT";

export function AnnouncementSuppression({
  email,
  state,
  canChange,
}: {
  email: string;
  state: SuppressionState;
  canChange: boolean;
}) {
  const t = useTranslations("admin.announcements.suppression");
  const { run, pending } = useServerAction();

  function change(suppressed: boolean) {
    run(async () => {
      const result = await setAnnouncementSuppressionAction({ email, suppressed });
      if (!result.ok) toast.error(t("failed"));
      else toast.success(suppressed ? t("stopped") : t("resumed"));
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{t(`states.${state}`)}</span>
      {canChange && state === "none" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() => change(true)}
        >
          {t("stop")}
        </Button>
      )}
      {canChange && state === "ADMIN" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() => change(false)}
        >
          {t("resume")}
        </Button>
      )}
    </span>
  );
}
