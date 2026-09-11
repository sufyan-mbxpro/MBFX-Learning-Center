"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { ErrorState } from "@repo/ui/components/empty";

// Renders inside the admin shell's <main>, so no second <main> — a nested
// landmark. The state is the page, so its title is the h1 (changes-21
// Phase A: one ErrorState, sized `lg` for a route boundary).
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <ErrorState
      size="lg"
      titleAs="h1"
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outline" onClick={reset}>
          {t("retry")}
        </Button>
      }
    />
  );
}
