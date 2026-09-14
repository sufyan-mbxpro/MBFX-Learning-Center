"use client";

// The public side's dropdown.
//
// **Not `AdminCombobox`** — that one is lint-forbidden outside `app/(admin)/**`
// and reaches for the `admin` catalog namespace, which a public page must not.
// This is the same `@repo/ui` Combobox (ADR-057: searchable at or above eight
// options, a plain Select below), with the public `tools` namespace supplying
// the two strings it needs.
import { useTranslations } from "next-intl";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";

export function ToolCombobox({
  value,
  onValueChange,
  options,
  ...props
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  "aria-label"?: string;
  className?: string;
}) {
  const t = useTranslations("tools");
  return (
    <Combobox
      value={value}
      onValueChange={onValueChange}
      options={options}
      searchPlaceholder={t("common.search")}
      emptyLabel={t("common.noMatches")}
      {...props}
    />
  );
}
