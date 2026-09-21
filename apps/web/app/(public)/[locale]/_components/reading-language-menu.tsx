"use client";

// The "read this in" dropdown on a detail page (ADR-127).
//
// Deliberately generic: the page works out every option's destination on the
// server, so articles today and courses, lessons, videos and glossary terms
// later pass options in and nothing here knows what kind of item it is.
//
// Not the header's `LocaleSwitcher`. That one changes the INTERFACE locale and
// lists only served locales, which is `en` alone (ADR-091); this one changes
// the item's own words and lists every language a human has translated it into.
import { Check, ChevronDown, Languages } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

export interface ReadingLanguageOption {
  code: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  /** Locale-less path, the way `Link` expects it. */
  href: string;
  /**
   * Set when the language is a SERVED locale, so the link lands on that
   * locale's own page rather than a `?lang=` view inside this one.
   */
  locale?: string;
  current: boolean;
}

export function ReadingLanguageMenu({
  options,
  label,
}: {
  options: ReadingLanguageOption[];
  label: string;
}) {
  // ABSENT, not disabled: one language is no choice.
  if (options.length < 2) return null;
  const current = options.find((option) => option.current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" aria-label={label}>
            <Languages data-icon="inline-start" aria-hidden />
            <span lang={current?.code} dir={current?.direction}>
              {current?.nativeName ?? label}
            </span>
            <ChevronDown data-icon="inline-end" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.code}
            render={
              <Link
                href={option.href}
                {...(option.locale ? { locale: option.locale } : {})}
                aria-current={option.current ? "true" : undefined}
                scroll={false}
              />
            }
          >
            <span lang={option.code} dir={option.direction} className="flex-1">
              {option.nativeName}
            </span>
            {option.current && <Check aria-hidden className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
