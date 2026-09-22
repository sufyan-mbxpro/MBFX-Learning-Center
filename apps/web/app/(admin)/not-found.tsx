import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty";

// Renders inside the admin shell's <main>, so no second <main> — a nested
// landmark. The state is the page, so its title is the h1.
export default async function AdminNotFound() {
  const [t, tAdmin] = await Promise.all([getTranslations("notFound"), getTranslations("admin")]);
  return (
    <EmptyState
      size="lg"
      titleAs="h1"
      icon={<SearchX aria-hidden />}
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outline" render={<Link href="/keystone/dashboard" />}>
          {tAdmin("dashboard")}
        </Button>
      }
    />
  );
}
