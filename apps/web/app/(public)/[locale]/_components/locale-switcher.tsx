"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

export interface SwitcherLocale {
  code: string;
  nativeName: string;
  flagEmoji: string | null;
}

/** Only ACTIVE locales are offered (the dynamic half of routing.ts's static/dynamic trade-off) — the server passes them in. */
export function LocaleSwitcher({ locales }: { locales: SwitcherLocale[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const current = useLocale();

  if (locales.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("chooseLanguage")}>
            <Languages data-icon="inline-start" aria-hidden />
            {locales.find((l) => l.code === current)?.nativeName ?? current}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            render={
              <Link href={pathname} locale={locale.code}>
                {locale.flagEmoji ? `${locale.flagEmoji} ` : ""}
                {locale.nativeName}
              </Link>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
