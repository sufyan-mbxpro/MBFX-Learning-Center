"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { ErrorState } from "@repo/ui/components/empty";

// The public error boundary (changes-21 Phase A). It was a bare heading and an
// underlined text button; it is now the one ErrorState every surface uses,
// sized `lg` because the state IS the page — so its title is the h1. It owns
// the <main> landmark: the [locale] layout renders none of its own.
//
// `retry`, never `reset` (changes-21 F-06): `reset` re-renders the segment
// WITHOUT re-fetching, so a server-side failure fails again the same way.
// `retry` re-fetches then re-renders; stable since Next 16.3.
export default function PublicError({ retry }: { error: Error; retry: () => void }) {
  const t = useTranslations("error");
  return (
    <main>
      <Container>
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
      </Container>
    </main>
  );
}
