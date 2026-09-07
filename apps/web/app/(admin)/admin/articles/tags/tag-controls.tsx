"use client";

// Article tags as a DataTable with a Create button that opens a modal, and
// a row action that opens an edit modal (changes-02). Locale is a dropdown
// (changes-02 bullet 1), never a free-text code.
import { useMemo, useState } from "react";
import { Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import {
  createArticleTagAction,
  deleteArticleTagAction,
  saveArticleTagTranslationAction,
  setArticleTagActiveAction,
} from "../../_actions/article-actions.ts";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import type { LocaleOption } from "../categories/category-controls.tsx";

export interface TagTranslationRow {
  locale: string;
  name: string;
  slug: string;
}

export interface TagRow {
  id: string;
  isActive: boolean;
  name: string | null;
  slug: string | null;
  articleCount: number;
  locales: string[];
  translations: TagTranslationRow[];
}

export interface TagLabels {
  name: string;
  slug: string;
  locale: string;
  save: string;
  saved: string;
  newTag: string;
  edit: string;
  delete: string;
  cancel: string;
  confirm: string;
  activeLabel: string;
  articleCount: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  translations: string;
  emptyTitle: string;
  noResults: string;
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  actionsCol: string;
}

const EMPTY_TRANSLATION = (locale: string): TagTranslationRow => ({ locale, name: "", slug: "" });

function TagEditDialog({
  open,
  onOpenChange,
  tag,
  locales,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: TagRow | null;
  locales: LocaleOption[];
  labels: TagLabels;
}) {
  const { run, pending } = useServerAction();
  const defaultLocale = locales[0]?.code ?? "en";
  const [locale, setLocale] = useState(defaultLocale);
  const [form, setForm] = useState<TagTranslationRow>(
    tag?.translations.find((t) => t.locale === defaultLocale) ?? EMPTY_TRANSLATION(defaultLocale),
  );

  const switchLocale = (next: string) => {
    setLocale(next);
    setForm(tag?.translations.find((t) => t.locale === next) ?? EMPTY_TRANSLATION(next));
  };

  const submit = () => {
    if (!tag) {
      run(() => createArticleTagAction({ name: form.name.trim() }), {
        onDone: () => onOpenChange(false),
      });
      return;
    }
    run(
      () =>
        saveArticleTagTranslationAction({
          tagId: tag.id,
          locale,
          name: form.name.trim(),
          slug: form.slug || undefined,
        }),
      { successMessage: labels.saved, onDone: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tag ? labels.edit : labels.newTag}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {tag && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tag-locale">{labels.locale}</Label>
              <Select value={locale} onValueChange={(v) => switchLocale(v ?? locale)}>
                <SelectTrigger id="tag-locale" className="w-full">
                  <SelectValue>
                    {locales.find((l) => l.code === locale)?.label ?? locale}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locales.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{labels.name}</Label>
            <Input
              id="tag-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          {tag && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tag-slug">{labels.slug}</Label>
              <Input
                id="tag-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button onClick={submit} disabled={pending || form.name.trim() === ""}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TagsManager({
  tags,
  locales,
  labels,
}: {
  tags: TagRow[];
  locales: LocaleOption[];
  labels: TagLabels;
}) {
  const { run, pending } = useServerAction();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: TagRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, c) => `${labels.pageWord} ${p} ${labels.ofWord} ${c}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  const { tableProps } = useClientTable(tags, {
    searchText: (t) => `${t.name ?? ""} ${t.slug ?? ""}`,
    sortValues: { name: (t) => t.name ?? "", articleCount: (t) => t.articleCount },
    initialPageSize: 25,
  });

  const columns = useMemo<ColumnDef<TagRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: labels.name,
        meta: { label: labels.name },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.slug && (
              <span className="text-xs text-muted-foreground">/{row.original.slug}</span>
            )}
          </div>
        ),
      },
      {
        id: "locales",
        header: labels.translations,
        meta: { label: labels.translations },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.locales.join(" · ")}</span>
        ),
      },
      {
        accessorKey: "articleCount",
        header: labels.articleCount,
        meta: { label: labels.articleCount },
        cell: ({ row }) => <Badge variant="secondary">{row.original.articleCount}</Badge>,
      },
      {
        id: "active",
        header: labels.activeLabel,
        meta: { label: labels.activeLabel },
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            disabled={pending}
            aria-label={`${labels.activeLabel}: ${row.original.name ?? ""}`}
            onCheckedChange={(checked) =>
              run(() => setArticleTagActiveAction(row.original.id, checked === true))
            }
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${labels.edit}: ${row.original.name ?? ""}`}
              onClick={() => openEdit(row.original)}
            >
              <Pencil aria-hidden />
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${labels.delete}: ${row.original.name ?? ""}`}
                  className="text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              }
              title={labels.confirmDeleteTitle}
              description={labels.confirmDeleteBody}
              confirmLabel={labels.confirm}
              cancelLabel={labels.cancel}
              onConfirm={() => run(() => deleteArticleTagAction(row.original.id))}
            />
          </div>
        ),
      },
    ],
    [labels, pending, run],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" aria-hidden /> {labels.newTag}
        </Button>
      </div>
      <DataTable
        columns={columns}
        labels={tableLabels}
        {...tableProps}
        emptyState={
          <Empty className="border-none">
            <EmptyMedia>
              <TagIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>{labels.noResults}</EmptyDescription>
          </Empty>
        }
      />
      <TagEditDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tag={editing}
        locales={locales}
        labels={labels}
      />
    </div>
  );
}
