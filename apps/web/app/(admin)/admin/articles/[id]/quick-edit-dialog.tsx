"use client";

// Quick Edit (changes-07 §1.1 / PR 8) — the list row-menu's inline editor for
// the fields you change most often, without loading the full editor.
//
// Deliberately the DEFAULT locale only: this is a shortcut, and a
// locale-switching shortcut is just the editor with fewer safeguards. The
// service writes the same 301 redirect a full save does when the slug changes.

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { quickUpdateArticleAction } from "../../_actions/article-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface QuickEditLabels {
  title: string;
  description: string;
  titleLabel: string;
  slugLabel: string;
  categoryLabel: string;
  featuredLabel: string;
  save: string;
  cancel: string;
  saved: string;
}

export function QuickEditDialog({
  open,
  onOpenChange,
  row,
  categories,
  labels,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: { id: string; title: string | null; slug: string | null; isFeatured: boolean };
  categories: { id: string; name: string }[];
  labels: QuickEditLabels;
  onSaved: () => void;
}) {
  const { run, pending } = useServerAction();
  const [title, setTitle] = useState(row.title ?? "");
  const [slug, setSlug] = useState(row.slug ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [isFeatured, setIsFeatured] = useState(row.isFeatured);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-title">{labels.titleLabel}</Label>
            <Input id="quick-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-slug">{labels.slugLabel}</Label>
            <Input id="quick-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-category">{labels.categoryLabel}</Label>
            <AdminCombobox
              id="quick-category"
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <label className="flex items-center justify-between gap-2 text-sm">
            {labels.featuredLabel}
            <Switch checked={isFeatured} onCheckedChange={(v) => setIsFeatured(v === true)} />
          </label>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">{labels.cancel}</Button>} />
          <Button
            disabled={pending || title.trim() === ""}
            onClick={() =>
              run(
                async () => {
                  await quickUpdateArticleAction(row.id, {
                    title,
                    slug: slug || undefined,
                    // Only send a category when one was picked — otherwise the
                    // shortcut would clear a field it never showed a value for.
                    ...(categoryId ? { categoryId } : {}),
                    isFeatured,
                  });
                  onOpenChange(false);
                  onSaved();
                },
                { successMessage: labels.saved },
              )
            }
          >
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
