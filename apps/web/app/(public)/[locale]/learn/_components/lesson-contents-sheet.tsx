"use client";

// The lesson page's curriculum, as a mobile Sheet (changes-11 §9.3).
//
// Below `md` the sidebar becomes a "Contents" button that opens this. The
// SAME `CurriculumList` renders in both places rather than a second mobile
// list, so a lesson's state marker, its external badge and its reading time
// cannot disagree between the two.
//
// Client for the Sheet's open state, and — since PR 5.3 — for the progress
// markers: the list inside is `CurriculumWithProgress`, which reads the same
// context the desktop sidebar does, so the two cannot disagree about which
// lessons are done.
//
// It resolves its own strings rather than taking them as props. A `labels`
// object threaded from the page was the shape before, and it is the shape that
// broke `GlossaryBrowser` at runtime; `useTranslations` is the convention on
// this surface now.
import { useState } from "react";
import { ListTree } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";
import type { CurriculumSection } from "@repo/ui/components/curriculum-list";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { CurriculumWithProgress } from "./curriculum-with-progress.tsx";

export function LessonContentsSheet({
  sections,
  defaultOpenSectionIds,
}: {
  sections: CurriculumSection[];
  defaultOpenSectionIds?: string[];
}) {
  const t = useTranslations("learn");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="md:hidden" onClick={() => setOpen(true)}>
        <ListTree data-icon="inline-start" aria-hidden />
        {t("lesson.contents")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="start" closeLabel={t("lesson.close")} className="w-[min(22rem,90vw)]">
          <SheetHeader>
            <SheetTitle>{t("lesson.contentsAria")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CurriculumWithProgress
              sections={sections}
              defaultOpenSectionIds={defaultOpenSectionIds}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
