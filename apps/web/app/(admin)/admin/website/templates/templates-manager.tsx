"use client";

// Browse/rename/delete only — nothing produces a new template without the
// composer's "Save as template" (Phase 3 PR 3.3, plan §12 PR 3.1 scope).
import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  deleteLayoutTemplateAction,
  updateLayoutTemplateAction,
} from "../../_actions/layout-template-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface LayoutTemplateRow {
  id: string;
  key: string;
  name: string;
  kind: string;
  pageKind: string | null;
  isSystem: boolean;
  usageCount: number;
}

interface TemplatesLabels {
  nameLabel: string;
  kindLabel: string;
  rename: string;
  cancel: string;
  close: string;
  save: string;
  delete: string;
  systemBadge: string;
  usageCount: string;
  noResults: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
}

function RenameDialog({
  labels,
  template,
}: {
  labels: TemplatesLabels;
  template: LayoutTemplateRow;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const { run, pending } = useServerAction();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setName(template.name);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {labels.rename}
          </Button>
        }
      />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.rename}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">{labels.nameLabel}</Label>
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() =>
              run(() => updateLayoutTemplateAction(template.id, { name }), {
                onDone: () => setOpen(false),
              })
            }
          >
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LayoutTemplatesManager({
  templates,
  canManage,
  labels,
}: {
  templates: LayoutTemplateRow[];
  canManage: boolean;
  labels: TemplatesLabels;
}) {
  const { run } = useServerAction();

  return (
    <div className="flex flex-col gap-4">
      {templates.length === 0 ? (
        <Empty className="border">
          <EmptyTitle>{labels.noResults}</EmptyTitle>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.nameLabel}</TableHead>
              <TableHead>{labels.kindLabel}</TableHead>
              <TableHead className="text-end">{labels.usageCount}</TableHead>
              <TableHead className="text-end">{labels.delete}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {template.name}
                    {template.isSystem && <Badge variant="outline">{labels.systemBadge}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs">
                    {template.kind}
                    {template.pageKind ? ` · ${template.pageKind}` : ""}
                  </code>
                </TableCell>
                <TableCell className="text-end">{template.usageCount}</TableCell>
                <TableCell className="text-end">
                  {canManage && !template.isSystem && (
                    <div className="flex justify-end gap-1">
                      <RenameDialog labels={labels} template={template} />
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
                        onConfirm={() => run(() => deleteLayoutTemplateAction(template.id))}
                      />
                    </div>
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
