"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { ErrorState } from "@repo/ui/components/empty";

// Renders inside the admin shell's <main>, so no second <main> — a nested
// landmark. The state is the page, so its title is the h1 (changes-21
// Phase A: one ErrorState, sized `lg` for a route boundary).
//
// `retry`, never `reset` (changes-21 F-06): `reset` re-renders the segment
// WITHOUT re-fetching, so a server-side failure fails again the same way.
// `retry` re-fetches then re-renders; stable since Next 16.3.
export default function AdminError({ retry }: { error: Error; retry: () => void }) {
  const t = useTranslations("error");
  return (
    <ErrorState
      size="lg"
      titleAs="h1"
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outline" onClick={retry}>
          {t("retry")}
        </Button>
      }
    />
  );
}
