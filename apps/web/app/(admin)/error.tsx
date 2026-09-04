"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";

// Renders inside the admin shell's <main>, so a plain div — a second <main>
// here would nest landmarks.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <Empty className="w-full max-w-md border-none">
        <EmptyMedia>
          <AlertTriangle aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-lg">{t("title")}</EmptyTitle>
        <EmptyContent>
          <Button variant="outline" onClick={reset}>
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
