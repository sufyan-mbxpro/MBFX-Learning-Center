"use client";

// Filter toolbar + create dialog for the articles list. Row actions,
// pagination and search moved into articles-table.tsx (the shared
// DataTable owns them); URL writes go through the shared useUrlFilters
// hook.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createArticleSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { createArticleAction } from "../../_actions/article-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { useUrlFilters } from "../../_hooks/use-url-filters.ts";
import { useDeletedFilterOption } from "../../_components/trash.tsx";

const KINDS = ["NEWS", "ANALYSIS", "TRADE_IDEA"] as const;
const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

export function ArticlesToolbar({
  categories,
  labels,
}: {
  categories: { id: string; name: string }[];
  labels: {
    allKinds: string;
    allStatuses: string;
    allCategories: string;
    kind: string;
    kinds: Record<string, string>;
    statuses: Record<string, string>;
  };
}) {
  const searchParams = useSearchParams();
  const setParams = useUrlFilters();
  const deletedOption = useDeletedFilterOption();

  return (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.kind}
        className="w-40"
        value={searchParams.get("kind") ?? ""}
        onValueChange={(kind) => setParams({ kind })}
        options={[
          { value: "", label: labels.allKinds },
          ...KINDS.map((kind) => ({ value: kind, label: labels.kinds[kind] ?? kind })),
        ]}
      />
      <AdminCombobox
        aria-label={labels.allStatuses}
        className="w-40"
        value={searchParams.get("status") ?? ""}
        onValueChange={(status) => setParams({ status })}
        options={[
          { value: "", label: labels.allStatuses },
          ...STATUSES.map((status) => ({
            value: status,
            label: labels.statuses[status] ?? status,
          })),
          // The trash (changes-49): deleted articles are listed only here. The
          // value is `ARTICLE_DELETED_FILTER`'s, which the page's contract
          // accepts and turns into the service's `deleted` flag.
          deletedOption,
        ]}
      />
      <AdminCombobox
        aria-label={labels.allCategories}
        className="w-40"
        value={searchParams.get("category") ?? ""}
        onValueChange={(category) => setParams({ category })}
        options={[
          { value: "", label: labels.allCategories },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
        ]}
      />
    </FilterBarRow>
  );
}

export function NewArticleDialog({
  categories,
  labels,
}: {
  categories: { id: string; name: string }[];
  labels: {
    newArticle: string;
    newArticleDescription: string;
    create: string;
    cancel: string;
    close: string;
    kind: string;
    category: string;
    kinds: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newKind, setNewKind] = useState<string>("NEWS");
  const [newCategory, setNewCategory] = useState<string>(categories[0]?.id ?? "");
  const { run, pending } = useServerAction();

  const values = { kind: newKind as (typeof KINDS)[number], categoryId: newCategory };
  const form = useFieldErrors(createArticleSchema, values);

  const changeOpen = (next: boolean) => {
    if (!next) form.reset();
    setOpen(next);
  };

  const submit = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const id = await createArticleAction(values);
        router.push(`/keystone/articles/${id}`);
      },
      { skipRefresh: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm">{labels.newArticle}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newArticle}</DialogTitle>
          <DialogDescription>{labels.newArticleDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("kind")} required>
            <FieldLabel>{labels.kind}</FieldLabel>
            <AdminCombobox
              value={newKind}
              onValueChange={(next) => setNewKind(next || newKind)}
              options={KINDS.map((kind) => ({ value: kind, label: labels.kinds[kind] ?? kind }))}
            />
            <FieldError>{form.error("kind")}</FieldError>
          </Field>
          <Field invalid={form.invalid("categoryId")} required>
            <FieldLabel>{labels.category}</FieldLabel>
            <AdminCombobox
              value={newCategory}
              onValueChange={(next) => setNewCategory(next || newCategory)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
            <FieldError>{form.error("categoryId")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => changeOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled with no category: pressing it names the field (F-07). */}
          <Button size="sm" loading={pending} onClick={submit}>
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
