"use client";

// The composer's visual StyleChoices/MotionChoices picker (Phase 3 PR 3.3)
// doesn't exist yet — `config` is authored as JSON here, validated by the
// same `stylePresetConfigSchema` the service parses on save. A deliberate,
// temporary simplification (plan §12 PR 3.1 scope), not the shipped
// authoring experience.
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
  createStylePresetAction,
  deleteStylePresetAction,
} from "../../_actions/style-preset-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface StylePresetRow {
  id: string;
  key: string;
  name: string;
  scope: string;
  config: unknown;
  isSystem: boolean;
  usageCount: number;
}

interface StylesLabels {
  newStyle: string;
  keyLabel: string;
  nameLabel: string;
  scopeLabel: string;
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
}

function StylePresetDialog({
  labels,
  prefill,
  trigger,
}: {
  labels: StylesLabels;
  prefill?: { key: string; name: string; scope: string; config: unknown };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(prefill?.key ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [scope, setScope] = useState(prefill?.scope ?? "any");
  const [configText, setConfigText] = useState(
    prefill ? JSON.stringify(prefill.config, null, 2) : "{}",
  );
  const [jsonError, setJsonError] = useState(false);
  const { run, pending } = useServerAction();

  function reset() {
    setKey(prefill?.key ?? "");
    setName(prefill?.name ?? "");
    setScope(prefill?.scope ?? "any");
    setConfigText(prefill ? JSON.stringify(prefill.config, null, 2) : "{}");
    setJsonError(false);
  }

  function submit() {
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setJsonError(true);
      return;
    }
    setJsonError(false);
    // The server re-validates with the real Zod schema (security.md #6);
    // this cast just satisfies the action's typed signature for a value
    // that was, a moment ago, unstructured admin-typed JSON text.
    run(() => createStylePresetAction({ key, name, scope, config: config as never }), {
      onDone: () => setOpen(false),
    });
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
      <DialogContent className="max-w-md" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newStyle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style-key">{labels.keyLabel}</Label>
            <Input id="style-key" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style-name">{labels.nameLabel}</Label>
            <Input id="style-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style-scope">{labels.scopeLabel}</Label>
            <Input id="style-scope" value={scope} onChange={(e) => setScope(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="style-config">{labels.configLabel}</Label>
            <Textarea
              id="style-config"
              rows={8}
              className="font-mono text-xs"
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
            />
            {jsonError && <p className="text-xs text-destructive">{labels.invalidJson}</p>}
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

export function StylePresetsManager({
  presets,
  canManage,
  labels,
}: {
  presets: StylePresetRow[];
  canManage: boolean;
  labels: StylesLabels;
}) {
  const { run } = useServerAction();

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <StylePresetDialog
            labels={labels}
            trigger={<Button size="sm">{labels.newStyle}</Button>}
          />
        </div>
      )}
      {presets.length === 0 ? (
        <Empty className="border">
          <EmptyTitle>{labels.noResults}</EmptyTitle>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.keyLabel}</TableHead>
              <TableHead>{labels.nameLabel}</TableHead>
              <TableHead>{labels.scopeLabel}</TableHead>
              <TableHead className="text-end">{labels.usageCount}</TableHead>
              <TableHead className="text-end">{labels.delete}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presets.map((preset) => (
              <TableRow key={preset.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{preset.key}</code>
                    {preset.isSystem && <Badge variant="outline">{labels.systemBadge}</Badge>}
                  </div>
                </TableCell>
                <TableCell>{preset.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{preset.scope}</code>
                </TableCell>
                <TableCell className="text-end">{preset.usageCount}</TableCell>
                <TableCell className="text-end">
                  {canManage && !preset.isSystem && (
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
                      onConfirm={() => run(() => deleteStylePresetAction(preset.id))}
                    />
                  )}
                  {canManage && preset.isSystem && (
                    <StylePresetDialog
                      labels={labels}
                      prefill={{
                        key: `${preset.key}-copy`,
                        name: `${preset.name} (copy)`,
                        scope: preset.scope,
                        config: preset.config,
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
