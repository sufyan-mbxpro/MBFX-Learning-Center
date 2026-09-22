"use client";

// Live preview against a real (sample) CollectionItem, using the EXACT
// same `renderCard()` the public renderer calls (`@repo/blocks/card`) — no
// second, drifting preview implementation. `config`/`contentType`/`variant`
// are still authored as JSON + plain selects here, same deliberate,
// temporary simplification PR 3.1's style-preset screen already accepted
// (no visual picker yet); the preview is what's new and real here.
import { useMemo, useState } from "react";
import type { CardConfig, CardVariant } from "@repo/contracts";
import { renderCard } from "@repo/blocks/card";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Empty, EmptyTitle } from "@repo/ui/components/empty";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  createCardTemplateAction,
  deleteCardTemplateAction,
} from "../../_actions/card-template-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface CardTemplateRow {
  id: string;
  key: string;
  name: string;
  contentType: string | null;
  variant: string;
  config: unknown;
  isSystem: boolean;
  usageCount: number;
}

interface CardsLabels {
  newTemplate: string;
  keyLabel: string;
  nameLabel: string;
  contentTypeLabel: string;
  variantLabel: string;
  configLabel: string;
  create: string;
  cancel: string;
  close: string;
  delete: string;
  duplicate: string;
  systemBadge: string;
  usageCount: string;
  noResults: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  invalidJson: string;
  preview: string;
}

const VARIANTS: CardVariant[] = ["standard", "featured", "compact", "horizontal"];

/** A fixed, realistic stand-in — the preview shows how a config renders, not any particular real item (no live content fetch here, this is a design-time tool). */
const SAMPLE_ITEM = {
  id: "sample",
  slug: "sample-article",
  title: "Sample headline goes here",
  excerpt:
    "A short sample excerpt, so you can see how this template truncates and wraps real body copy.",
  href: "#",
  date: new Date(),
  category: { slug: "sample", label: "Sample Category" },
};

function CardPreview({
  variant,
  config,
  label,
}: {
  variant: string;
  config: CardConfig;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="max-w-sm">{renderCard(SAMPLE_ITEM, variant, config, "en")}</div>
    </div>
  );
}

function CardTemplateDialog({
  labels,
  prefill,
  trigger,
}: {
  labels: CardsLabels;
  prefill?: {
    key: string;
    name: string;
    contentType: string | null;
    variant: string;
    config: unknown;
  };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(prefill?.key ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [contentType, setContentType] = useState(prefill?.contentType ?? "");
  const [variant, setVariant] = useState(prefill?.variant ?? "standard");
  const [configText, setConfigText] = useState(
    prefill ? JSON.stringify(prefill.config, null, 2) : "{}",
  );
  const [jsonError, setJsonError] = useState(false);
  const { run, pending } = useServerAction();

  const parsedConfig = useMemo(() => {
    try {
      return JSON.parse(configText) as CardConfig;
    } catch {
      return null;
    }
  }, [configText]);

  function reset() {
    setKey(prefill?.key ?? "");
    setName(prefill?.name ?? "");
    setContentType(prefill?.contentType ?? "");
    setVariant(prefill?.variant ?? "standard");
    setConfigText(prefill ? JSON.stringify(prefill.config, null, 2) : "{}");
    setJsonError(false);
  }

  function submit() {
    if (!parsedConfig) {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    run(
      () =>
        createCardTemplateAction({
          key,
          name,
          contentType: contentType.trim() || undefined,
          variant: variant as CardVariant,
          // The server re-validates with the real Zod schema (security.md
          // #6); this cast just satisfies the action's typed signature for
          // a value that was, a moment ago, unstructured admin-typed JSON.
          config: parsedConfig,
        }),
      { onDone: () => setOpen(false) },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-2xl" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newTemplate}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-key">{labels.keyLabel}</Label>
              <Input id="card-key" value={key} onChange={(e) => setKey(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-name">{labels.nameLabel}</Label>
              <Input id="card-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-content-type">{labels.contentTypeLabel}</Label>
              <Input
                id="card-content-type"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="news"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{labels.variantLabel}</Label>
              <Select value={variant} onValueChange={(v) => v && setVariant(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANTS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-config">{labels.configLabel}</Label>
              <Textarea
                id="card-config"
                rows={8}
                className="font-mono text-xs"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
              />
              {jsonError && <p className="text-xs text-destructive">{labels.invalidJson}</p>}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            {parsedConfig ? (
              <CardPreview variant={variant} config={parsedConfig} label={labels.preview} />
            ) : (
              <p className="text-xs text-destructive">{labels.invalidJson}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button size="sm" disabled={pending || !key.trim() || !name.trim()} onClick={submit}>
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CardTemplatesManager({
  templates,
  canManage,
  labels,
}: {
  templates: CardTemplateRow[];
  canManage: boolean;
  labels: CardsLabels;
}) {
  const { run } = useServerAction();

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <CardTemplateDialog
            labels={labels}
            trigger={<Button size="sm">{labels.newTemplate}</Button>}
          />
        </div>
      )}
      {templates.length === 0 ? (
        <Empty className="border">
          <EmptyTitle>{labels.noResults}</EmptyTitle>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.keyLabel}</TableHead>
              <TableHead>{labels.nameLabel}</TableHead>
              <TableHead>{labels.contentTypeLabel}</TableHead>
              <TableHead>{labels.variantLabel}</TableHead>
              <TableHead className="text-end">{labels.usageCount}</TableHead>
              <TableHead className="text-end">{labels.delete}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{template.key}</code>
                    {template.isSystem && <Badge variant="outline">{labels.systemBadge}</Badge>}
                  </div>
                </TableCell>
                <TableCell>{template.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{template.contentType ?? "*"}</code>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{template.variant}</code>
                </TableCell>
                <TableCell className="text-end">{template.usageCount}</TableCell>
                <TableCell className="text-end">
                  {canManage && !template.isSystem && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive">
                          {labels.delete}
                        </Button>
                      }
                      title={labels.confirmDeleteTitle}
                      description={labels.confirmDeleteBody}
                      confirmLabel={labels.confirm}
                      cancelLabel={labels.cancel}
                      onConfirm={() => run(() => deleteCardTemplateAction(template.id))}
                    />
                  )}
                  {canManage && template.isSystem && (
                    <CardTemplateDialog
                      labels={labels}
                      prefill={{
                        key: `${template.key}-copy`,
                        name: `${template.name} (copy)`,
                        contentType: template.contentType,
                        variant: template.variant,
                        config: template.config,
                      }}
                      trigger={
                        <Button variant="ghost" size="sm">
                          {labels.duplicate}
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
