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
import { useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import {
  deleteVideoCategoryAction,
  reorderVideoCategoriesAction,
  saveVideoCategoryAction,
} from "../../../_actions/video-actions.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

export interface VideoCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  topicCount: number;
}

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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-video-category-name">
                  {t("videoCategoryManager.nameLabel")}
                </Label>
                <Input
                  id="new-video-category-name"
                  value={newName}
                  maxLength={100}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setCreateOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={pending || newName.trim() === ""}
                  onClick={() =>
                    run(
                      () =>
                        saveVideoCategoryAction({
                          translation: { locale, name: newName.trim() },
                        }),
                      {
                        onDone: () => {
                          setNewName("");
                          setCreateOpen(false);
                        },
                      },
                    )
                  }
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
          {rows.map((row, index) => {
            const draft = draftFor(row);
            return (
              <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
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
                      disabled={!canUpdate || pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("videoCategoryManager.moveDown")}
                      disabled={!canUpdate || pending || index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown aria-hidden />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("videoCategoryManager.delete")}
                        disabled={pending}
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`video-category-${row.id}-name`}>
                      {t("videoCategoryManager.nameLabel")}
                    </Label>
                    <Input
                      id={`video-category-${row.id}-name`}
                      value={draft.name}
                      maxLength={100}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft(row.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`video-category-${row.id}-slug`}>
                      {t("videoCategoryManager.slugLabel")}
                    </Label>
                    <Input
                      id={`video-category-${row.id}-slug`}
                      value={draft.slug}
                      maxLength={150}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft(row.id, { slug: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`video-category-${row.id}-desc`}>
                    {t("videoCategoryManager.descriptionLabel")}
                  </Label>
                  <Textarea
                    id={`video-category-${row.id}-desc`}
                    rows={2}
                    value={draft.description ?? ""}
                    maxLength={500}
                    disabled={!canUpdate}
                    onChange={(e) => setDraft(row.id, { description: e.target.value })}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`video-category-${row.id}-active`}
                      checked={draft.isActive}
                      disabled={!canUpdate}
                      onCheckedChange={(checked) => setDraft(row.id, { isActive: checked })}
                    />
                    <Label htmlFor={`video-category-${row.id}-active`}>
                      {t("videoCategoryManager.activeLabel")}
                    </Label>
                  </div>
                  {/* ADR-044 #8: Save at the inline END of its section. */}
                  <Button
                    size="sm"
                    disabled={!canUpdate || pending || draft.name.trim() === ""}
                    onClick={() =>
                      run(
                        () =>
                          saveVideoCategoryAction({
                            categoryId: row.id,
                            isActive: draft.isActive,
                            translation: {
                              locale,
                              name: draft.name.trim(),
                              slug: draft.slug.trim() === "" ? undefined : draft.slug.trim(),
                              description:
                                (draft.description ?? "").trim() === ""
                                  ? null
                                  : draft.description!.trim(),
                            },
                          }),
                        { successMessage: t("videoCategoryManager.saved") },
                      )
                    }
                  >
                    {t("videoCategoryManager.save")}
                  </Button>
                </div>
              </li>
            );
          })}
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
