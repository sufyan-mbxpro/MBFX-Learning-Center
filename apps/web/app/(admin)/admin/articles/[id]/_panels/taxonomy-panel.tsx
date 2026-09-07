"use client";

// Categories + Tags (changes-07 §1.2 items 8–9), with the reference's per-term
// ARTICLE COUNTS. Those counts cost nothing new: `loadArticleCategoriesAdmin`
// and `loadArticleTagsAdmin` have always computed `articleCount` via `_count`
// and the old editor simply discarded it (plan §2.1 #10).
//
// Category is single-select (one `categoryId` column); tags are multi-select.
//
// changes-10 item 5 added inline creation. Filing a post under a section that
// does not exist yet used to mean abandoning the editor for
// /admin/articles/categories and losing every unsaved field on the way — the
// classic CMS papercut. Both dialogs call the SAME server actions the
// dedicated screens call (`createArticleCategoryAction` /
// `createArticleTagAction`), so there is one create path and one audit row
// per term, not a parallel one for the editor.
//
// The new term is applied optimistically to the selector and ALSO merged into
// the option list, because `useServerAction`'s router.refresh() only brings
// the server's copy back a beat later — deduped by id so the row does not
// appear twice when it lands.

import { useMemo, useState } from "react";
import { FolderTree, Plus, Tags } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import {
  createArticleCategoryAction,
  createArticleTagAction,
} from "../../../_actions/article-actions.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { EditorSection, Field } from "./editor-section.tsx";

export interface TaxonomyTerm {
  id: string;
  name: string;
  count: number;
}

export interface TaxonomyLabels {
  categoriesSection: string;
  categoriesDescription: string;
  tagsSection: string;
  tagsDescription: string;
  category: string;
  noTags: string;
  addCategory: string;
  addTag: string;
  newCategory: string;
  newTag: string;
  name: string;
  tagName: string;
  slugOptional: string;
  description: string;
  create: string;
  cancel: string;
  categoryCreated: string;
  tagCreated: string;
  search: string;
}

/** One dialog shape for both terms — a name, an optional slug, and (for a
 * category) a description. Kept together because they differ by one field. */
function NewTermDialog({
  open,
  onOpenChange,
  title,
  nameLabel,
  slugLabel,
  descriptionLabel,
  createLabel,
  cancelLabel,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  nameLabel: string;
  slugLabel: string;
  /** Omit for tags — the model has no description column. */
  descriptionLabel?: string;
  createLabel: string;
  cancelLabel: string;
  /** The PARENT's transition state — the create runs in its `run()`, not ours. */
  pending: boolean;
  onCreate: (input: { name: string; slug?: string; description?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (name.trim() === "" || pending) return;
    onCreate({
      name: name.trim(),
      ...(slug.trim() === "" ? {} : { slug: slug.trim() }),
      ...(descriptionLabel && description.trim() !== "" ? { description: description.trim() } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{slugLabel}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-term-name">{nameLabel}</Label>
            <Input
              id="new-term-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-term-slug">{slugLabel}</Label>
            <Input
              id="new-term-slug"
              value={slug}
              // ADR-044 #6's exception: the VALUE is a URL segment read
              // character by character.
              className="font-mono text-xs"
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          {descriptionLabel && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-term-description">{descriptionLabel}</Label>
              <Textarea
                id="new-term-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button disabled={pending || name.trim() === ""} onClick={submit}>
            {createLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Server rows plus anything created in this session, newest last, no dupes. */
function merge(fromServer: TaxonomyTerm[], created: TaxonomyTerm[]): TaxonomyTerm[] {
  const ids = new Set(fromServer.map((term) => term.id));
  return [...fromServer, ...created.filter((term) => !ids.has(term.id))];
}

export function TaxonomyPanel({
  categories,
  tags,
  categoryId,
  tagIds,
  onCategoryChange,
  onTagsChange,
  labels,
}: {
  categories: TaxonomyTerm[];
  tags: TaxonomyTerm[];
  categoryId: string;
  tagIds: string[];
  onCategoryChange: (id: string) => void;
  onTagsChange: (ids: string[]) => void;
  labels: TaxonomyLabels;
}) {
  const { run, pending } = useServerAction();
  const [newCategory, setNewCategory] = useState(false);
  const [newTag, setNewTag] = useState(false);
  const [createdCategories, setCreatedCategories] = useState<TaxonomyTerm[]>([]);
  const [createdTags, setCreatedTags] = useState<TaxonomyTerm[]>([]);
  const [tagFilter, setTagFilter] = useState("");

  const allCategories = merge(categories, createdCategories);
  const allTags = merge(tags, createdTags);

  const visibleTags = useMemo(() => {
    const needle = tagFilter.trim().toLowerCase();
    if (needle === "") return allTags;
    // Selected tags always stay visible: filtering something out of sight is
    // not the same as unselecting it, and hiding a checked box is how people
    // lose track of what a post is actually tagged with.
    return allTags.filter(
      (tag) => tag.name.toLowerCase().includes(needle) || tagIds.includes(tag.id),
    );
  }, [allTags, tagFilter, tagIds]);

  return (
    <>
      <EditorSection
        title={labels.categoriesSection}
        description={labels.categoriesDescription}
        icon={FolderTree}
        accent="primary"
        actions={
          <Button variant="outline" size="xs" onClick={() => setNewCategory(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.addCategory}
          </Button>
        }
      >
        <Field id="article-category" label={labels.category}>
          <Select value={categoryId} onValueChange={(v) => onCategoryChange(v ?? categoryId)}>
            <SelectTrigger id="article-category">
              <SelectValue>
                {allCategories.find((c) => c.id === categoryId)?.name ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {`${category.name} (${category.count})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </EditorSection>

      <EditorSection
        title={`${labels.tagsSection}${tagIds.length > 0 ? ` (${tagIds.length})` : ""}`}
        description={labels.tagsDescription}
        icon={Tags}
        accent="success"
        actions={
          <Button variant="outline" size="xs" onClick={() => setNewTag(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.addTag}
          </Button>
        }
      >
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.noTags}</p>
        ) : (
          <>
            {allTags.length > 8 && (
              <Input
                value={tagFilter}
                placeholder={labels.search}
                aria-label={labels.search}
                onChange={(e) => setTagFilter(e.target.value)}
              />
            )}
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {visibleTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={tagIds.includes(tag.id)}
                    onCheckedChange={(checked) =>
                      onTagsChange(
                        checked === true
                          ? [...tagIds, tag.id]
                          : tagIds.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">({tag.count})</span>
                </label>
              ))}
            </div>
          </>
        )}
      </EditorSection>

      {newCategory && (
        <NewTermDialog
          open
          onOpenChange={(next) => {
            if (!next) setNewCategory(false);
          }}
          title={labels.newCategory}
          nameLabel={labels.name}
          slugLabel={labels.slugOptional}
          descriptionLabel={labels.description}
          createLabel={labels.create}
          cancelLabel={labels.cancel}
          pending={pending}
          onCreate={(input) =>
            run(
              async () => {
                const id = await createArticleCategoryAction(input);
                setCreatedCategories((list) => [...list, { id, name: input.name, count: 0 }]);
                // Filing the post under what you just created is the whole
                // point of creating it here.
                onCategoryChange(id);
              },
              { successMessage: labels.categoryCreated, onDone: () => setNewCategory(false) },
            )
          }
        />
      )}

      {newTag && (
        <NewTermDialog
          open
          onOpenChange={(next) => {
            if (!next) setNewTag(false);
          }}
          title={labels.newTag}
          nameLabel={labels.tagName}
          slugLabel={labels.slugOptional}
          createLabel={labels.create}
          cancelLabel={labels.cancel}
          pending={pending}
          onCreate={(input) =>
            run(
              async () => {
                const id = await createArticleTagAction({
                  name: input.name,
                  ...(input.slug ? { slug: input.slug } : {}),
                });
                setCreatedTags((list) => [...list, { id, name: input.name, count: 0 }]);
                onTagsChange([...tagIds, id]);
              },
              { successMessage: labels.tagCreated, onDone: () => setNewTag(false) },
            )
          }
        />
      )}
    </>
  );
}
