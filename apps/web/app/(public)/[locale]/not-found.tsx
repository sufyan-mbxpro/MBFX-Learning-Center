import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { EmptyState } from "@repo/ui/components/empty";

// The public 404 (changes-21 Phase A): the one EmptyState, sized `lg`, with its
// title as the h1. It owns the <main> landmark: the [locale] layout renders
// none of its own.
export default function PublicNotFound() {
  const t = useTranslations("notFound");
  return (
    <main>
      <Container>
        <EmptyState
          size="lg"
          titleAs="h1"
          icon={<SearchX aria-hidden />}
          title={t("title")}
          description={t("description")}
          action={<Button render={<Link href="/" />}>{t("backHome")}</Button>}
        />
      </Container>
    </main>
  );
}
