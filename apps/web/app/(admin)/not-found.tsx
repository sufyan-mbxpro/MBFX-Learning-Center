import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";

// Renders inside the admin shell's <main>, so a plain div — a second <main>
// here would nest landmarks.
export default async function AdminNotFound() {
  const [t, tAdmin] = await Promise.all([getTranslations("notFound"), getTranslations("admin")]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <Empty className="w-full max-w-md border-none">
        <EmptyMedia>
          <SearchX aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-lg">{t("title")}</EmptyTitle>
        <EmptyContent>
          <Button variant="outline" render={<Link href="/admin" />}>
            {tAdmin("dashboard")}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
