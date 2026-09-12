"use client";

// User detail controls (changes-01 rework): role chips + assignment,
// permission overrides, account-status select, admin password reset —
// removals and status changes behind confirmation popups. Every action
// re-checks its permission server-side; visibility here is UX.
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { z } from "zod";
import { Badge } from "@repo/ui/components/badge";
import { humanizeKey } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Field, FieldError } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ResetPasswordDialog } from "../../_components/reset-password-dialog.tsx";
import {
  assignRoleAction,
  removeOverrideAction,
  removeRoleAction,
  setOverrideAction,
  setUserStatusAction,
} from "../../_actions/user-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

// setOverrideAction parses its arguments inline (user-actions.ts) rather than
// through a @repo/contracts schema, so this restates exactly those three
// parses — no rule the action does not apply. Keep the two in step.
const overrideSchema = z.object({
  permissionKey: z.string().min(1),
  effect: z.enum(["ALLOW", "DENY"]),
  reason: z.string().min(3),
});

// ─── Account status ──────────────────────────────────────────

export function StatusControl({
  userId,
  status,
  statusLabels,
  labels,
}: {
  userId: string;
  status: string;
  statusLabels: Record<string, string>;
  labels: {
    status: string;
    confirmTitle: string;
    confirmStatusChange: string;
    confirm: string;
    cancel: string;
  };
}) {
  const { pending, run } = useServerAction();
  const [target, setTarget] = useState<string | null>(null);

  return (
    <>
      <AdminCombobox
        aria-label={labels.status}
        disabled={pending}
        className="min-w-0 flex-1"
        value={status}
        onValueChange={(value) => {
          if (value && value !== status) setTarget(value);
        }}
        options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
        title={labels.confirmTitle}
        description={`${labels.confirmStatusChange} ${target ? (statusLabels[target] ?? target) : ""}`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        destructive={target !== "ACTIVE"}
        onConfirm={() => {
          if (target) run(() => setUserStatusAction(userId, target));
          setTarget(null);
        }}
      />
    </>
  );
}

// ─── Password reset ──────────────────────────────────────────

export function ResetPasswordButton({
  userId,
  userLabel,
  labels,
}: {
  userId: string;
  userLabel: string;
  labels: {
    resetPassword: string;
    resetDescription: string;
    newPassword: string;
    generate: string;
    confirm: string;
    cancel: string;
    done: string;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound data-icon="inline-start" aria-hidden /> {labels.resetPassword}
      </Button>
      <ResetPasswordDialog
        userId={userId}
        userLabel={userLabel}
        open={open}
        onOpenChange={setOpen}
        labels={{
          title: labels.resetPassword,
          description: labels.resetDescription,
          newPassword: labels.newPassword,
          generate: labels.generate,
          confirm: labels.confirm,
          cancel: labels.cancel,
          done: labels.done,
        }}
      />
    </>
  );
}

// ─── Roles ───────────────────────────────────────────────────

export function RoleControls({
  userId,
  currentRoles,
  availableRoles,
  labels,
}: {
  userId: string;
  currentRoles: string[];
  availableRoles: { key: string; name: string; level: number }[];
  labels: {
    assignRole: string;
    remove: string;
    confirmTitle: string;
    confirmRemoveRole: string;
    confirm: string;
    cancel: string;
    level: string;
  };
}) {
  const { pending, run } = useServerAction();
  const [selected, setSelected] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const assignable = availableRoles.filter((r) => !currentRoles.includes(r.key));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {currentRoles.map((roleKey) => (
          <li key={roleKey}>
            <Badge variant="secondary" className="gap-1.5">
              {availableRoles.find((r) => r.key === roleKey)?.name ?? roleKey}
              <button
                type="button"
                className="text-destructive-interactive underline-offset-2 hover:underline"
                disabled={pending}
                onClick={() => setRemoveTarget(roleKey)}
              >
                {labels.remove}
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <AdminCombobox
          aria-label={labels.assignRole}
          className="min-w-0 flex-1 sm:max-w-sm"
          placeholder="—"
          value={selected}
          onValueChange={setSelected}
          options={assignable.map((r) => ({
            value: r.key,
            label: `${r.name} · ${labels.level} ${r.level}`,
          }))}
        />
        <Button
          size="sm"
          disabled={!selected}
          loading={pending}
          onClick={() =>
            run(() => assignRoleAction(userId, selected), { onDone: () => setSelected("") })
          }
        >
          {labels.assignRole}
        </Button>
      </div>
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
        title={labels.confirmTitle}
        description={`${labels.confirmRemoveRole} ${removeTarget ?? ""}`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          if (removeTarget) run(() => removeRoleAction(userId, removeTarget));
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}

// ─── Permission overrides ────────────────────────────────────

export function OverrideControls({
  userId,
  overrides,
  permissionKeys,
  labels,
}: {
  userId: string;
  overrides: { permissionKey: string; effect: string; reason: string | null }[];
  permissionKeys: string[];
  labels: {
    addOverride: string;
    reason: string;
    allow: string;
    deny: string;
    permission: string;
    remove: string;
    confirmTitle: string;
    confirmRemoveOverride: string;
    confirm: string;
    cancel: string;
  };
}) {
  const { pending, run } = useServerAction();
  const [permission, setPermission] = useState("");
  const [effect, setEffect] = useState("DENY");
  const [reason, setReason] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const values = { permissionKey: permission, effect, reason };
  const form = useFieldErrors(overrideSchema, values);

  const addOverride = () => {
    if (!form.validate()) return;
    run(() => setOverrideAction(userId, permission, effect, reason), {
      onDone: () => {
        setReason("");
        form.reset();
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {overrides.map((o) => (
          <li key={o.permissionKey} className="flex items-center gap-2 text-sm">
            <Badge variant={o.effect === "DENY" ? "destructive" : "outline"}>
              {o.effect === "DENY" ? labels.deny : labels.allow}
            </Badge>
            <span>{humanizeKey(o.permissionKey)}</span>
            {o.reason && <span className="text-xs text-muted-foreground">— {o.reason}</span>}
            <button
              type="button"
              className="ms-auto text-xs text-destructive-interactive underline-offset-2 hover:underline"
              disabled={pending}
              onClick={() => setRemoveTarget(o.permissionKey)}
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      {/* A compact inline form: its controls carry aria-labels rather than
          visible labels, but they still sit in Fields so a failed add says
          which one is wrong, inline, instead of a silently disabled button. */}
      <div className="flex flex-wrap items-center gap-2">
        <Field
          invalid={form.invalid("permissionKey")}
          required
          className="min-w-0 flex-1 sm:max-w-sm"
        >
          <AdminCombobox
            aria-label={labels.permission}
            placeholder="—"
            value={permission}
            onValueChange={setPermission}
            options={permissionKeys.map((key) => ({ value: key, label: key }))}
          />
          <FieldError>{form.error("permissionKey")}</FieldError>
        </Field>
        <AdminCombobox
          aria-label={labels.permission}
          className="w-28"
          value={effect}
          onValueChange={(value) => setEffect(value || "DENY")}
          options={[
            { value: "ALLOW", label: labels.allow },
            { value: "DENY", label: labels.deny },
          ]}
        />
        <Field invalid={form.invalid("reason")} required className="max-w-64">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.reason}
            aria-label={labels.reason}
          />
          <FieldError>{form.error("reason")}</FieldError>
        </Field>
        <Button size="sm" loading={pending} onClick={addOverride}>
          {labels.addOverride}
        </Button>
      </div>
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null);
        }}
        title={labels.confirmTitle}
        description={`${labels.confirmRemoveOverride} ${removeTarget ?? ""}`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          if (removeTarget) run(() => removeOverrideAction(userId, removeTarget));
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
