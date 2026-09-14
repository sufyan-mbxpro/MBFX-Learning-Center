"use client";

// The categories list's one page-level control (changes-22).
//
// It lives beside the table rather than inside it because `AdminPage` renders
// screen actions in its header (`actions` slot), the same place
// `NewTopicButton` sits on the glossary topics screen. It opens the SAME
// `CategoryDialog` the table's Edit opens — create and update are one action
// (`saveVideoCategory`), so they are one form.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { CategoryDialog } from "./category-dialog.tsx";

export function NewCategoryButton({ locale }: { locale: string }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden data-icon="inline-start" />
        {t("videoCategoryManager.create")}
      </Button>
      <CategoryDialog open={open} onOpenChange={setOpen} target={null} locale={locale} />
    </>
  );
}
