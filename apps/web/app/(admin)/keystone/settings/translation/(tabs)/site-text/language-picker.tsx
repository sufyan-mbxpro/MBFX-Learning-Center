"use client";

// The Site text tab's language: an address (`?locale=`), not client state, so
// a review row can link straight to one language and a reload keeps it.
import { usePathname, useRouter } from "next/navigation";
import { AdminCombobox } from "../../../../_components/combobox.tsx";

export function SiteTextLanguagePicker({
  value,
  options,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <AdminCombobox
      options={options}
      value={value}
      onValueChange={(locale) => router.push(`${pathname}?locale=${encodeURIComponent(locale)}`)}
      aria-label={label}
      className="w-56"
    />
  );
}
