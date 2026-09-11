"use client";

// Social links CRUD (changes-01, full-page DataTable in changes-05): the
// shared DataTable (search/sort/columns) replaces the raw <Table> that used
// to sit in a narrow settings card — same modal create/edit and confirm-
// popup delete every other CRUD table in admin uses (roles/categories/tags),
// following articles/categories/category-controls.tsx as the closest
// reference. Active still flips inline via Switch.
import * as React from "react";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { SOCIAL_GLYPH_NAMES, SocialGlyph } from "@repo/ui/components/social-glyph";
import { Switch } from "@repo/ui/components/switch";
import { humanizeKey } from "@repo/utils";
import { ImageUploadField, type ImageUploadLabels } from "../../_components/image-upload-field.tsx";
import {
  createSocialLinkAction,
  deleteSocialLinkAction,
  toggleSocialLinkAction,
  updateSocialLinkAction,
} from "../../_actions/admin-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useClientTable } from "../../_hooks/use-client-table.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface SocialLinkRow {
  platform: string;
  label: string;
  url: string;
  icon: string;
  iconUrl: string | null;
  handle: string | null;
  isActive: boolean;
  openInNewTab: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
}

export interface SocialLinksLabels {
  add: string;
  addDescription: string;
  edit: string;
  editDescription: string;
  delete: string;
  save: string;
  cancel: string;
  title: string;
  url: string;
  platformKey: string;
  handle: string;
  active: string;
  openInNewTab: string;
  showInHeader: string;
  showInFooter: string;
  actionsCol: string;
  deleteTitle: string;
  deleteConfirm: string;
  iconCol: string;
  iconGlyph: string;
  iconUpload: string;
  iconUploadHint: string;
  upload: ImageUploadLabels;
  empty: string;
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
}

interface FormState {
  platform: string;
  label: string;
  url: string;
  icon: string;
  iconUrl: string | null;
  handle: string;
  isActive: boolean;
  openInNewTab: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
}

const EMPTY_FORM: FormState = {
  platform: "",
  label: "",
  url: "",
  icon: "link",
  iconUrl: null,
  handle: "",
  isActive: true,
  openInNewTab: true,
  showInHeader: false,
  showInFooter: true,
};

export function SocialLinksManager({
  links,
  labels,
}: {
  links: SocialLinkRow[];
  labels: SocialLinksLabels;
}) {
  const { run, pending } = useServerAction();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  // null = creating; a platform key = editing that row.
  const [editing, setEditing] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: SocialLinkRow) => {
    setEditing(row.platform);
    setForm({
      platform: row.platform,
      label: row.label,
      url: row.url,
      icon: row.icon,
      iconUrl: row.iconUrl,
      handle: row.handle ?? "",
      isActive: row.isActive,
      openInNewTab: row.openInNewTab,
      showInHeader: row.showInHeader,
      showInFooter: row.showInFooter,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const payload = {
      label: form.label,
      url: form.url,
      icon: form.icon,
      iconUrl: form.iconUrl,
      handle: form.handle || undefined,
      isActive: form.isActive,
      openInNewTab: form.openInNewTab,
      showInHeader: form.showInHeader,
      showInFooter: form.showInFooter,
    };
    if (editing) {
      run(() => updateSocialLinkAction(editing, payload), {
        onDone: () => setDialogOpen(false),
      });
    } else {
      run(() => createSocialLinkAction({ ...payload, platform: form.platform }), {
        onDone: () => setDialogOpen(false),
      });
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, c) => `${labels.pageWord} ${p} ${labels.ofWord} ${c}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.empty,
  };

  const { tableProps } = useClientTable(links, {
    searchText: (r) => `${r.label} ${r.handle ?? ""} ${r.url}`,
    sortValues: {
      label: (r) => r.label,
      url: (r) => r.url,
    },
    initialPageSize: 25,
  });

  const columns = React.useMemo<ColumnDef<SocialLinkRow>[]>(
    () => [
      {
        id: "icon",
        header: () => <span className="sr-only">{labels.iconCol}</span>,
        meta: { label: labels.iconCol },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground">
            {row.original.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.iconUrl}
                alt=""
                aria-hidden
                className="size-4 object-contain"
              />
            ) : (
              <SocialGlyph name={row.original.icon} />
            )}
          </span>
        ),
      },
      {
        accessorKey: "label",
        header: labels.title,
        meta: { label: labels.title },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.label}</span>
            {row.original.handle && (
              <span className="text-xs text-muted-foreground">{row.original.handle}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "url",
        header: labels.url,
        meta: { label: labels.url },
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-foreground">{row.original.url}</span>
        ),
      },
      {
        id: "active",
        header: labels.active,
        meta: { label: labels.active },
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            aria-label={`${labels.active}: ${row.original.label}`}
            checked={row.original.isActive}
            disabled={pending}
            onCheckedChange={(next) =>
              run(() => toggleSocialLinkAction(row.original.platform, next === true))
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
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${labels.edit}: ${row.original.label}`}
              onClick={() => openEdit(row.original)}
            >
              <Pencil aria-hidden />
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${labels.delete}: ${row.original.label}`}
                  className="text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              }
              title={labels.deleteTitle}
              description={`${labels.deleteConfirm} ${row.original.label}`}
              confirmLabel={labels.delete}
              cancelLabel={labels.cancel}
              onConfirm={() => run(() => deleteSocialLinkAction(row.original.platform))}
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
          <Plus data-icon="inline-start" aria-hidden /> {labels.add}
        </Button>
      </div>

      <DataTable
        columns={columns}
        labels={tableLabels}
        {...tableProps}
        emptyState={
          <Empty className="border-none">
            <EmptyMedia>
              <Link2 aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{labels.title}</EmptyTitle>
            <EmptyDescription>{labels.empty}</EmptyDescription>
          </Empty>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? labels.edit : labels.add}</DialogTitle>
            <DialogDescription>
              {editing ? labels.editDescription : labels.addDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {!editing && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="social-platform">{labels.platformKey}</Label>
                <Input
                  id="social-platform"
                  value={form.platform}
                  onChange={(e) =>
                    set("platform", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                  }
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="social-label">{labels.title}</Label>
              <Input
                id="social-label"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="social-url">{labels.url}</Label>
              <Input
                id="social-url"
                type="url"
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
              />
            </div>
            {/* changes-08: the icon is chosen, not typed. A built-in glyph
                covers the common platforms with no upload; an uploaded
                asset (ADR-045) overrides it, which is what the icon
                preview shows the moment one is set. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="social-icon">{labels.iconGlyph}</Label>
              <AdminCombobox
                id="social-icon"
                value={form.icon}
                onValueChange={(next) => set("icon", next || "link")}
                // The glyph rides along as `icon`; `label` stays the plain
                // humanized name so the search input has something to match.
                options={SOCIAL_GLYPH_NAMES.map((name) => ({
                  value: name,
                  label: humanizeKey(name),
                  icon: <SocialGlyph name={name} />,
                }))}
              />
            </div>
            <ImageUploadField
              id="social-icon-url"
              label={labels.iconUpload}
              description={labels.iconUploadHint}
              value={form.iconUrl}
              purpose="setting"
              category="brand"
              sourceType="SETTING"
              labels={labels.upload}
              previewClassName="size-12"
              onChange={(next) => set("iconUrl", next?.url ?? null)}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="social-handle">{labels.handle}</Label>
              <Input
                id="social-handle"
                value={form.handle}
                onChange={(e) => set("handle", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="social-active">{labels.active}</Label>
              <Switch
                id="social-active"
                checked={form.isActive}
                onCheckedChange={(next) => set("isActive", next === true)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.openInNewTab}
                onCheckedChange={(next) => set("openInNewTab", next === true)}
              />
              {labels.openInNewTab}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.showInHeader}
                onCheckedChange={(next) => set("showInHeader", next === true)}
              />
              {labels.showInHeader}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.showInFooter}
                onCheckedChange={(next) => set("showInFooter", next === true)}
              />
              {labels.showInFooter}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !form.label || !form.url || (!editing && !form.platform)}
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
