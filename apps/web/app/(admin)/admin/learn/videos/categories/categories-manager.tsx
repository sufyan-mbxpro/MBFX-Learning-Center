"use client";

// Video categories admin (changes-16 PR 4, ADR-068).
//
// `glossary/topics/topics-manager.tsx` with the nouns changed, deliberately:
// a category is a name, a slug, a description, a visibility flag and a
// position, which fits in a row, and routing to a detail page for five fields
// is more navigation than editing. `ArticleCategory` and `GlossaryTopic` both
// made this call already.
//
// Reordering is keyboard-only — plan §8.2: drag and drop without a keyboard
// equivalent does not ship, and this repo has no DnD dependency.
//
// Each row is its own component so it can hold its own `useFieldErrors`
// (ADR-077): every row is a separate form with a separate Save, and one row's
// failed attempt must not light up another's fields.
import { useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { videoCategoryInputSchema, type VideoCategoryInput } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import {
  deleteVideoCategoryAction,
  reorderVideoCategoriesAction,
  saveVideoCategoryAction,
} from "../../../_actions/video-actions.ts";
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

type Run = ReturnType<typeof useServerAction>["run"];

export function CategoriesManager({
  rows,
  locale,
  canCreate,
  canUpdate,
  canDelete,
}: {
  rows: VideoCategoryRow[];
  locale: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("admin");
  const { run, pending } = useServerAction();
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<VideoCategoryRow | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<VideoCategoryRow>>>({});

  const createPayload: VideoCategoryInput = { translation: { locale, name: newName.trim() } };
  const createForm = useFieldErrors(videoCategoryInputSchema, createPayload);

  const createOpenChange = (next: boolean) => {
    setCreateOpen(next);
    if (!next) createForm.reset();
  };

  const draftFor = (row: VideoCategoryRow): VideoCategoryRow => ({ ...row, ...drafts[row.id] });
  const setDraft = (id: string, patch: Partial<VideoCategoryRow>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((row) => row.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved!);
    // Committed immediately, not held as a draft: order is a property of the
    // LIST, and holding it unsaved beside per-row Save buttons would make it
    // ambiguous which button persists it.
    run(() => reorderVideoCategoriesAction(ids));
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={createOpenChange}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus data-icon="inline-start" aria-hidden />
                  {t("videoCategoryManager.create")}
                </Button>
              }
            />
            <DialogContent className="max-w-sm" closeLabel={t("close")}>
              <DialogHeader>
                {/* ADR-057 #5: a title AND a description on every modal. */}
                <DialogTitle>{t("videoCategoryManager.createTitle")}</DialogTitle>
                <DialogDescription>{t("videoCategoryManager.createDescription")}</DialogDescription>
              </DialogHeader>
              <Field invalid={createForm.invalid("translation.name")} required>
                <FieldLabel>{t("videoCategoryManager.nameLabel")}</FieldLabel>
                <Input
                  value={newName}
                  maxLength={100}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <FieldError>{createForm.error("translation.name")}</FieldError>
              </Field>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => createOpenChange(false)}
                >
                  {t("cancel")}
                </Button>
                {/* Enabled while the name is wrong: pressing it says so (audit F-07). */}
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() => {
                    if (!createForm.validate()) return;
                    run(() => saveVideoCategoryAction(createPayload), {
                      onDone: () => {
                        setNewName("");
                        createOpenChange(false);
                      },
                    });
                  }}
                >
                  {t("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <FolderOpen aria-hidden className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{t("videoCategoryManager.empty")}</EmptyTitle>
          <EmptyDescription>{t("videoCategoryManager.emptyBody")}</EmptyDescription>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <CategoryItem
              key={row.id}
              row={row}
              draft={draftFor(row)}
              onDraft={(patch) => setDraft(row.id, patch)}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              onMove={(delta) => move(index, delta)}
              onDelete={() => setDeleting(row)}
              locale={locale}
              canUpdate={canUpdate}
              canDelete={canDelete}
              run={run}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {/* ADR-044 #7: deleting asks first. The body says what happens to the
          topics, because "delete category" reads like it might take them too —
          the FK is SetNull precisely so it does not. */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => setDeleting(open ? deleting : null)}
        title={t("videoCategoryManager.confirmDeleteTitle")}
        description={
          deleting && deleting.topicCount > 0
            ? t("videoCategoryManager.inUseBody")
            : t("videoCategoryManager.confirmDeleteBody")
        }
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) run(() => deleteVideoCategoryAction(target.id));
        }}
      />
    </div>
  );
}

function CategoryItem({
  row,
  draft,
  onDraft,
  isFirst,
  isLast,
  onMove,
  onDelete,
  locale,
  canUpdate,
  canDelete,
  run,
  pending,
}: {
  row: VideoCategoryRow;
  draft: VideoCategoryRow;
  onDraft: (patch: Partial<VideoCategoryRow>) => void;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: number) => void;
  onDelete: () => void;
  locale: string;
  canUpdate: boolean;
  canDelete: boolean;
  run: Run;
  pending: boolean;
}) {
  const t = useTranslations("admin");

  const payload: VideoCategoryInput = {
    categoryId: row.id,
    isActive: draft.isActive,
    translation: {
      locale,
      name: draft.name.trim(),
      slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
      description: (draft.description ?? "").trim() === "" ? null : draft.description!.trim(),
    },
  };
  const form = useFieldErrors(videoCategoryInputSchema, payload);

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("videoCategoryManager.columnTopics")}: {row.topicCount}
          </Badge>
          <span className="text-xs text-muted-foreground">/{row.slug}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("videoCategoryManager.moveUp")}
            disabled={!canUpdate || pending || isFirst}
            onClick={() => onMove(-1)}
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("videoCategoryManager.moveDown")}
            disabled={!canUpdate || pending || isLast}
            onClick={() => onMove(1)}
          >
            <ChevronDown aria-hidden />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("videoCategoryManager.delete")}
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field invalid={form.invalid("translation.name")} required>
          <FieldLabel>{t("videoCategoryManager.nameLabel")}</FieldLabel>
          <Input
            value={draft.name}
            maxLength={100}
            disabled={!canUpdate}
            onChange={(e) => onDraft({ name: e.target.value })}
          />
          <FieldError>{form.error("translation.name")}</FieldError>
        </Field>
        <Field invalid={form.invalid("translation.slug")}>
          <FieldLabel>{t("videoCategoryManager.slugLabel")}</FieldLabel>
          <Input
            value={draft.slug}
            maxLength={150}
            disabled={!canUpdate}
            onChange={(e) => onDraft({ slug: e.target.value })}
          />
          <FieldError>{form.error("translation.slug")}</FieldError>
        </Field>
      </div>

      <Field invalid={form.invalid("translation.description")}>
        <FieldLabel>{t("videoCategoryManager.descriptionLabel")}</FieldLabel>
        <Textarea
          rows={2}
          value={draft.description ?? ""}
          maxLength={500}
          disabled={!canUpdate}
          onChange={(e) => onDraft({ description: e.target.value })}
        />
        <FieldError>{form.error("translation.description")}</FieldError>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Field orientation="horizontal" className="w-auto">
          <Switch
            checked={draft.isActive}
            disabled={!canUpdate}
            onCheckedChange={(checked) => onDraft({ isActive: checked })}
          />
          <FieldLabel>{t("videoCategoryManager.activeLabel")}</FieldLabel>
        </Field>
        {/* ADR-044 #8: Save at the inline END of its section. Enabled while
            fields are wrong: pressing it names them (audit F-07). */}
        <Button
          size="sm"
          disabled={!canUpdate || pending}
          onClick={() => {
            if (!form.validate()) return;
            run(() => saveVideoCategoryAction(payload), {
              successMessage: t("videoCategoryManager.saved"),
            });
          }}
        >
          {t("videoCategoryManager.save")}
        </Button>
      </div>
    </li>
  );
}
