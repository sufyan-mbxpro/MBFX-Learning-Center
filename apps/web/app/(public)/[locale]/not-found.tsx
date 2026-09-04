import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";

export default function PublicNotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <Link href="/" className="text-sm underline underline-offset-4">
        {t("backHome")}
      </Link>
    </main>
  );
}
