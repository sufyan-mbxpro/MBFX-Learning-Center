"use client";

// "New email" (ADR-172): the section sends two kinds of broadcast, so its one
// primary action asks which — a custom email written here, or a course
// announcement built from the course template. Each item says what it is,
// because "announcement" alone does not tell a new admin which to pick.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, GraduationCap, PenLine, Plus } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

export function NewEmailMenu() {
  const t = useTranslations("admin.announcements");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button>
            <Plus aria-hidden data-icon="inline-start" />
            {t("newMenu")}
            <ChevronDown aria-hidden data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem render={<Link href="/keystone/announcements/new?kind=custom" />}>
          <PenLine aria-hidden data-icon="inline-start" />
          <span className="flex flex-col">
            <span className="font-medium">{t("newCustom")}</span>
            <span className="text-xs text-muted-foreground">{t("newCustomHint")}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/keystone/announcements/new" />}>
          <GraduationCap aria-hidden data-icon="inline-start" />
          <span className="flex flex-col">
            <span className="font-medium">{t("newCourse")}</span>
            <span className="text-xs text-muted-foreground">{t("newCourseHint")}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
