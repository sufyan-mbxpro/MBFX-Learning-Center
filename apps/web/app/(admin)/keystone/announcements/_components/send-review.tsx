"use client";

// Pieces both campaign editors share (changes-59): the INBOX PREVIEW — what a
// recipient's message list shows before they open anything — and the
// PRE-SEND CHECKLIST, one row per thing that has to be right, each with its
// state and, where it can be fixed elsewhere, a link to fix it.
//
// The checklist reports; it decides nothing. The server's own refusals
// (`blockers`) still gate Send, and the editors list them under these rows
// exactly as before.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

/** Up to two initials, for the sender's avatar circle. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function InboxPreview({
  fromName,
  subject,
  preheader,
}: {
  fromName: string;
  subject: string;
  preheader: string;
}) {
  const t = useTranslations("admin.announcements.inbox");
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
          {/* A circle by geometry (ADR-107): an avatar. */}
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
          >
            {initials(fromName) || "?"}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{fromName || t("noSender")}</span>
            <span className={cn("truncate text-sm", !subject && "text-muted-foreground")}>
              {subject || t("noSubject")}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {preheader || t("noPreheader")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface ChecklistItem {
  key: string;
  /** `pending` is neither passed nor failed yet (an untested custom email). */
  state: "ok" | "failed" | "pending";
  title: string;
  detail: string;
  fixHref?: string | undefined;
}

const ICON = {
  ok: { Icon: CircleCheck, className: "text-success-interactive" },
  failed: { Icon: CircleX, className: "text-destructive-interactive" },
  pending: { Icon: CircleAlert, className: "text-warning-interactive" },
} as const;

export function PreSendChecklist({
  items,
  children,
}: {
  items: ChecklistItem[];
  /** The server's refusals, rendered under the rows. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.announcements");
  const router = useRouter();
  const passed = items.filter((item) => item.state === "ok").length;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold">{t("checklistTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("checklistProgress", { passed, total: items.length })}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.refresh()}>
          <RefreshCw aria-hidden data-icon="inline-start" />
          {t("recheck")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((item) => {
            const { Icon, className } = ICON[item.state];
            return (
              <li key={item.key} className="flex items-start gap-3 p-3">
                <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", className)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-sm break-words text-muted-foreground">{item.detail}</span>
                </div>
                {item.state !== "ok" && item.fixHref && (
                  <Link
                    href={item.fixHref}
                    className="shrink-0 text-sm font-medium text-primary-interactive underline-offset-4 hover:underline"
                  >
                    {t("fixIt")}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {children}
      </CardContent>
    </Card>
  );
}
