"use client";

import { useTranslations } from "next-intl";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        {t("retry")}
      </button>
    </main>
  );
}
