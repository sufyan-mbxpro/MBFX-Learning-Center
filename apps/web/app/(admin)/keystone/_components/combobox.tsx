"use client";

// The admin surface's dropdown (ADR-057). Admin screens import THIS, not
// `@repo/ui/components/select` — a lint rule in tooling/eslint-config makes
// that structural rather than a habit.
//
// It exists only to supply the two strings @repo/ui cannot own: the search
// placeholder and the empty state. Packages carry no catalogs
// (code-style.md #2), and threading a `searchPlaceholder`/`emptyLabel` pair
// through 46 call sites — most of which receive their labels as props from a
// server component — would put the same two keys in twenty `labels` objects.
// The admin root layout already mounts NextIntlClientProvider, so one
// `useTranslations` here covers every screen.
//
// Everything else is @repo/ui's Combobox: searchable at or above
// SEARCHABLE_ITEM_THRESHOLD options, full width unless the call site passes
// its own `w-*`, popup no narrower than the trigger.
import { useTranslations } from "next-intl";

import { Combobox, type ComboboxProps } from "@repo/ui/components/combobox";

export type { ComboboxOption } from "@repo/ui/components/combobox";

export function AdminCombobox({ searchPlaceholder, emptyLabel, ...props }: ComboboxProps) {
  const t = useTranslations("admin");
  return (
    <Combobox
      searchPlaceholder={searchPlaceholder ?? t("comboboxSearch")}
      emptyLabel={emptyLabel ?? t("comboboxEmpty")}
      {...props}
    />
  );
}
