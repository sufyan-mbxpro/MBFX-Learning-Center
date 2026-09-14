"use client";

// The one form a video category has, in a modal (changes-22).
//
// It replaces the inline editor `categories-manager.tsx` kept in every row —
// four fields, a switch and a Save button per category, all expanded at once,
// so a library of ten categories was a page of forty controls with nothing to
// scan. The list is a table now (`categories-table.tsx`) and editing happens
// here, over it.
//
// One component for create AND edit, because it is one action:
// `saveVideoCategory` creates when `categoryId` is absent and updates when it
// is present. Two dialogs would be two places for the same four fields to
// drift.
//
// A category stays a modal rather than following `GlossaryTopic` to a detail
// route (changes-18 PR 3): a topic grew rich text and SEO copy, which is what
// made a page necessary there. A category is still a name, a slug, a sentence
// and a switch, and that fits over the list it belongs to.
//
// **The fields live in a child keyed by the row, not in an effect.** One
// dialog instance serves every row in the table, so the form has to be told
// which row it is looking at — and doing that by syncing state in a
// `useEffect` is the cascading-render pattern `react-hooks/set-state-in-effect`
// exists to refuse. A `key` makes React remount the form instead, which is
// what "this is a different form now" actually means.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { videoCategoryInputSchema, type VideoCategoryInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { saveVideoCategoryAction } from "../../../_actions/video-actions.ts";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

export interface VideoCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  topicCount: number;
}

/** The row being edited, or `null` for "create a new one". */
export type CategoryDraftTarget = VideoCategoryRow | null;

export function CategoryDialog({
  open,
  onOpenChange,
  target,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CategoryDraftTarget;
  locale: string;
}) {
  const t = useTranslations("admin");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")}>
        {/* Title AND description — ADR-057 #5, guarded by
            `admin-dialog-conventions.test.ts`. */}
        <DialogHeader>
          <DialogTitle>
            {target ? t("videoCategoryManager.editTitle") : t("videoCategoryManager.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {target
              ? t("videoCategoryManager.editDescription")
              : t("videoCategoryManager.createDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Mounted with the dialog and keyed by the row: opening on a
            different category, or on "new", is a different form with
            different initial values, and a remount is how that is said. */}
        {open && (
          <CategoryForm
            key={target?.id ?? "__new__"}
            target={target}
            locale={locale}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  target,
  locale,
  onClose,
}: {
  target: CategoryDraftTarget;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const { run, pending } = useServerAction();

  // A new category opens on the defaults — visible, no slug (the service
  // derives one from the name).
  const [name, setName] = useState(target?.name ?? "");
  const [slug, setSlug] = useState(target?.slug ?? "");
  const [description, setDescription] = useState(target?.description ?? "");
  const [isActive, setIsActive] = useState(target?.isActive ?? true);

  const payload: VideoCategoryInput = {
    ...(target ? { categoryId: target.id } : {}),
    isActive,
    translation: {
      locale,
      name: name.trim(),
      slug: slug.trim() === "" ? undefined : slug.trim(),
      description: description.trim() === "" ? null : description.trim(),
    },
  };
  // The action's own schema over the exact payload it is sent (ADR-077).
  const form = useFieldErrors(videoCategoryInputSchema, payload);

  const submit = () => {
    if (!form.validate()) return;
    run(() => saveVideoCategoryAction(payload), {
      successMessage: target ? t("videoCategoryManager.saved") : t("videoCategoryManager.created"),
      onDone: onClose,
    });
  };

  return (
    <>
      <FieldGroup>
        <Field invalid={form.invalid("translation.name")} required>
          <FieldLabel>{t("videoCategoryManager.nameLabel")}</FieldLabel>
          <Input
            value={name}
            maxLength={100}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError>{form.error("translation.name")}</FieldError>
        </Field>

        <Field invalid={form.invalid("translation.slug")}>
          <FieldLabel>{t("videoCategoryManager.slugLabel")}</FieldLabel>
          <Input
            value={slug}
            maxLength={150}
            placeholder={t("videoCategoryManager.slugPlaceholder")}
            className="font-mono text-xs"
            onChange={(event) => setSlug(event.target.value)}
          />
          {/* Renaming a category writes one redirect per track it has topics
              in (ADR-068 §4) — worth saying before the rename, not after. */}
          <FieldDescription>{t("videoCategoryManager.slugHint")}</FieldDescription>
          <FieldError>{form.error("translation.slug")}</FieldError>
        </Field>

        <Field invalid={form.invalid("translation.description")}>
          <FieldLabel>{t("videoCategoryManager.descriptionLabel")}</FieldLabel>
          <Textarea
            rows={3}
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FieldError>{form.error("translation.description")}</FieldError>
        </Field>

        <Field orientation="horizontal">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <FieldLabel>{t("videoCategoryManager.activeLabel")}</FieldLabel>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </Button>
        {/* Enabled while a field is wrong: pressing it names the field
            (ADR-077, audit F-07). */}
        <Button loading={pending} onClick={submit}>
          {target ? t("videoCategoryManager.save") : t("create")}
        </Button>
      </DialogFooter>
    </>
  );
}
