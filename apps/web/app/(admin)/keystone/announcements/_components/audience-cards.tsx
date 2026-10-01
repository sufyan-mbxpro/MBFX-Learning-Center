"use client";

// The Audience step's cards (ADR-171 #6, changes-54 §10.3), shared by the
// course announcement editor and the custom email composer (ADR-172 #1): the
// same cards, the same live counts and the same two pickers, so "the groups we
// already select users by" are one component and cannot drift apart.
//
// Which cards appear is the caller's: `audiencesForKind()` decides the set, and
// the caller drops the ones the viewer lacks a second key for (Select users
// needs `users.view`, Staff needs `employees.view`).
import { useTranslations } from "next-intl";
import {
  Briefcase,
  Clock,
  GraduationCap,
  Mail,
  MailCheck,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  MAX_AUDIENCE_COURSES,
  MAX_AUDIENCE_USERS,
  type AnnouncementAudienceKey,
} from "@repo/contracts";
import type { AnnouncementUserOption, AudienceSummary } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { Field } from "../../_components/editor/editor-section.tsx";
import { CourseMultiPicker, type CourseChip } from "./course-picker.tsx";
import { UserPickerField } from "./user-picker-field.tsx";

const AUDIENCE_ICONS: Record<AnnouncementAudienceKey, LucideIcon> = {
  all_learners: Users,
  active: UserCheck,
  verified: MailCheck,
  inactive: Clock,
  subscribers: Mail,
  course_learners: GraduationCap,
  custom: UserPlus,
  staff: Briefcase,
};

export interface AudienceCardsProps {
  cards: readonly AnnouncementAudienceKey[];
  keys: AnnouncementAudienceKey[];
  onToggle: (key: AnnouncementAudienceKey) => void;
  summary: AudienceSummary | null;
  courses: CourseChip[];
  onCoursesChange: (courses: CourseChip[]) => void;
  users: AnnouncementUserOption[];
  onUsersChange: (users: AnnouncementUserOption[]) => void;
  errors: {
    keys?: string | undefined;
    courseIds?: string | undefined;
    userIds?: string | undefined;
  };
}

export function AudienceCards(props: AudienceCardsProps) {
  const t = useTranslations("admin.announcements");
  return (
    <>
      <div
        role="group"
        aria-label={t("audienceTitle")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {props.cards.map((key) => {
          const Icon = AUDIENCE_ICONS[key];
          const selected = props.keys.includes(key);
          const count = props.summary?.cards[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => props.onToggle(key)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-muted/60",
                selected && "border-primary ring-1 ring-primary",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t(`audiences.${key}.label`)}</span>
                  {count !== undefined && (
                    <Badge variant="outline" className="tabular-nums">
                      {count}
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`audiences.${key}.description`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {props.errors.keys && (
        <p className="text-sm text-destructive-interactive">{props.errors.keys}</p>
      )}

      {props.keys.includes("course_learners") && (
        <Field label={t("audiences.course_learners.label")} required error={props.errors.courseIds}>
          <CourseMultiPicker
            value={props.courses}
            onChange={props.onCoursesChange}
            max={MAX_AUDIENCE_COURSES}
          />
        </Field>
      )}
      {props.keys.includes("custom") && props.cards.includes("custom") && (
        <Field label={t("audiences.custom.label")} required error={props.errors.userIds}>
          <UserPickerField
            value={props.users}
            onChange={props.onUsersChange}
            max={MAX_AUDIENCE_USERS}
          />
        </Field>
      )}
    </>
  );
}
