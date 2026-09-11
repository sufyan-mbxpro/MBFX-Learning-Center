"use client";

// Filter toolbar + create dialog for the articles list. Row actions,
// pagination and search moved into articles-table.tsx (the shared
// DataTable owns them); URL writes go through the shared useUrlFilters
// hook.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Label } from "@repo/ui/components/label";
import { createArticleAction } from "../_actions/article-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { FilterBar } from "../_components/filter-bar.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";

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

  return (
    <FilterBar>
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
    </FilterBar>
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">{labels.newArticle}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newArticle}</DialogTitle>
          <DialogDescription>{labels.newArticleDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-article-kind">{labels.kind}</Label>
            <AdminCombobox
              id="new-article-kind"
              value={newKind}
              onValueChange={(next) => setNewKind(next || newKind)}
              options={KINDS.map((kind) => ({ value: kind, label: labels.kinds[kind] ?? kind }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-article-category">{labels.category}</Label>
            <AdminCombobox
              id="new-article-category"
              value={newCategory}
              onValueChange={(next) => setNewCategory(next || newCategory)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || !newCategory}
            onClick={() =>
              run(
                async () => {
                  const id = await createArticleAction({
                    kind: newKind as (typeof KINDS)[number],
                    categoryId: newCategory,
                  });
                  router.push(`/admin/articles/${id}`);
                },
                { skipRefresh: true },
              )
            }
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
