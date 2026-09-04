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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { createArticleAction } from "../_actions/article-actions.ts";
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
      <Select value={searchParams.get("kind") ?? ""} onValueChange={(v) => setParams({ kind: v })}>
        <SelectTrigger aria-label={labels.kind} className="min-w-36">
          <SelectValue>
            {searchParams.get("kind")
              ? (labels.kinds[searchParams.get("kind") ?? ""] ?? searchParams.get("kind"))
              : labels.allKinds}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{labels.allKinds}</SelectItem>
          {KINDS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {labels.kinds[kind] ?? kind}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("status") ?? ""}
        onValueChange={(v) => setParams({ status: v })}
      >
        <SelectTrigger aria-label={labels.allStatuses} className="min-w-36">
          <SelectValue>
            {searchParams.get("status")
              ? (labels.statuses[searchParams.get("status") ?? ""] ?? searchParams.get("status"))
              : labels.allStatuses}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{labels.allStatuses}</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {labels.statuses[status] ?? status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("category") ?? ""}
        onValueChange={(v) => setParams({ category: v })}
      >
        <SelectTrigger aria-label={labels.allCategories} className="min-w-40">
          <SelectValue>
            {searchParams.get("category")
              ? (categories.find((c) => c.id === searchParams.get("category"))?.name ??
                labels.allCategories)
              : labels.allCategories}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{labels.allCategories}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-article-kind">{labels.kind}</Label>
            <Select value={newKind} onValueChange={(v) => setNewKind(v ?? newKind)}>
              <SelectTrigger id="new-article-kind">
                <SelectValue>{labels.kinds[newKind] ?? newKind}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {labels.kinds[kind] ?? kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-article-category">{labels.category}</Label>
            <Select value={newCategory} onValueChange={(v) => setNewCategory(v ?? newCategory)}>
              <SelectTrigger id="new-article-category">
                <SelectValue>
                  {categories.find((c) => c.id === newCategory)?.name ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
