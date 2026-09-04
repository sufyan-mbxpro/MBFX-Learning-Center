"use client";

// User detail controls (changes-01 rework): role chips + assignment,
// permission overrides, account-status select, admin password reset —
// removals and status changes behind confirmation popups. Every action
// re-checks its permission server-side; visibility here is UX.
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ResetPasswordDialog } from "../../_components/reset-password-dialog.tsx";
import {
  assignRoleAction,
  removeOverrideAction,
  removeRoleAction,
  setOverrideAction,
  setUserStatusAction,
} from "../../_actions/user-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

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
      <Select
        value={status}
        onValueChange={(value) => {
          if (value && value !== status) setTarget(value as string);
        }}
      >
        <SelectTrigger aria-label={labels.status} disabled={pending} className="min-w-44">
          <SelectValue>{statusLabels[status] ?? status}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
                className="text-destructive underline-offset-2 hover:underline"
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
        <Select value={selected} onValueChange={(value) => setSelected((value as string) ?? "")}>
          <SelectTrigger aria-label={labels.assignRole} className="min-w-48">
            <SelectValue>{assignable.find((r) => r.key === selected)?.name ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {assignable.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.name} · {labels.level} {r.level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={pending || !selected}
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

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {overrides.map((o) => (
          <li key={o.permissionKey} className="flex items-center gap-2 text-sm">
            <Badge variant={o.effect === "DENY" ? "destructive" : "outline"}>
              {o.effect === "DENY" ? labels.deny : labels.allow}
            </Badge>
            <code>{o.permissionKey}</code>
            {o.reason && <span className="text-xs text-muted-foreground">— {o.reason}</span>}
            <button
              type="button"
              className="ms-auto text-xs text-destructive underline-offset-2 hover:underline"
              disabled={pending}
              onClick={() => setRemoveTarget(o.permissionKey)}
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={permission}
          onValueChange={(value) => setPermission((value as string) ?? "")}
        >
          <SelectTrigger aria-label={labels.permission} className="min-w-56">
            <SelectValue>{permission || "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {permissionKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={effect} onValueChange={(value) => setEffect((value as string) ?? "DENY")}>
          <SelectTrigger aria-label={labels.permission} className="min-w-28">
            <SelectValue>{effect === "ALLOW" ? labels.allow : labels.deny}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALLOW">{labels.allow}</SelectItem>
            <SelectItem value="DENY">{labels.deny}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={labels.reason}
          aria-label={labels.reason}
          className="max-w-64"
        />
        <Button
          size="sm"
          disabled={pending || !permission || reason.trim().length < 3}
          onClick={() =>
            run(() => setOverrideAction(userId, permission, effect, reason), {
              onDone: () => setReason(""),
            })
          }
        >
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
