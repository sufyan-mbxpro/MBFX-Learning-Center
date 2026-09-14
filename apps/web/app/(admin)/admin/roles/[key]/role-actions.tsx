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
import { z } from "zod";
import { updateRoleSchema } from "@repo/contracts";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
  cloneRoleAction,
  deleteRoleAction,
  updateRoleMetaAction,
} from "../../_actions/user-actions.ts";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";

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
  const [draft, setDraft] = React.useState({ name, level, description: description ?? "" });

  // The action's own schema, with the actor's ceiling (strict <) in place of
  // the seed's 99 — the server enforces the same bound through the level
  // guard in updateRoleMeta. Same shape as CreateRoleDialog.
  const schema = React.useMemo(
    () =>
      updateRoleSchema.extend({
        level: z
          .int()
          .min(0)
          .max(Math.max(0, maxLevel - 1)),
      }),
    [maxLevel],
  );
  const values = {
    name: draft.name,
    level: draft.level,
    description: draft.description || null,
  };
  const form = useFieldErrors(schema, values);

  if (!canEdit) return null;

  const closeEdit = () => {
    setEditOpen(false);
    form.reset();
  };

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

  const saveMeta = () => {
    if (!form.validate()) return;
    startTransition(async () => {
      try {
        await updateRoleMetaAction(roleKey, values);
        closeEdit();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

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

      <Dialog open={editOpen} onOpenChange={(next) => (next ? setEditOpen(true) : closeEdit())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.edit}</DialogTitle>
            <DialogDescription>{labels.editDescription}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field invalid={form.invalid("name")} required>
              <FieldLabel>{labels.name}</FieldLabel>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((f) => ({ ...f, name: e.target.value }))}
              />
              <FieldError>{form.error("name")}</FieldError>
            </Field>
            {/* ADR-016: a system role's level is locked (delete/lockout
                guard) — name/description/permissions are not. A locked
                field is not one the admin must fill, so no asterisk. */}
            <Field invalid={form.invalid("level")} required={!isSystem}>
              <FieldLabel>{labels.level}</FieldLabel>
              <Input
                type="number"
                min={0}
                max={Math.max(0, maxLevel - 1)}
                value={draft.level}
                disabled={isSystem}
                onChange={(e) => setDraft((f) => ({ ...f, level: Number(e.target.value) }))}
              />
              <FieldError>{form.error("level")}</FieldError>
            </Field>
            <Field invalid={form.invalid("description")}>
              <FieldLabel>{labels.description}</FieldLabel>
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft((f) => ({ ...f, description: e.target.value }))}
              />
              <FieldError>{form.error("description")}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={pending}>
              {labels.cancel}
            </Button>
            {/* Enabled while fields are wrong: pressing it names them
                instead (audit F-07). */}
            <Button onClick={saveMeta} loading={pending}>
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
