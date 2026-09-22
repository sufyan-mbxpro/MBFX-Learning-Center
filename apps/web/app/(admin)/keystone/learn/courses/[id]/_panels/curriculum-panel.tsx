"use client";

// The curriculum tree (changes-11 PR 3.3).
//
// KEYBOARD MOVE CONTROLS ONLY, deliberately. Plan §8.2 requires that
// keyboard-accessible move-up/move-down ships FIRST and that drag-and-drop is
// layered on top — "DnD without a keyboard equivalent does not ship". The
// repository has no DnD library today (checked before writing this), and
// adding one is a dependency change security.md #15 says not to make casually,
// so the pointer affordance is left for a later PR that can review it on its
// own merits. Nothing here has to change to accept it: every reorder already
// goes through `reorderSectionsAction` / `reorderLessonsAction` / `moveLesson`,
// which is exactly what a drag handle would call.
//
// Unlike the Details tab, this panel does NOT hold a draft. Each control is its
// own committed mutation followed by a refresh, because a curriculum edit is a
// structural change other people's screens must see — and because an unsaved
// tree that has already renumbered `sortOrder` in the reader's head is the
// worst kind of stale.
import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  ListTree,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { createLessonSchema, sectionInputSchema, type SectionInput } from "@repo/contracts";
import {
  createLessonAction,
  createSectionAction,
  deleteSectionAction,
  moveLessonAction,
  reorderLessonsAction,
  reorderSectionsAction,
  saveSectionAction,
  setLessonDeletedAction,
} from "../../../../_actions/learn-actions.ts";
import { EditorSection } from "../../../../_components/editor/editor-section.tsx";
import {
  CONTENT_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../../_components/status-badge.tsx";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";

// `createSectionAction` parses its title with exactly the section title's rule
// (trim, 1–255); picking it from the contract keeps the two from drifting.
const newSectionSchema = sectionInputSchema.shape.translation.pick({ title: true });

export interface CurriculumLessonView {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  hasBody: boolean;
  hasVideo: boolean;
  hasExternal: boolean;
  attachmentCount: number;
}

export interface CurriculumSectionView {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
  lessons: CurriculumLessonView[];
}

export interface CurriculumLabels {
  section: string;
  sectionDescription: string;
  addSection: string;
  addLesson: string;
  sectionTitleLabel: string;
  sectionDescriptionLabel: string;
  sectionPublishedLabel: string;
  saveSection: string;
  editSection: string;
  editSectionDescription: string;
  emptyTitle: string;
  emptyBody: string;
  emptyLessons: string;
  moveUp: string;
  moveDown: string;
  moveToSection: string;
  reorderHint: string;
  lessonsSuffix: string;
  sectionHidden: string;
  minutesLabel: string;
  untitled: string;
  edit: string;
  softDelete: string;
  confirmDeleteSectionTitle: string;
  confirmDeleteSectionBody: string;
  confirmDeleteLessonTitle: string;
  confirmDeleteLessonBody: string;
  confirm: string;
  cancel: string;
  close: string;
  create: string;
  newLessonTitle: string;
  requiredBadge: string;
  optionalBadge: string;
  kindReading: string;
  kindVideo: string;
  kindExternal: string;
  kindDownload: string;
}

/** Swap two entries and return the new id order — the whole of "move up". */
function swapped(ids: string[], index: number, delta: number): string[] | null {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  const a = next[index];
  const b = next[target];
  if (a === undefined || b === undefined) return null;
  next[index] = b;
  next[target] = a;
  return next;
}

function SectionDialog({
  open,
  onOpenChange,
  section,
  locale,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: CurriculumSectionView;
  locale: string;
  labels: CurriculumLabels;
}) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description);
  const [isPublished, setIsPublished] = useState(section.isPublished);
  const { run, pending } = useServerAction();

  const payload: SectionInput = {
    sectionId: section.id,
    isPublished,
    translation: {
      locale,
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
    },
  };
  const form = useFieldErrors(sectionInputSchema, payload);

  const close = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.editSection}</DialogTitle>
          <DialogDescription>{labels.editSectionDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("translation.title")} required>
            <FieldLabel>{labels.sectionTitleLabel}</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
            <FieldError>{form.error("translation.title")}</FieldError>
          </Field>
          <Field invalid={form.invalid("translation.description")}>
            <FieldLabel>{labels.sectionDescriptionLabel}</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <FieldError>{form.error("translation.description")}</FieldError>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              checked={isPublished}
              onCheckedChange={(checked) => setIsPublished(checked === true)}
            />
            <FieldLabel className="font-normal">{labels.sectionPublishedLabel}</FieldLabel>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled while fields are wrong: pressing it names them (audit F-07). */}
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              if (!form.validate()) return;
              run(() => saveSectionAction(payload), { onDone: close });
            }}
          >
            {labels.saveSection}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface SectionOption {
  id: string;
  title: string;
  /** Where an incoming lesson lands: the end of this section. */
  lessonCount: number;
}

function LessonRow({
  lesson,
  sectionId,
  sectionOptions,
  siblingIds,
  index,
  canUpdate,
  canDelete,
  labels,
}: {
  lesson: CurriculumLessonView;
  sectionId: string;
  sectionOptions: SectionOption[];
  siblingIds: string[];
  index: number;
  canUpdate: boolean;
  canDelete: boolean;
  labels: CurriculumLabels;
}) {
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const move = (delta: number) => {
    const next = swapped(siblingIds, index, delta);
    if (!next) return;
    run(() => reorderLessonsAction({ sectionId, lessonIds: next }));
  };

  // Derived, never stored (ADR-055 #4): what a lesson IS follows from which
  // capabilities it carries, so more than one badge is correct.
  const kinds = [
    ...(lesson.hasBody ? [{ key: "reading", label: labels.kindReading, Icon: FileText }] : []),
    ...(lesson.hasVideo ? [{ key: "video", label: labels.kindVideo, Icon: Video }] : []),
    ...(lesson.attachmentCount > 0
      ? [{ key: "download", label: labels.kindDownload, Icon: Paperclip }]
      : []),
    ...(lesson.hasExternal
      ? [{ key: "external", label: labels.kindExternal, Icon: undefined }]
      : []),
  ];

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/keystone/learn/lessons/${lesson.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {lesson.title || labels.untitled}
        </Link>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {kinds.map(({ key, label }) => (
            <Badge key={key} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
          {!lesson.isRequired && (
            <Badge variant="secondary" className="text-xs">
              {labels.optionalBadge}
            </Badge>
          )}
          {lesson.estimatedMinutes !== null && (
            <span className="tabular-nums">
              {lesson.estimatedMinutes} {labels.minutesLabel}
            </span>
          )}
        </span>
      </div>

      <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, lesson.status)}>
        {lesson.statusLabel}
      </StatusBadge>

      {canUpdate && (
        <>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveUp}
              disabled={pending || index === 0}
              onClick={() => move(-1)}
            >
              <ChevronUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveDown}
              disabled={pending || index === siblingIds.length - 1}
              onClick={() => move(1)}
            >
              <ChevronDown aria-hidden />
            </Button>
          </div>

          {sectionOptions.length > 1 && (
            <AdminCombobox
              aria-label={labels.moveToSection}
              size="sm"
              className="w-40"
              value={sectionId}
              options={sectionOptions.map((option) => ({
                value: option.id,
                label: option.title || labels.untitled,
              }))}
              onValueChange={(v) => {
                const target = sectionOptions.find((option) => option.id === v);
                if (!target || target.id === sectionId) return;
                // Appended to the END of the destination. moveLesson takes an
                // index, and the honest one for a lesson arriving from
                // elsewhere is last — not wherever it happened to sit in the
                // section it left.
                run(() =>
                  moveLessonAction({
                    lessonId: lesson.id,
                    toSectionId: target.id,
                    index: target.lessonCount,
                  }),
                );
              }}
            />
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={labels.edit}
        render={<Link href={`/keystone/learn/lessons/${lesson.id}`} />}
      >
        <Pencil aria-hidden />
      </Button>

      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={labels.softDelete}
          className="text-destructive-interactive"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 aria-hidden />
        </Button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteLessonTitle}
        description={labels.confirmDeleteLessonBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => setLessonDeletedAction(lesson.id, true))}
      />
    </li>
  );
}

function SectionCard({
  section,
  index,
  courseId,
  sectionIds,
  sectionOptions,
  locale,
  canUpdate,
  canCreateLesson,
  canDeleteLesson,
  labels,
}: {
  section: CurriculumSectionView;
  index: number;
  courseId: string;
  sectionIds: string[];
  sectionOptions: SectionOption[];
  locale: string;
  canUpdate: boolean;
  canCreateLesson: boolean;
  canDeleteLesson: boolean;
  labels: CurriculumLabels;
}) {
  const { run, pending } = useServerAction();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newLesson, setNewLesson] = useState("");
  const [adding, setAdding] = useState(false);
  const newLessonInput = { sectionId: section.id, title: newLesson.trim() };
  const lessonForm = useFieldErrors(createLessonSchema, newLessonInput);

  const stopAdding = () => {
    setAdding(false);
    lessonForm.reset();
  };

  const move = (delta: number) => {
    const next = swapped(sectionIds, index, delta);
    if (!next) return;
    // The action takes the course id explicitly so `reorderSections` can
    // scope its updates with `updateMany ... where courseId`, which is what
    // stops a stale id from another course being reordered into this one.
    run(() => reorderSectionsAction({ courseId, sectionIds: next }));
  };

  const lessonIds = section.lessons.map((lesson) => lesson.id);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{section.title || labels.untitled}</h3>
            <Badge variant={section.isPublished ? "outline" : "secondary"} className="text-xs">
              {section.lessons.length} {labels.lessonsSuffix}
            </Badge>
            {/* Said out loud, not implied by a badge variant (changes-22).
                A section that is not published hides every lesson under it
                from the public curriculum however published those lessons
                are, and the only sign of it used to be `secondary` instead
                of `outline` on the badge beside it — which nobody read as
                "none of this is live". */}
            {!section.isPublished && (
              <Badge variant="warning" className="text-xs">
                {labels.sectionHidden}
              </Badge>
            )}
          </div>
          {section.description && (
            <p className="text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>

        {canUpdate && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveUp}
              disabled={pending || index === 0}
              onClick={() => move(-1)}
            >
              <ChevronUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.moveDown}
              disabled={pending || index === sectionIds.length - 1}
              onClick={() => move(1)}
            >
              <ChevronDown aria-hidden />
            </Button>
            <Button variant="outline" size="xs" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" aria-hidden />
              {labels.edit}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.softDelete}
              className="text-destructive-interactive"
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {section.lessons.length === 0 ? (
        <p className="text-xs text-muted-foreground">{labels.emptyLessons}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {section.lessons.map((lesson, lessonIndex) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              sectionId={section.id}
              sectionOptions={sectionOptions}
              siblingIds={lessonIds}
              index={lessonIndex}
              canUpdate={canUpdate}
              canDelete={canDeleteLesson}
              labels={labels}
            />
          ))}
        </ul>
      )}

      {canCreateLesson &&
        (adding ? (
          <div className="flex flex-wrap items-end gap-2">
            {/* `w-auto` undoes the Field's full width so the buttons share the row. */}
            <Field
              invalid={lessonForm.invalid("title")}
              required
              className="w-auto min-w-56 flex-1"
            >
              <FieldLabel>{labels.newLessonTitle}</FieldLabel>
              <Input
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                maxLength={255}
              />
              <FieldError>{lessonForm.error("title")}</FieldError>
            </Field>
            <Button
              size="sm"
              loading={pending}
              onClick={() => {
                if (!lessonForm.validate()) return;
                run(() => createLessonAction(newLessonInput), {
                  onDone: () => {
                    setNewLesson("");
                    stopAdding();
                  },
                });
              }}
            >
              {labels.create}
            </Button>
            <Button variant="ghost" size="sm" onClick={stopAdding} disabled={pending}>
              {labels.cancel}
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="outline" size="xs" onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" aria-hidden />
              {labels.addLesson}
            </Button>
          </div>
        ))}

      <SectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        section={section}
        locale={locale}
        labels={labels}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={labels.confirmDeleteSectionTitle}
        description={labels.confirmDeleteSectionBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => deleteSectionAction(section.id))}
      />
    </div>
  );
}

export function CurriculumPanel({
  courseId,
  sections,
  locale,
  canUpdate,
  canCreateLesson,
  canDeleteLesson,
  labels,
}: {
  courseId: string;
  sections: CurriculumSectionView[];
  locale: string;
  canUpdate: boolean;
  canCreateLesson: boolean;
  canDeleteLesson: boolean;
  labels: CurriculumLabels;
}) {
  const { run, pending } = useServerAction();
  const [newSection, setNewSection] = useState("");
  const [adding, setAdding] = useState(false);
  const sectionForm = useFieldErrors(newSectionSchema, { title: newSection });

  const stopAdding = () => {
    setAdding(false);
    sectionForm.reset();
  };

  const sectionIds = sections.map((section) => section.id);
  const sectionOptions: SectionOption[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    lessonCount: section.lessons.length,
  }));

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={ListTree}
      accent="primary"
      actions={
        canUpdate && !adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.addSection}
          </Button>
        ) : undefined
      }
    >
      {adding && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-background p-3">
          {/* `w-auto` undoes the Field's full width so the buttons share the row. */}
          <Field invalid={sectionForm.invalid("title")} required className="w-auto min-w-56 flex-1">
            <FieldLabel>{labels.sectionTitleLabel}</FieldLabel>
            <Input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              maxLength={255}
            />
            <FieldError>{sectionForm.error("title")}</FieldError>
          </Field>
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              if (!sectionForm.validate()) return;
              run(() => createSectionAction(courseId, newSection.trim()), {
                onDone: () => {
                  setNewSection("");
                  stopAdding();
                },
              });
            }}
          >
            {labels.create}
          </Button>
          <Button variant="ghost" size="sm" onClick={stopAdding} disabled={pending}>
            {labels.cancel}
          </Button>
        </div>
      )}

      {sections.length === 0 ? (
        <Empty className="border-none">
          <EmptyMedia>
            <ListTree aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                courseId={courseId}
                sectionIds={sectionIds}
                sectionOptions={sectionOptions}
                locale={locale}
                canUpdate={canUpdate}
                canCreateLesson={canCreateLesson}
                canDeleteLesson={canDeleteLesson}
                labels={labels}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{labels.reorderHint}</p>
        </>
      )}
    </EditorSection>
  );
}
