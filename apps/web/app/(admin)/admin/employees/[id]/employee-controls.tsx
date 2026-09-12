"use client";

// Employee detail controls (changes-01): employment-status select with
// confirmation, and the basic-info edit modal. TERMINATED is absent from
// the status options on purpose — that path is the offboard flow's
// transaction, enforced server-side.
import * as React from "react";
import { Pencil } from "lucide-react";
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
import { updateEmployeeSchema } from "@repo/contracts";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { setEmployeeStatusAction, updateEmployeeAction } from "../../_actions/user-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function EmployeeStatusControl({
  employeeId,
  status,
  statusLabels,
  labels,
}: {
  employeeId: string;
  status: string;
  /** Assignable statuses only — no TERMINATED. */
  statusLabels: Record<string, string>;
  labels: {
    status: string;
    confirmTitle: string;
    confirmStatusChange: string;
    confirm: string;
    cancel: string;
  };
}) {
  const { run, pending } = useServerAction();
  const [target, setTarget] = React.useState<string | null>(null);

  return (
    <>
      <AdminCombobox
        aria-label={labels.status}
        disabled={pending}
        className="w-44"
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
          if (target) run(() => setEmployeeStatusAction(employeeId, target));
          setTarget(null);
        }}
      />
    </>
  );
}

export interface EmployeeEditValues {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  departmentId: string;
  designationId: string;
  reportingToId: string;
  notes: string;
}

export function EmployeeEditDialog({
  employeeId,
  initial,
  departments,
  designations,
  reportingOptions,
  labels,
}: {
  employeeId: string;
  initial: EmployeeEditValues;
  departments: { id: string; name: string }[];
  designations: { id: string; title: string }[];
  reportingOptions: { id: string; name: string }[];
  labels: {
    edit: string;
    editDescription: string;
    save: string;
    cancel: string;
    firstName: string;
    lastName: string;
    phone: string;
    location: string;
    department: string;
    designation: string;
    reportingTo: string;
    notes: string;
    none: string;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const { run, pending } = useServerAction();
  const [draft, setDraft] = React.useState(initial);

  const set = <K extends keyof EmployeeEditValues>(key: K, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // Exactly the action's input — the form always sends both names, so the
  // schema's `.min(1)` on them is what makes them required here.
  const values = {
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone || null,
    location: draft.location || null,
    departmentId: draft.departmentId || null,
    designationId: draft.designationId || null,
    reportingToId: draft.reportingToId || null,
    notes: draft.notes || null,
  };
  const form = useFieldErrors(updateEmployeeSchema, values);

  const close = () => {
    setOpen(false);
    form.reset();
  };

  const submit = () => {
    if (!form.validate()) return;
    run(() => updateEmployeeAction(employeeId, values), { onDone: close });
  };

  const optionSelect = (
    label: string,
    value: string,
    options: { id: string; label: string }[],
    key: keyof EmployeeEditValues,
  ) => (
    <Field invalid={form.invalid(key)}>
      <FieldLabel>{label}</FieldLabel>
      <AdminCombobox
        value={value}
        onValueChange={(next) => set(key, next)}
        options={[
          { value: "", label: labels.none },
          ...options.map((option) => ({ value: option.id, label: option.label })),
        ]}
      />
      <FieldError>{form.error(key)}</FieldError>
    </Field>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil data-icon="inline-start" aria-hidden /> {labels.edit}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.edit}</DialogTitle>
            <DialogDescription>{labels.editDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field invalid={form.invalid("firstName")} required>
              <FieldLabel>{labels.firstName}</FieldLabel>
              <Input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} />
              <FieldError>{form.error("firstName")}</FieldError>
            </Field>
            <Field invalid={form.invalid("lastName")} required>
              <FieldLabel>{labels.lastName}</FieldLabel>
              <Input value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} />
              <FieldError>{form.error("lastName")}</FieldError>
            </Field>
            <Field invalid={form.invalid("phone")}>
              <FieldLabel>{labels.phone}</FieldLabel>
              <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
              <FieldError>{form.error("phone")}</FieldError>
            </Field>
            <Field invalid={form.invalid("location")}>
              <FieldLabel>{labels.location}</FieldLabel>
              <Input value={draft.location} onChange={(e) => set("location", e.target.value)} />
              <FieldError>{form.error("location")}</FieldError>
            </Field>
            {optionSelect(
              labels.department,
              draft.departmentId,
              departments.map((d) => ({ id: d.id, label: d.name })),
              "departmentId",
            )}
            {optionSelect(
              labels.designation,
              draft.designationId,
              designations.map((d) => ({ id: d.id, label: d.title })),
              "designationId",
            )}
            <div className="sm:col-span-2">
              {optionSelect(
                labels.reportingTo,
                draft.reportingToId,
                reportingOptions.map((o) => ({ id: o.id, label: o.name })),
                "reportingToId",
              )}
            </div>
            <Field invalid={form.invalid("notes")} className="sm:col-span-2">
              <FieldLabel>{labels.notes}</FieldLabel>
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
              <FieldError>{form.error("notes")}</FieldError>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            {/* Enabled while fields are wrong: pressing it names them
                instead (audit F-07). */}
            <Button onClick={submit} loading={pending}>
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
