"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
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
import { Switch } from "@repo/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { createRedirectAction, setRedirectActiveAction } from "../../_actions/redirect-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
}

interface RedirectsLabels {
  newRedirect: string;
  redirectFromLabel: string;
  redirectToLabel: string;
  redirectStatusCodeLabel: string;
  create: string;
  cancel: string;
  close: string;
  active: string;
  noResults: string;
}

function NewRedirectDialog({ labels }: { labels: RedirectsLabels }) {
  const [open, setOpen] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const { run, pending } = useServerAction();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFromPath("");
          setToPath("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm">{labels.newRedirect}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newRedirect}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-from">{labels.redirectFromLabel}</Label>
            <Input
              id="redirect-from"
              placeholder="/old-path"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-to">{labels.redirectToLabel}</Label>
            <Input
              id="redirect-to"
              placeholder="/new-path"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || !fromPath.trim() || !toPath.trim()}
            onClick={() =>
              run(() => createRedirectAction({ fromPath, toPath, statusCode: 301 }), {
                onDone: () => setOpen(false),
              })
            }
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RedirectsManager({
  redirects,
  canManage,
  labels,
}: {
  redirects: RedirectRow[];
  canManage: boolean;
  labels: RedirectsLabels;
}) {
  const { run } = useServerAction();

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <NewRedirectDialog labels={labels} />
        </div>
      )}
      {redirects.length === 0 ? (
        <Empty className="border">
          <EmptyTitle>{labels.noResults}</EmptyTitle>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.redirectFromLabel}</TableHead>
              <TableHead>{labels.redirectToLabel}</TableHead>
              <TableHead>{labels.redirectStatusCodeLabel}</TableHead>
              <TableHead className="text-end">{labels.active}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {redirects.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <code className="text-xs">{row.fromPath}</code>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{row.toPath}</code>
                </TableCell>
                <TableCell>{row.statusCode}</TableCell>
                <TableCell className="text-end">
                  <Switch
                    checked={row.isActive}
                    disabled={!canManage}
                    onCheckedChange={(checked) =>
                      run(() => setRedirectActiveAction(row.id, { isActive: checked === true }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
