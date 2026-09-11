"use client";

// Role detail header actions (changes-01/02, image-2): edit profile
// (modal — name/description always editable, level locked for system
// roles per ADR-016), clone, delete (confirmation popup, custom roles
// only — system roles are never deleted, lockout risk). The server
// enforces every one of these; hiding/disabling buttons here is UX.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import {
  cloneRoleAction,
  deleteRoleAction,
  updateRoleMetaAction,
} from "../../_actions/user-actions.ts";

export function RoleActions({
  roleKey,
  name,
  description,
  level,
  isSystem,
  canEdit,
  maxLevel,
  labels,
}: {
  roleKey: string;
  name: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  /** false hides mutating controls entirely (viewer without roles.manage). */
  canEdit: boolean;
  maxLevel: number;
  labels: {
    edit: string;
    editDescription: string;
    clone: string;
    delete: string;
    save: string;
    cancel: string;
    name: string;
    level: string;
    description: string;
    deleteTitle: string;
    deleteConfirm: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name, level, description: description ?? "" });

  if (!canEdit) return null;

  const clone = () =>
    startTransition(async () => {
      try {
        const suffix = Date.now().toString(36).slice(-4);
        const newKey = `${roleKey}_copy_${suffix}`;
        await cloneRoleAction(roleKey, newKey, `${name} copy`);
        router.push(`/admin/roles/${newKey}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });

  const saveMeta = () =>
    startTransition(async () => {
      try {
        await updateRoleMetaAction(roleKey, {
          name: form.name,
          level: form.level,
          description: form.description || null,
        });
        setEditOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });

  return (
    <div className="flex items-center gap-2">
      {/* ADR-016: name/description are editable for system roles too — only
          the key/level/existence stay locked (delete stays hidden below). */}
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={pending}>
        <Pencil data-icon="inline-start" aria-hidden /> {labels.edit}
      </Button>
      <Button variant="outline" size="sm" onClick={clone} disabled={pending}>
        <Copy data-icon="inline-start" aria-hidden /> {labels.clone}
      </Button>
      {!isSystem && (
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm" disabled={pending}>
              <Trash2 data-icon="inline-start" aria-hidden /> {labels.delete}
            </Button>
          }
          title={labels.deleteTitle}
          description={`${labels.deleteConfirm} ${name}`}
          confirmLabel={labels.delete}
          cancelLabel={labels.cancel}
          onConfirm={async () => {
            await deleteRoleAction(roleKey);
            router.push("/admin/roles");
            router.refresh();
          }}
        />
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.edit}</DialogTitle>
            <DialogDescription>{labels.editDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-edit-name">{labels.name}</Label>
              <Input
                id="role-edit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-edit-level">{labels.level}</Label>
              <Input
                id="role-edit-level"
                type="number"
                min={0}
                max={Math.max(0, maxLevel - 1)}
                value={form.level}
                // ADR-016: a system role's level is locked (delete/lockout
                // guard) — name/description/permissions are not.
                disabled={isSystem}
                onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-edit-description">{labels.description}</Label>
              <Textarea
                id="role-edit-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              onClick={saveMeta}
              disabled={pending || !form.name.trim() || form.level < 0 || form.level >= maxLevel}
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
