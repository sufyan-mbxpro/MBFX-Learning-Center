"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { ErrorState } from "@repo/ui/components/empty";

// The public error boundary (changes-21 Phase A). It was a bare heading and an
// underlined text button; it is now the one ErrorState every surface uses,
// sized `lg` because the state IS the page — so its title is the h1. It owns
// the <main> landmark: the [locale] layout renders none of its own.
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
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
            <Button variant="outline" onClick={reset}>
              {t("retry")}
            </Button>
          }
        />
      </Container>
    </main>
  );
}
