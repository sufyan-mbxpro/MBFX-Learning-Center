"use client";

// Public-surface wrapper for the shared toggle (ADR-008: user-controlled
// mode) — binds the label from the public nav catalog; the shared
// component itself carries no i18n (@repo/ui rule).
import { useTranslations } from "next-intl";
import { ModeToggle as SharedModeToggle } from "@repo/ui/components/mode-toggle";

export function ModeToggle() {
  const t = useTranslations("nav");
  return <SharedModeToggle label={t("toggleTheme")} />;
}
