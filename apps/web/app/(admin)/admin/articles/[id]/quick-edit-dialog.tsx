"use client";

// Quick Edit (changes-07 §1.1 / PR 8) — the list row-menu's inline editor for
// the fields you change most often, without loading the full editor.
//
// Deliberately the DEFAULT locale only: this is a shortcut, and a
// locale-switching shortcut is just the editor with fewer safeguards. The
// service writes the same 301 redirect a full save does when the slug changes.

import { useState } from "react";
import { quickEditArticleSchema } from "@repo/contracts";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { quickUpdateArticleAction } from "../../_actions/article-actions.ts";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
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

  const values = {
    title,
    slug: slug || undefined,
    // Only send a category when one was picked — otherwise the shortcut
    // would clear a field it never showed a value for.
    ...(categoryId ? { categoryId } : {}),
    isFeatured,
  };
  // The title is optional in the schema only because the action accepts a
  // partial edit; this dialog always sends it, and `.min(1)` refuses "".
  const form = useFieldErrors(quickEditArticleSchema, values);

  const changeOpen = (next: boolean) => {
    if (!next) form.reset();
    onOpenChange(next);
  };

  const submit = () => {
    if (!form.validate()) return;
    run(
      async () => {
        await quickUpdateArticleAction(row.id, values);
        changeOpen(false);
        onSaved();
      },
      { successMessage: labels.saved },
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field invalid={form.invalid("title")} required>
            <FieldLabel>{labels.titleLabel}</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <FieldError>{form.error("title")}</FieldError>
          </Field>
          <Field invalid={form.invalid("slug")}>
            <FieldLabel>{labels.slugLabel}</FieldLabel>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            <FieldError>{form.error("slug")}</FieldError>
          </Field>
          <Field invalid={form.invalid("categoryId")}>
            <FieldLabel>{labels.categoryLabel}</FieldLabel>
            <AdminCombobox
              value={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <FieldError>{form.error("categoryId")}</FieldError>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel className="font-normal">{labels.featuredLabel}</FieldLabel>
            <Switch checked={isFeatured} onCheckedChange={(v) => setIsFeatured(v === true)} />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">{labels.cancel}</Button>} />
          {/* Enabled while fields are wrong: pressing it names them (F-07). */}
          <Button loading={pending} onClick={submit}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
